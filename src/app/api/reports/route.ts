import { NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { departments, users } from "@/db/schema";
import { auth } from "@/auth";
import {
  getHolidaysBetween,
  getRecordsBetween,
  summarizeMonth,
  summarizeYear,
} from "@/lib/attendance";
import { computeWorkedHours, isWeekend } from "@/lib/policy";
import { toDateKey } from "@/lib/utils";

const querySchema = z.object({
  year: z.coerce.number().int().min(2000).max(3000),
  month: z.coerce.number().int().min(1).max(12).optional(),
  scope: z.enum(["self", "all"]).default("self"),
  view: z.enum(["month", "ytd"]).default("month"),
  departmentId: z.string().uuid().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ rows: [] }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const q = parsed.data;
  const isAdmin = session.user.role === "admin";
  const scope = isAdmin ? q.scope : "self";

  const targetUsers = await selectUsers(scope, session.user.id, q.departmentId);

  if (q.view === "month") {
    const month0 = (q.month ?? new Date().getMonth() + 1) - 1;
    const rows = await Promise.all(
      targetUsers.map(async (u) => {
        const s = await summarizeMonth(u.id, q.year, month0);
        return {
          userId: u.id,
          userName: u.name,
          email: u.email,
          department: u.departmentName,
          daysPresent: s.daysPresent,
          daysAbsent: s.daysAbsent,
          daysPaidLeave: s.daysPaidLeave,
          totalHours: s.totalHours,
          expectedHours: s.expectedHours,
          overtimeChunks: s.overtimeChunks,
        };
      })
    );

    // For single-user (self) views, also include a daily breakdown so the
    // client can render a per-day chart instead of a noisy "Top 1" bar.
    let daily:
      | {
          date: string;
          hours: number;
          status: "present" | "absent" | "paid_leave" | null;
          overtimeChunks: number;
          isHoliday: boolean;
          isWeekend: boolean;
        }[]
      | undefined;
    if (targetUsers.length === 1) {
      const u = targetUsers[0];
      const start = new Date(q.year, month0, 1);
      const end = new Date(q.year, month0 + 1, 0);
      const startKey = toDateKey(start);
      const endKey = toDateKey(end);
      const [records, hols] = await Promise.all([
        getRecordsBetween(u.id, startKey, endKey),
        getHolidaysBetween(startKey, endKey),
      ]);
      const recMap = new Map(records.map((r) => [r.date, r]));
      const holSet = new Set(hols.map((h) => h.date));
      daily = [];
      const daysInMonth = end.getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(q.year, month0, d);
        const key = toDateKey(dt);
        const rec = recMap.get(key);
        daily.push({
          date: key,
          hours:
            rec && rec.status === "present"
              ? computeWorkedHours(rec.clockIn, rec.clockOut)
              : 0,
          status: rec?.status ?? null,
          overtimeChunks: rec?.overtimeChunks ?? 0,
          isHoliday: holSet.has(key),
          isWeekend: isWeekend(dt),
        });
      }
    }

    return NextResponse.json({ rows, daily });
  } else {
    const rows = await Promise.all(
      targetUsers.map(async (u) => {
        const s = await summarizeYear(u.id, q.year);
        return {
          userId: u.id,
          userName: u.name,
          paidLeavesUsed: s.paidLeavesUsed,
          paidLeavesRemaining: s.paidLeavesRemaining,
          totalOvertimeChunks: s.totalOvertimeChunks,
          totalHours: s.totalHours,
        };
      })
    );
    return NextResponse.json({ rows });
  }
}

async function selectUsers(
  scope: "self" | "all",
  selfId: string,
  departmentId?: string
) {
  if (scope === "self") {
    const [u] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        departmentName: departments.name,
      })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(eq(users.id, selfId))
      .limit(1);
    return u ? [u] : [];
  }

  const where = departmentId
    ? and(eq(users.status, "active"), eq(users.departmentId, departmentId))
    : eq(users.status, "active");
  return await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      departmentName: departments.name,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(where)
    .orderBy(asc(users.name));
}
