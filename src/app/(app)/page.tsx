import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getRecord,
  getUserContext,
  summarizeMonth,
  summarizeYear,
} from "@/lib/attendance";
import { formatHours, toDateKey } from "@/lib/utils";
import { shiftLabel } from "@/lib/policy";
import { TodayPanel } from "./today-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [todayRec, month, year] = await Promise.all([
    getRecord(userId, todayKey),
    summarizeMonth(userId, today.getFullYear(), today.getMonth()),
    summarizeYear(userId, today.getFullYear()),
  ]);

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
      </div>

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
              hint={`Target adjusted for holidays`}
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
