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
 * Compute overtime chunks earned for a given shift and clock-out time.
 *
 * Rule (from policy):
 *   - Shift end + 30 min checkout window does NOT count.
 *   - Each subsequent 30-min chunk fully completed counts as 1 chunk.
 *
 * Example for first shift (ends 7 PM):
 *   - Clock-out at 7:25 PM → 0 chunks (within window)
 *   - Clock-out at 7:30 PM → 0 chunks (window just closed, no overtime yet)
 *   - Clock-out at 8:00 PM → 1 chunk (7:30–8:00 PM)
 *   - Clock-out at 8:30 PM → 2 chunks
 *   - Clock-out at 8:45 PM → 2 chunks (third chunk not yet complete)
 */
export function computeOvertimeChunks(
  clockIn: Date | null,
  clockOut: Date | null,
  shift: Shift
): number {
  if (!clockIn || !clockOut) return 0;
  const shiftEnd = getShiftEndForDate(clockIn, shift);
  const windowEnd = new Date(
    shiftEnd.getTime() + POLICY.CHECKOUT_WINDOW_MINUTES * 60_000
  );
  const overtimeMs = clockOut.getTime() - windowEnd.getTime();
  if (overtimeMs <= 0) return 0;
  const chunkMs = POLICY.OVERTIME_CHUNK_MINUTES * 60_000;
  return Math.floor(overtimeMs / chunkMs);
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
 * Compute the expected working hours for a month, adjusted for holidays.
 * Option B: each holiday reduces target by 8 hours.
 *
 * Holidays passed in must already be filtered to the given month and weekdays.
 */
export function expectedMonthlyHours(
  year: number,
  month0: number,
  holidayWeekdaysInMonth: number
): number {
  const workdays = weekdaysInMonth(year, month0) - holidayWeekdaysInMonth;
  return Math.max(0, workdays) * POLICY.WORKING_HOURS_PER_DAY;
}

/**
 * Check whether a date is a weekend (Sat/Sun).
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}
