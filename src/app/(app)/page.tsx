import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { auth } from "@/auth";
import {
  getHolidaysBetween,
  getRecord,
  getUserContext,
  summarizeMonth,
  summarizeYear,
} from "@/lib/attendance";
import { formatHours, toDateKey } from "@/lib/utils";
import { shiftLabel } from "@/lib/policy";
import { TodayPanel } from "./today-panel";
import { Card, CardContent } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { DotDivider } from "@/components/ui/divider";
import { POLICY } from "@/lib/policy";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;
  const ctx = await getUserContext(userId);

  const today = new Date();
  const todayKey = toDateKey(today);
  const horizonKey = toDateKey(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + 60)
  );
  const [todayRec, month, year, upcomingHolidays] = await Promise.all([
    getRecord(userId, todayKey),
    summarizeMonth(userId, today.getFullYear(), today.getMonth()),
    summarizeYear(userId, today.getFullYear()),
    getHolidaysBetween(todayKey, horizonKey),
  ]);
  const todaysHoliday =
    upcomingHolidays.find((h) => h.date === todayKey)?.name ?? null;
  const nextHoliday =
    upcomingHolidays.find((h) => h.date > todayKey) ?? null;

  const clockInISO = todayRec?.clockIn?.toISOString() ?? null;
  const clockOutISO = todayRec?.clockOut?.toISOString() ?? null;
  const overtimeChunks = todayRec?.overtimeChunks ?? 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Greeting header */}
      <div className="flex flex-col gap-1.5 animate-reveal">
        <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {ctx.departmentName ? ctx.departmentName : "Unassigned"}
        </span>
        <h1 className="text-3xl text-foreground">
          <span className="wordmark text-primary mr-2">Hello,</span>
          {session.user.name?.split(" ")[0] || "there"}
        </h1>
        {!todaysHoliday && nextHoliday && (
          <p className="mt-1 text-xs text-muted-foreground">
            Next holiday:{" "}
            <span className="text-foreground">{nextHoliday.name}</span>{" "}
            <span className="tabular text-muted-foreground/80">
              · {formatHolidayDate(nextHoliday.date, todayKey)}
            </span>
          </p>
        )}
      </div>

      {todaysHoliday && (
        <div className="flex items-center gap-3 rounded-[12px] border border-info/40 bg-info/10 px-4 py-3 ring-1 ring-info/20 animate-reveal">
          <Sparkles size={16} className="shrink-0 text-info" />
          <div className="flex min-w-0 flex-col">
            <span className="text-[10px] uppercase tracking-[0.22em] text-info">
              Holiday today
            </span>
            <span className="truncate text-sm text-foreground">
              {todaysHoliday}
            </span>
          </div>
        </div>
      )}

      {/* HERO Clock In/Out */}
      <div className="animate-reveal delay-100">
        <TodayPanel
          initialClockIn={clockInISO}
          initialClockOut={clockOutISO}
          initialOvertimeChunks={overtimeChunks}
          shift={ctx.shift}
          shiftLabel={shiftLabel(ctx.shift)}
        />
      </div>

      <DotDivider />

      {/* This month */}
      <section className="animate-reveal delay-150">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg text-foreground">This month</h2>
            <p className="text-xs text-muted-foreground">
              {today.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Live
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card className="p-5">
            <Stat
              label="Hours worked"
              value={formatHours(month.totalHours)}
              unit={`/ ${month.expectedHours.toFixed(0)} h`}
              hint={
                <PaceHint
                  worked={month.hoursWorkedToDate}
                  expected={month.expectedHoursToDate}
                />
              }
            />
          </Card>
          <Card className="p-5">
            <Stat
              label="Days present"
              value={month.daysPresent}
              hint={`${month.daysAbsent} absent · ${month.daysPaidLeave} leave`}
            />
          </Card>
          <Card className="p-5">
            <Stat
              label="Overtime chunks"
              value={month.overtimeChunks}
              unit="× 30m"
              hint="After 30-min checkout window"
            />
          </Card>
          <Card className="p-5">
            <Stat
              label="Paid leaves"
              value={`${month.paidLeavesUsedThisMonth}`}
              unit={`/ ${POLICY.PAID_LEAVES_PER_MONTH}`}
              hint={`${POLICY.PAID_LEAVES_PER_MONTH_EMERGENCY} max in emergency`}
            />
          </Card>
        </div>
      </section>

      {/* Year-to-date */}
      <section className="animate-reveal delay-200">
        <div className="mb-4">
          <h2 className="text-lg text-foreground">Year to date</h2>
          <p className="text-xs text-muted-foreground tabular">
            01 Jan {year.year} — {today.toLocaleDateString()}
          </p>
        </div>
        <Card>
          <CardContent className="grid grid-cols-2 gap-6 p-6 md:grid-cols-4">
            <Stat
              label="Total hours"
              value={formatHours(year.totalHours)}
              unit="h"
            />
            <Stat
              label="Overtime chunks"
              value={year.totalOvertimeChunks}
              unit="× 30m"
            />
            <Stat
              label="Paid leaves used"
              value={`${year.paidLeavesUsed}`}
              unit={`/ ${POLICY.PAID_LEAVES_PER_YEAR}`}
            />
            <Stat
              label="Leaves remaining"
              value={year.paidLeavesRemaining}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

/**
 * Pace indicator — are you ahead of or behind the target for the working days
 * that have already elapsed this month? Both inputs exclude the in-progress
 * day (see summarizeMonth). A gentle nudge, not a verdict: "behind" is amber,
 * not red.
 */
function PaceHint({ worked, expected }: { worked: number; expected: number }) {
  if (expected <= 0 && worked <= 0) {
    return (
      <span className="text-muted-foreground">
        Pace starts after your first workday
      </span>
    );
  }
  const delta = worked - expected;
  if (Math.abs(delta) < 0.5) {
    return <span className="text-success">On pace</span>;
  }
  const ahead = delta > 0;
  return (
    <span className={ahead ? "text-success" : "text-warning"}>
      {ahead ? "▲" : "▼"} {formatHours(Math.abs(delta))}{" "}
      {ahead ? "ahead of pace" : "behind pace"}
    </span>
  );
}

function formatHolidayDate(holidayKey: string, todayKey: string): string {
  const d = new Date(holidayKey + "T00:00:00");
  const label = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const [hy, hm, hd] = holidayKey.split("-").map(Number);
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const days = Math.round(
    (Date.UTC(hy, hm - 1, hd) - Date.UTC(ty, tm - 1, td)) /
      (1000 * 60 * 60 * 24)
  );
  if (days === 1) return `${label} (tomorrow)`;
  return `${label} (in ${days} days)`;
}
