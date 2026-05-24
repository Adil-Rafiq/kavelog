import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attendanceRecords, notifications, users } from "@/db/schema";
import { auth } from "@/auth";
import { getUserContext, recomputeOvertime } from "@/lib/attendance";
import { notify } from "@/lib/notifications";

const upsertSchema = z.object({
  /** Target user id. If omitted, defaults to the current session user. Admins can specify any user id. */
  userId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["present", "absent", "paid_leave"]),
  clockIn: z.string().datetime().nullable().optional(),
  clockOut: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.status !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const targetUserId = parsed.data.userId ?? session.user.id;

  // Only admin can edit other users' records.
  if (targetUserId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ctx = await getUserContext(targetUserId);
  const editedByAdmin =
    session.user.role === "admin" && targetUserId !== session.user.id;

  const clockIn = parsed.data.clockIn ? new Date(parsed.data.clockIn) : null;
  const clockOut = parsed.data.clockOut ? new Date(parsed.data.clockOut) : null;

  // For non-present statuses, drop times.
  const safeClockIn = parsed.data.status === "present" ? clockIn : null;
  const safeClockOut = parsed.data.status === "present" ? clockOut : null;

  const overtimeChunks =
    parsed.data.status === "present"
      ? recomputeOvertime({ clockIn: safeClockIn, clockOut: safeClockOut }, ctx.shift)
      : 0;

  const [existing] = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.userId, targetUserId),
        eq(attendanceRecords.date, parsed.data.date)
      )
    )
    .limit(1);

  let record;
  if (existing) {
    [record] = await db
      .update(attendanceRecords)
      .set({
        status: parsed.data.status,
        clockIn: safeClockIn,
        clockOut: safeClockOut,
        notes: parsed.data.notes ?? null,
        overtimeChunks,
        editedByAdmin: editedByAdmin || existing.editedByAdmin,
        updatedAt: new Date(),
      })
      .where(eq(attendanceRecords.id, existing.id))
      .returning();
  } else {
    [record] = await db
      .insert(attendanceRecords)
      .values({
        userId: targetUserId,
        date: parsed.data.date,
        status: parsed.data.status,
        clockIn: safeClockIn,
        clockOut: safeClockOut,
        notes: parsed.data.notes ?? null,
        overtimeChunks,
        editedByAdmin,
      })
      .returning();
  }

  if (editedByAdmin) {
    const [target] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);
    await notify({
      userId: targetUserId,
      type: "record_edited",
      title: "Your attendance was edited",
      message: `An admin updated your record for ${parsed.data.date}.`,
      link: "/calendar",
    });
    void target;
  }

  return NextResponse.json({ ok: true, record });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.status !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const userId = url.searchParams.get("userId");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Missing or invalid date" }, { status: 400 });
  }

  const targetUserId = userId ?? session.user.id;
  if (targetUserId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [existing] = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(eq(attendanceRecords.userId, targetUserId), eq(attendanceRecords.date, date))
    )
    .limit(1);

  if (existing) {
    await db.delete(attendanceRecords).where(eq(attendanceRecords.id, existing.id));

    if (session.user.role === "admin" && targetUserId !== session.user.id) {
      const [target] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);
      await notify({
        userId: targetUserId,
        type: "record_deleted",
        title: "Your attendance was changed",
        message: `An admin removed your attendance record for ${date}.`,
        link: "/calendar",
      });
      void target;
    }
  }

  return NextResponse.json({ ok: true });
}
