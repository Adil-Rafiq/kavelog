import { and, between, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attendanceRecords,
  departments,
  holidays,
  users,
  type AttendanceRecord,
  type Department,
} from "@/db/schema";
import {
  POLICY,
  computeOvertimeChunks,
  computeWorkedHours,
  expectedMonthlyHours,
  isWeekend,
  type Shift,
} from "@/lib/policy";
import { toDateKey } from "@/lib/utils";

export interface UserContext {
  id: string;
  shift: Shift;
  departmentName: string | null;
}

export async function getUserContext(userId: string): Promise<UserContext> {
  const [row] = await db
    .select({
      id: users.id,
      departmentId: users.departmentId,
      shift: departments.shift,
      departmentName: departments.name,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(eq(users.id, userId))
    .limit(1);

  return {
    id: userId,
    shift: (row?.shift as Shift) ?? "first",
    departmentName: row?.departmentName ?? null,
  };
}

export async function getRecord(userId: string, dateKey: string) {
  const [rec] = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.userId, userId),
        eq(attendanceRecords.date, dateKey)
      )
    )
    .limit(1);
  return rec ?? null;
}

export async function getRecordsBetween(
  userId: string,
  startKey: string,
  endKey: string
): Promise<AttendanceRecord[]> {
  return await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.userId, userId),
        gte(attendanceRecords.date, startKey),
        lte(attendanceRecords.date, endKey)
      )
    );
}

export async function getHolidaysBetween(startKey: string, endKey: string) {
  return await db
    .select()
    .from(holidays)
    .where(and(gte(holidays.date, startKey), lte(holidays.date, endKey)));
}

/**
 * Recompute and persist overtime chunks based on current clock-in/out and shift.
 */
export function recomputeOvertime(
  rec: Pick<AttendanceRecord, "clockIn" | "clockOut">,
  shift: Shift
): number {
  return computeOvertimeChunks(rec.clockIn, rec.clockOut, shift);
}

export interface MonthSummary {
  year: number;
  month0: number; // 0-11
  daysPresent: number;
  daysAbsent: number;
  daysPaidLeave: number;
  totalHours: number;
  overtimeChunks: number;
  expectedHours: number;
  /** Hours worked on working days that have already fully elapsed (today excluded). */
  hoursWorkedToDate: number;
  /** Target hours for working days that have already fully elapsed (today excluded). */
  expectedHoursToDate: number;
  weekendHoursWorked: number;
  paidLeavesUsedThisMonth: number;
}

export async function summarizeMonth(
  userId: string,
  year: number,
  month0: number
): Promise<MonthSummary> {
  const start = new Date(year, month0, 1);
  const end = new Date(year, month0 + 1, 0);
  const startKey = toDateKey(start);
  const endKey = toDateKey(end);

  const [records, hols] = await Promise.all([
    getRecordsBetween(userId, startKey, endKey),
    getHolidaysBetween(startKey, endKey),
  ]);

  // Count holidays that fall on weekdays — those are the ones that reduce the target
  const holidayWeekdays = hols.filter((h) => {
    const d = new Date(h.date + "T00:00:00");
    return !isWeekend(d);
  }).length;
  const holidayKeys = new Set(hols.map((h) => h.date));

  // "To date" figures power the month-pace indicator: how the user is tracking
  // against the target for working days that have *already elapsed*. Today is
  // in progress, so it's excluded from both the worked and expected sides
  // (comparing a partial day would distort the signal). For a fully past month
  // this equals the whole month; for a future month it's zero.
  const todayKey = toDateKey(new Date());
  const lastDay = end.getDate();
  let elapsedWeekdays = 0;
  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(year, month0, day);
    if (toDateKey(d) >= todayKey) break;
    if (!isWeekend(d)) elapsedWeekdays++;
  }
  const holidayWeekdaysToDate = hols.filter((h) => {
    if (h.date >= todayKey) return false;
    const d = new Date(h.date + "T00:00:00");
    return !isWeekend(d);
  }).length;

  let daysPresent = 0;
  let daysAbsent = 0;
  let daysPaidLeave = 0;
  let paidLeaveWeekdays = 0;
  let paidLeaveWeekdaysToDate = 0;
  let totalHours = 0;
  let hoursWorkedToDate = 0;
  let overtimeChunks = 0;
  let weekendHoursWorked = 0;

  for (const r of records) {
    const d = new Date(r.date + "T00:00:00");
    const wknd = isWeekend(d);
    if (r.status === "present") {
      daysPresent++;
      const hrs = computeWorkedHours(r.clockIn, r.clockOut);
      totalHours += hrs;
      if (r.date < todayKey) hoursWorkedToDate += hrs;
      if (wknd) weekendHoursWorked += hrs;
      overtimeChunks += r.overtimeChunks ?? 0;
    } else if (r.status === "absent") {
      daysAbsent++;
    } else if (r.status === "paid_leave") {
      daysPaidLeave++;
      // A weekday paid-leave day reduces the target by 8h (hours-neutral),
      // mirroring holidays. Skip weekends (not in the target) and days already
      // counted as holidays so the target isn't reduced twice for one date.
      if (!wknd && !holidayKeys.has(r.date)) {
        paidLeaveWeekdays++;
        if (r.date < todayKey) paidLeaveWeekdaysToDate++;
      }
    }
  }

  const expectedHoursToDate =
    Math.max(
      0,
      elapsedWeekdays - holidayWeekdaysToDate - paidLeaveWeekdaysToDate
    ) * POLICY.WORKING_HOURS_PER_DAY;

  return {
    year,
    month0,
    daysPresent,
    daysAbsent,
    daysPaidLeave,
    totalHours,
    overtimeChunks,
    expectedHours: expectedMonthlyHours(
      year,
      month0,
      holidayWeekdays,
      paidLeaveWeekdays
    ),
    hoursWorkedToDate,
    expectedHoursToDate,
    weekendHoursWorked,
    paidLeavesUsedThisMonth: daysPaidLeave,
  };
}

export interface YearSummary {
  year: number;
  paidLeavesUsed: number;
  paidLeavesRemaining: number;
  totalOvertimeChunks: number;
  totalHours: number;
}

export async function summarizeYear(
  userId: string,
  year: number
): Promise<YearSummary> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const records = await getRecordsBetween(userId, start, end);

  let paidLeavesUsed = 0;
  let totalOvertimeChunks = 0;
  let totalHours = 0;
  for (const r of records) {
    if (r.status === "paid_leave") paidLeavesUsed++;
    if (r.status === "present") {
      totalHours += computeWorkedHours(r.clockIn, r.clockOut);
      totalOvertimeChunks += r.overtimeChunks ?? 0;
    }
  }

  return {
    year,
    paidLeavesUsed,
    paidLeavesRemaining: Math.max(0, POLICY.PAID_LEAVES_PER_YEAR - paidLeavesUsed),
    totalOvertimeChunks,
    totalHours,
  };
}
