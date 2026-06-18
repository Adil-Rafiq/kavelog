/**
 * KaveLog policy and business logic.
 *
 * Implements the rules from policies.md:
 * - Shifts (first/second) and break windows
 * - 8 working hours + 1 break hour
 * - Overtime: 30-min checkout window, then 30-min chunks
 * - Paid leave caps (14/year, 1/month, 2 emergency)
 * - Holidays reduce monthly target hours (Option B)
 */

export type Shift = "first" | "second";

export const POLICY = {
  WORKING_HOURS_PER_DAY: 8,
  BREAK_HOURS_PER_DAY: 1,
  PAID_LEAVES_PER_YEAR: 14,
  PAID_LEAVES_PER_MONTH: 1,
  PAID_LEAVES_PER_MONTH_EMERGENCY: 2,
  CHECKOUT_WINDOW_MINUTES: 30,
  OVERTIME_CHUNK_MINUTES: 30,
} as const;

export interface ShiftConfig {
  startHour: number; // 0-23
  startMinute: number;
  endHour: number;
  endMinute: number;
  breakStartHour: number;
  breakStartMinute: number;
  breakEndHour: number;
  breakEndMinute: number;
  /** True if the shift crosses midnight (e.g., second shift 6PM-3AM). */
  crossesMidnight: boolean;
}

export const SHIFTS: Record<Shift, ShiftConfig> = {
  first: {
    startHour: 10,
    startMinute: 0,
    endHour: 19, // 7 PM
    endMinute: 0,
    breakStartHour: 13, // 1 PM
    breakStartMinute: 0,
    breakEndHour: 14, // 2 PM
    breakEndMinute: 0,
    crossesMidnight: false,
  },
  second: {
    startHour: 18, // 6 PM
    startMinute: 0,
    endHour: 3, // 3 AM next day
    endMinute: 0,
    breakStartHour: 22, // 10 PM
    breakStartMinute: 0,
    breakEndHour: 23, // 11 PM
    breakEndMinute: 0,
    crossesMidnight: true,
  },
};

export function shiftLabel(shift: Shift): string {
  if (shift === "first") return "10:00 AM – 7:00 PM";
  return "6:00 PM – 3:00 AM";
}

/**
 * Standard clock-in / clock-out times for a shift, as "HH:MM" 24-hour strings.
 * Used to auto-fill manual attendance entry when one side is left blank.
 */
export function shiftDefaultTimes(shift: Shift): {
  clockIn: string;
  clockOut: string;
} {
  const c = SHIFTS[shift];
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    clockIn: `${pad(c.startHour)}:${pad(c.startMinute)}`,
    clockOut: `${pad(c.endHour)}:${pad(c.endMinute)}`,
  };
}

/**
 * Compute total worked hours (excluding the 1-hour break) for a clock-in/out pair.
 * Returns 0 if either is missing or the pair is invalid.
 */
export function computeWorkedHours(
  clockIn: Date | null,
  clockOut: Date | null
): number {
  if (!clockIn || !clockOut) return 0;
  const ms = clockOut.getTime() - clockIn.getTime();
  if (ms <= 0) return 0;
  const totalHours = ms / (1000 * 60 * 60);
  // Subtract a fixed 1-hour break if the worked window is at least 5 hours
  // (simple heuristic — the policy assumes employees take their break).
  const workedHours = totalHours >= 5 ? totalHours - 1 : totalHours;
  return Math.max(0, workedHours);
}

/**
 * Round a Date up to the next :00 or :30 mark. Idempotent at exact half/full
 * hours. Drops seconds and milliseconds.
 */
export function roundUpToHalfHour(d: Date): Date {
  const out = new Date(d);
  out.setSeconds(0, 0);
  const m = out.getMinutes();
  if (m === 0 || m === 30) return out;
  if (m < 30) out.setMinutes(30);
  else {
    out.setMinutes(0);
    out.setHours(out.getHours() + 1);
  }
  return out;
}

/**
 * Compute overtime chunks earned for a clock-in/out pair.
 *
 * Eligibility starts at the LATER of:
 *   1. clockIn + 9h (8 worked + 1 break), rounded UP to the next :00 or :30
 *   2. shift end + 30-min checkout window
 *
 * Each fully-completed 30-min chunk after that point counts as one chunk.
 *
 * Example (first shift, ends 7 PM, clock-in 10:15 AM):
 *   - Personal end = 10:15 + 9h = 7:15 PM → round up to 7:30 PM
 *   - Window end   = 7:00 PM + 30 min    = 7:30 PM
 *   - OT starts at 7:30 PM
 *   - Clock-out 7:59 PM → 0 chunks
 *   - Clock-out 8:00 PM → 1 chunk
 *   - Clock-out 8:30 PM → 2 chunks
 */
export function computeOvertimeChunks(
  clockIn: Date | null,
  clockOut: Date | null,
  shift: Shift
): number {
  if (!clockIn || !clockOut) return 0;
  const personalEnd = roundUpToHalfHour(
    new Date(clockIn.getTime() + 9 * 60 * 60_000)
  );
  const shiftEnd = getShiftEndForDate(clockIn, shift);
  const windowEnd = new Date(
    shiftEnd.getTime() + POLICY.CHECKOUT_WINDOW_MINUTES * 60_000
  );
  const otStart = new Date(
    Math.max(personalEnd.getTime(), windowEnd.getTime())
  );
  const otMs = clockOut.getTime() - otStart.getTime();
  if (otMs <= 0) return 0;
  const chunkMs = POLICY.OVERTIME_CHUNK_MINUTES * 60_000;
  return Math.floor(otMs / chunkMs);
}

/**
 * Get the shift's end Date for the day represented by a clock-in timestamp.
 * Handles second shift correctly: end is 3 AM the next calendar day.
 */
export function getShiftEndForDate(reference: Date, shift: Shift): Date {
  const config = SHIFTS[shift];
  const end = new Date(reference);
  if (config.crossesMidnight) {
    end.setDate(end.getDate() + 1);
  }
  end.setHours(config.endHour, config.endMinute, 0, 0);
  return end;
}

/**
 * Get the shift's start Date for the day represented by a reference timestamp.
 */
export function getShiftStartForDate(reference: Date, shift: Shift): Date {
  const config = SHIFTS[shift];
  const start = new Date(reference);
  start.setHours(config.startHour, config.startMinute, 0, 0);
  return start;
}

/**
 * Number of weekdays (Mon-Fri) in a given month.
 */
export function weekdaysInMonth(year: number, month0: number): number {
  const last = new Date(year, month0 + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= last; d++) {
    const day = new Date(year, month0, d).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

/**
 * Compute the expected working hours for a month, adjusted for holidays and
 * paid leave.
 *
 * Option B: each weekday holiday reduces the target by 8 hours. Paid-leave
 * weekdays are treated the same way, so taking approved leave doesn't open an
 * hours deficit — the day is "excused", not unpaid.
 *
 * Both counts must already be filtered to weekdays in the given month, and must
 * not overlap (a day counted as a holiday must not also be counted as paid
 * leave) or the target would be reduced twice for one date.
 */
export function expectedMonthlyHours(
  year: number,
  month0: number,
  holidayWeekdaysInMonth: number,
  paidLeaveWeekdaysInMonth = 0
): number {
  const excused = holidayWeekdaysInMonth + paidLeaveWeekdaysInMonth;
  const workdays = weekdaysInMonth(year, month0) - excused;
  return Math.max(0, workdays) * POLICY.WORKING_HOURS_PER_DAY;
}

/**
 * Check whether a date is a weekend (Sat/Sun).
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}
