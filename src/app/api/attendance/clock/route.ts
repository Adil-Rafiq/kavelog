import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attendanceRecords } from "@/db/schema";
import { auth } from "@/auth";
import { getUserContext, recomputeOvertime } from "@/lib/attendance";
import { toDateKey } from "@/lib/utils";

/**
 * POST /api/attendance/clock — toggles clock-in / clock-out for today.
 * If today's record has no clock-in: clock in.
 * Else if it has a clock-in but no clock-out: clock out.
 * Else: error (already complete).
 */
export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.status !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const ctx = await getUserContext(userId);

  const now = new Date();
  const today = toDateKey(now);

  const [existing] = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.userId, userId),
        eq(attendanceRecords.date, today)
      )
    )
    .limit(1);

  if (!existing) {
    const [created] = await db
      .insert(attendanceRecords)
      .values({
        userId,
        date: today,
        status: "present",
        clockIn: now,
      })
      .returning();
    return NextResponse.json({ action: "clock_in", record: created });
  }

  if (existing.status === "paid_leave") {
    return NextResponse.json(
      {
        error:
          "Today is marked as paid leave. Edit the day to switch to present.",
      },
      { status: 400 }
    );
  }

  if (!existing.clockIn) {
    const [updated] = await db
      .update(attendanceRecords)
      .set({
        clockIn: now,
        status: "present",
        updatedAt: new Date(),
      })
      .where(eq(attendanceRecords.id, existing.id))
      .returning();
    return NextResponse.json({ action: "clock_in", record: updated });
  }

  if (!existing.clockOut) {
    const overtime = recomputeOvertime(
      { clockIn: existing.clockIn, clockOut: now },
      ctx.shift
    );
    const [updated] = await db
      .update(attendanceRecords)
      .set({
        clockOut: now,
        overtimeChunks: overtime,
        status: "present",
        updatedAt: new Date(),
      })
      .where(eq(attendanceRecords.id, existing.id))
      .returning();
    return NextResponse.json({ action: "clock_out", record: updated });
  }

  return NextResponse.json(
    { error: "Already clocked in and out for today. Edit the day to update." },
    { status: 400 }
  );
}
