import { NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { attendanceRecords, holidays, users } from "@/db/schema";
import { isWeekend, toDateKey } from "@/lib/utils";

/**
 * Cron endpoint: marks any active employee as Absent for yesterday if they
 * have no record yet AND yesterday was a weekday AND not a holiday.
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

  // Find active users with no record for that date
  const activeUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.status, "active"));

  const records = await db
    .select({ userId: attendanceRecords.userId })
    .from(attendanceRecords)
    .where(eq(attendanceRecords.date, dateKey));
  const recorded = new Set(records.map((r) => r.userId));

  const toCreate = activeUsers
    .filter((u) => !recorded.has(u.id))
    .map((u) => ({
      userId: u.id,
      date: dateKey,
      status: "absent" as const,
    }));

  if (toCreate.length > 0) {
    await db.insert(attendanceRecords).values(toCreate);
  }

  return NextResponse.json({
    ok: true,
    dateKey,
    markedAbsent: toCreate.length,
  });
}
