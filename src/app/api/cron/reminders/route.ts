import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attendanceRecords,
  departments,
  holidays,
  pushSubscriptions,
  users,
  type AttendanceRecord,
  type PushSubscriptionRow,
} from "@/db/schema";
import {
  APP_TIME_ZONE,
  dateKeyInZone,
  dateKeyIsWeekend,
  shiftLabel,
  type Shift,
} from "@/lib/policy";
import { sendToSubscriptions, type PushPayload } from "@/lib/push";

export const runtime = "nodejs";

/**
 * Push-only attendance reminders, triggered by an external scheduler (GitHub
 * Actions) at fixed office-time slots. See `.github/workflows/reminders.yml`.
 *
 *   first_yesterday   09:45 PKT  1st shift — review auto-fill / log missing day
 *   first_clockin     10:30 PKT  1st shift — haven't clocked in yet
 *   second_yesterday  17:45 PKT  2nd shift — review auto-fill / log missing day
 *   first_clockout    19:15 PKT  1st shift — still clocked in, no clock-out
 *
 * A reminder only goes to users who opted in (`remindersEnabled`) AND have a
 * live push subscription. Weekends and holidays (by the relevant date) are
 * skipped. Protected by CRON_SECRET (Bearer header), like the auto-log cron.
 */
const SLOTS = [
  "first_yesterday",
  "first_clockin",
  "second_yesterday",
  "first_clockout",
] as const;
type Slot = (typeof SLOTS)[number];

async function handler(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slot = new URL(req.url).searchParams.get("slot");
  if (!slot || !SLOTS.includes(slot as Slot)) {
    return NextResponse.json(
      { error: "Invalid or missing slot", allowed: SLOTS },
      { status: 400 }
    );
  }

  const now = new Date();
  const todayKey = dateKeyInZone(now, APP_TIME_ZONE);
  const yesterdayKey = dateKeyInZone(
    new Date(now.getTime() - 24 * 60 * 60 * 1000),
    APP_TIME_ZONE
  );

  switch (slot as Slot) {
    case "first_yesterday":
      return runYesterday("first", yesterdayKey);
    case "second_yesterday":
      return runYesterday("second", yesterdayKey);
    case "first_clockin":
      return runClockIn(todayKey);
    case "first_clockout":
      return runClockOut(todayKey);
  }
}

// GitHub Actions POSTs; GET stays handy for manual testing in a browser/curl.
export async function GET(req: Request) {
  return handler(req);
}
export async function POST(req: Request) {
  return handler(req);
}

// ---------------------------------------------------------------------------
// Slot handlers
// ---------------------------------------------------------------------------

async function runYesterday(shift: Shift, dateKey: string) {
  const skip = await weekendOrHoliday(dateKey);
  if (skip) return NextResponse.json({ ok: true, skipped: skip, dateKey });

  const { subsByUser, recByUser, userIds } = await gather(shift, dateKey);

  let sent = 0;
  for (const userId of userIds) {
    const rec = recByUser.get(userId);
    let payload: PushPayload | null = null;

    if (rec?.autoLogged) {
      payload = {
        title: "Yesterday was auto-logged",
        body: `We filled ${labelDate(dateKey)} as ${shiftLabel(
          shift
        )}. Tap to adjust if your times were different.`,
        url: "/calendar",
        tag: "kavelog-yesterday",
      };
    } else if (!rec) {
      payload = {
        title: "Yesterday isn't logged",
        body: `${labelDate(dateKey)} has no attendance record. Tap to add it.`,
        url: "/calendar",
        tag: "kavelog-yesterday",
      };
    } else if (
      rec.status === "present" &&
      rec.clockIn != null &&
      rec.clockOut == null
    ) {
      payload = {
        title: "Yesterday is incomplete",
        body: `You clocked in on ${labelDate(
          dateKey
        )} but never clocked out. Tap to fix it.`,
        url: "/calendar",
        tag: "kavelog-yesterday",
      };
    }
    // A complete manual record, or an absent/paid-leave day, needs nothing.

    if (payload) {
      sent += await sendToSubscriptions(subsByUser.get(userId) ?? [], payload);
    }
  }

  return NextResponse.json({ ok: true, slot: "yesterday", shift, dateKey, sent });
}

