"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/ui/stat";
import { DayEditor } from "./day-editor";
import type { MonthSummary } from "@/lib/attendance";
import { computeWorkedHours, type Shift } from "@/lib/policy";
import { formatHours } from "@/lib/utils";

interface RecordView {
  id: string;
  date: string;
  status: "present" | "absent" | "paid_leave";
  clockIn: string | null;
  clockOut: string | null;
  overtimeChunks: number;
  notes: string | null;
  editedByAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export function CalendarView({
  year,
  month0,
  records,
  holidays,
  summary,
  shift,
  isAdmin,
  targetUserId,
}: {
  year: number;
  month0: number;
  records: RecordView[];
  holidays: { date: string; name: string }[];
  summary: MonthSummary;
  shift: Shift;
  isAdmin: boolean;
  targetUserId: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string | null>(null);

  // Track the month the UI is *displaying*, separate from the month whose data
  // has actually loaded from the server. When the user clicks prev/next we
  // bump the displayed month immediately, then kick off the server fetch in
  // a transition. Until props catch up we render skeletons in the data slots.
  const [displayedYear, setDisplayedYear] = React.useState(year);
  const [displayedMonth0, setDisplayedMonth0] = React.useState(month0);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setDisplayedYear(year);
    setDisplayedMonth0(month0);
  }, [year, month0]);

  const isLoading =
    isPending || displayedYear !== year || displayedMonth0 !== month0;

  function navigate(targetYear: number, targetMonth0: number) {
    setDisplayedYear(targetYear);
    setDisplayedMonth0(targetMonth0);
    startTransition(() => {
      router.push(`/calendar?y=${targetYear}&m=${targetMonth0 + 1}`);
    });
  }

  function navigateToday() {
    const t = new Date();
    setDisplayedYear(t.getFullYear());
    setDisplayedMonth0(t.getMonth());
    startTransition(() => {
      router.push("/calendar");
    });
  }

  const recordMap = React.useMemo(() => {
    const m = new Map<string, RecordView>();
    for (const r of records) m.set(r.date, r);
    return m;
  }, [records]);

