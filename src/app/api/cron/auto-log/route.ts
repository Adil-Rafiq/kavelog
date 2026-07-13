import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attendanceRecords, departments, holidays, users } from "@/db/schema";
import { isWeekend, toDateKey } from "@/lib/utils";
import {
  computeOvertimeChunks,
  shiftDefaultInstants,
  type Shift,
} from "@/lib/policy";

/**
 * Cron endpoint: for users who opted into "auto-log my shift", fills in any
 * fully-missed weekday (no record yet, and not a holiday) with a Present
 * record built from their shift's default clock-in/out times.
 *
 * Users who have NOT opted in are left completely untouched — nothing is
 * marked absent. Absent is a manual status only.
 *
 * Runs daily at 00:05. Configure in vercel.json.
 * Protect with CRON_SECRET (Vercel adds Authorization: Bearer <secret>).
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const target = new Date(now);
  target.setDate(target.getDate() - 1);
  const dateKey = toDateKey(target);

  if (isWeekend(target)) {
    return NextResponse.json({ ok: true, reason: "weekend", dateKey });
  }

  const [holiday] = await db
    .select({ id: holidays.id })
    .from(holidays)
    .where(eq(holidays.date, dateKey))
    .limit(1);
  if (holiday) {
    return NextResponse.json({ ok: true, reason: "holiday", dateKey });
  }

  // Only active users who opted into auto-log are considered. Everyone else is
  // left alone — this cron never marks anyone absent.
  const optedIn = await db
    .select({
      id: users.id,
      shift: departments.shift,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(eq(users.status, "active"), eq(users.autoLogShift, true)));

  if (optedIn.length === 0) {
    return NextResponse.json({ ok: true, dateKey, autoLogged: 0 });
  }

  const records = await db
    .select({ userId: attendanceRecords.userId })
    .from(attendanceRecords)
    .where(eq(attendanceRecords.date, dateKey));
  const recorded = new Set(records.map((r) => r.userId));

  const toCreate = optedIn
    .filter((u) => !recorded.has(u.id))
    .map((u) => {
      const shift = (u.shift as Shift) ?? "first";
      const { clockIn, clockOut } = shiftDefaultInstants(dateKey, shift);
      return {
        userId: u.id,
        date: dateKey,
        status: "present" as const,
        clockIn,
        clockOut,
        overtimeChunks: computeOvertimeChunks(clockIn, clockOut, shift),
      };
    });

  if (toCreate.length > 0) {
    await db.insert(attendanceRecords).values(toCreate);
  }

  return NextResponse.json({ ok: true, dateKey, autoLogged: toCreate.length });
}