async function runClockIn(dateKey: string) {
  const skip = await weekendOrHoliday(dateKey);
  if (skip) return NextResponse.json({ ok: true, skipped: skip, dateKey });

  const { subsByUser, recByUser, userIds } = await gather("first", dateKey);

  let sent = 0;
  for (const userId of userIds) {
    const rec = recByUser.get(userId);
    // Nudge only if there's no clock-in yet and the day isn't already settled
    // (marked absent / paid-leave, or already clocked in). Auto-log users are
    // included on purpose — clocking in live records their real time.
    const needsClockIn =
      !rec || (rec.status === "present" && rec.clockIn == null);
    if (!needsClockIn) continue;

    sent += await sendToSubscriptions(subsByUser.get(userId) ?? [], {
      title: "Don't forget to clock in",
      body: "Your shift has started and you haven't clocked in yet.",
      url: "/",
      tag: "kavelog-clockin",
    });
  }

  return NextResponse.json({ ok: true, slot: "clockin", dateKey, sent });
}

async function runClockOut(dateKey: string) {
  const skip = await weekendOrHoliday(dateKey);
  if (skip) return NextResponse.json({ ok: true, skipped: skip, dateKey });

  const { subsByUser, recByUser, userIds } = await gather("first", dateKey);

  let sent = 0;
  for (const userId of userIds) {
    const rec = recByUser.get(userId);
    const openClockIn =
      rec?.status === "present" && rec.clockIn != null && rec.clockOut == null;
    if (!openClockIn) continue;

    sent += await sendToSubscriptions(subsByUser.get(userId) ?? [], {
      title: "Still clocked in",
      body: "Don't forget to clock out for today.",
      url: "/",
      tag: "kavelog-clockout",
    });
  }

  return NextResponse.json({ ok: true, slot: "clockout", dateKey, sent });
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Returns "weekend" | "holiday" if the date should be skipped, else null. */
async function weekendOrHoliday(dateKey: string): Promise<string | null> {
  if (dateKeyIsWeekend(dateKey)) return "weekend";
  const [h] = await db
    .select({ id: holidays.id })
    .from(holidays)
    .where(eq(holidays.date, dateKey))
    .limit(1);
  return h ? "holiday" : null;
}

/**
 * Collect the opted-in, subscribed users of a shift plus their record for the
 * relevant date — everything a slot handler needs, in three queries.
 */
async function gather(shift: Shift, dateKey: string) {
  const rows = await db
    .select({ id: users.id, shift: departments.shift })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(
      and(eq(users.status, "active"), eq(users.remindersEnabled, true))
    );

  // A user with no department defaults to the first shift (matches the app).
  const userIds = rows
    .filter((r) => ((r.shift as Shift) ?? "first") === shift)
    .map((r) => r.id);

  const subsByUser = new Map<string, PushSubscriptionRow[]>();
  const recByUser = new Map<string, AttendanceRecord>();
  if (userIds.length === 0) return { subsByUser, recByUser, userIds };

  const [subs, recs] = await Promise.all([
    db
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, userIds)),
    db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.date, dateKey),
          inArray(attendanceRecords.userId, userIds)
        )
      ),
  ]);

  for (const s of subs) {
    const list = subsByUser.get(s.userId) ?? [];
    list.push(s);
    subsByUser.set(s.userId, list);
  }
  for (const r of recs) recByUser.set(r.userId, r);

  // Only users with at least one live subscription are worth processing.
  const subscribed = userIds.filter((id) => subsByUser.has(id));
  return { subsByUser, recByUser, userIds: subscribed };
}

/** e.g. "Mon, Jul 13" — a fixed calendar-date label, timezone-independent. */
function labelDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