  const holidayMap = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const h of holidays) m.set(h.date, h.name);
    return m;
  }, [holidays]);

  const monthName = new Date(displayedYear, displayedMonth0).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" },
  );

  const prevMonth = new Date(displayedYear, displayedMonth0 - 1);
  const nextMonth = new Date(displayedYear, displayedMonth0 + 1);

  // Build calendar grid for the displayed (optimistic) month
  const first = new Date(displayedYear, displayedMonth0, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(displayedYear, displayedMonth0 + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++)
    cells.push(new Date(displayedYear, displayedMonth0, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = toDateKey(new Date());

  return (
    <div className="flex flex-col gap-6">
      {/* Header & nav */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl text-foreground sm:text-2xl">
            {monthName}
          </h1>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:text-xs">
            Attendance calendar
          </p>
        </div>
        <div className="flex items-center gap-1 self-end sm:self-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              navigate(prevMonth.getFullYear(), prevMonth.getMonth())
            }
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </Button>
          <Button variant="outline" size="sm" onClick={navigateToday}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              navigate(nextMonth.getFullYear(), nextMonth.getMonth())
            }
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4">
          {isLoading ? (
            <StatSkeleton label="Hours worked" />
          ) : (
            <Stat
              label="Hours worked"
              value={formatHours(summary.totalHours)}
              unit={`/ ${summary.expectedHours.toFixed(0)} h`}
            />
          )}
        </Card>
        <Card className="p-4">
          {isLoading ? (
            <StatSkeleton label="Present" />
          ) : (
            <Stat label="Present" value={summary.daysPresent} unit="days" />
          )}
        </Card>
        <Card className="p-4">
          {isLoading ? (
            <StatSkeleton label="Absent" />
          ) : (
            <Stat label="Absent" value={summary.daysAbsent} unit="days" />
          )}
        </Card>
        <Card className="p-4">
          {isLoading ? (
            <StatSkeleton label="Paid leave" />
          ) : (
            <Stat
              label="Paid leave"
              value={summary.daysPaidLeave}
              unit="days"
            />
          )}
        </Card>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <LegendChip status="present" label="Present" />
        <LegendChip status="absent" label="Absent" />
        <LegendChip status="leave" label="Paid leave" />
        <LegendChip status="holiday" label="Holiday" />
        <LegendChip status="weekend" label="Weekend" />
      </div>

      {/* Grid */}
      <Card className="p-3 md:p-4">
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 gap-1 pb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  className="px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, idx) => {
                if (!d)
                  return <div key={idx} className="h-16 sm:h-20 md:h-24" />;
                const key = toDateKey(d);
                const rec = isLoading ? undefined : recordMap.get(key);
                const holiday = isLoading ? undefined : holidayMap.get(key);
                const isToday = key === todayKey;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const status:
                  | "present"
                  | "absent"
                  | "leave"
                  | "weekend"
                  | "holiday"
                  | null =
                  rec?.status === "present"
                    ? "present"
                    : rec?.status === "absent"
                      ? "absent"
                      : rec?.status === "paid_leave"
                        ? "leave"
                        : holiday
                          ? "holiday"
                          : isWeekend
                            ? "weekend"
                            : null;

                return (
                  <button
                    key={idx}
                    onClick={() => !isLoading && setSelected(key)}
                    disabled={isLoading}
                    className={cn(
                      "group relative flex h-16 min-w-0 flex-col items-start justify-between overflow-hidden rounded-[8px] border p-1.5 text-left transition-colors hover:bg-secondary/40 sm:h-20 sm:p-2 md:h-24",
                      isToday
                        ? "border-primary/60 bg-primary/5"
                        : holiday
                          ? "border-info/50 ring-1 ring-info/30"
                          : "border-border/60",
                      // rec status bg wins; otherwise holiday tint, otherwise nothing
                      rec?.status === "present" && "bg-success/5",
                      rec?.status === "absent" && "bg-destructive/5",
                      rec?.status === "paid_leave" && "bg-warning/5",
                      holiday && !rec && "bg-info/10",
                      status === "weekend" && "opacity-70",
                      isLoading && "cursor-default",
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-1">
                      <span
                        className={cn(
                          "font-mono text-xs tabular sm:text-sm",
                          isToday ? "text-primary" : "text-foreground",
                        )}
                      >
                        {String(d.getDate()).padStart(2, "0")}
                      </span>
                      <span className="flex items-center gap-1">
                        {holiday && rec && <StatusDot status="holiday" />}
                        {status && <StatusDot status={status} />}
                      </span>
                    </div>
                    <div className="flex w-full min-w-0 flex-col gap-0.5">
                      {isLoading ? (
                        <CellSkeleton />
                      ) : (
                        <>
                          {/* Mobile: compact summary (worked hours + OT badge only). */}
                          {rec?.clockIn && rec?.clockOut && (
                            <span className="truncate font-mono text-[10px] text-foreground/80 tabular sm:hidden">
                              {formatHours(
                                computeWorkedHours(
                                  new Date(rec.clockIn),
                                  new Date(rec.clockOut),
                                ),
                              )}
                              h
                            </span>
                          )}
                          {/* Desktop: full clock-in/out range + worked hours. */}
                          {rec?.clockIn && (
                            <span className="hidden truncate font-mono text-[10px] text-muted-foreground tabular sm:inline">
                              {formatTimeShort(rec.clockIn)}
                              {rec.clockOut &&
                                ` → ${formatTimeShort(rec.clockOut)}`}
                            </span>
                          )}
                          {rec?.clockIn && rec?.clockOut && (
                            <span className="hidden font-mono text-[10px] text-foreground/80 tabular sm:inline">
                              {formatHours(
                                computeWorkedHours(
                                  new Date(rec.clockIn),
                                  new Date(rec.clockOut),
                                ),
                              )}
                              h
                            </span>
                          )}
                          {rec?.overtimeChunks ? (
                            <span className="truncate text-[10px] text-warning tabular">
                              +{rec.overtimeChunks} OT
                            </span>
                          ) : null}
                          {holiday && (
                            <span className="truncate text-[10px] font-medium text-info">
                              {holiday}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {selected && (
        <DayEditor
          dateKey={selected}
          record={recordMap.get(selected) ?? null}
          holiday={holidayMap.get(selected) ?? null}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            router.refresh();
          }}
          isAdmin={isAdmin}
          targetUserId={targetUserId}
        />
      )}
    </div>
  );
}

function StatSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="h-7 w-16 animate-pulse rounded bg-muted-foreground/15" />
    </div>
  );
}

function CellSkeleton() {
  return (
    <span className="h-2.5 w-3/5 animate-pulse rounded bg-muted-foreground/15" />
  );
}

function LegendChip({
  status,
  label,
}: {
  status: "present" | "absent" | "leave" | "weekend" | "holiday";
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot status={status} />
      <span>{label}</span>
    </span>
  );
}

function formatTimeShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  });
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
