"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/ui/stat";
import { DayEditor } from "./day-editor";
import type { MonthSummary } from "@/lib/attendance";
import type { Shift } from "@/lib/policy";

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

  const monthName = new Date(year, month0).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const prevMonth = new Date(year, month0 - 1);
  const nextMonth = new Date(year, month0 + 1);

  // Build calendar grid
  const first = new Date(year, month0, 1);
  const startWeekday = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month0, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = toDateKey(new Date());

  return (
    <div className="flex flex-col gap-6">
      {/* Header & nav */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl text-foreground">{monthName}</h1>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Attendance calendar
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              router.push(
                `/calendar?y=${prevMonth.getFullYear()}&m=${prevMonth.getMonth() + 1}`
              )
            }
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/calendar")}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              router.push(
                `/calendar?y=${nextMonth.getFullYear()}&m=${nextMonth.getMonth() + 1}`
              )
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
          <Stat
            label="Hours worked"
            value={summary.totalHours.toFixed(1)}
            unit={`/ ${summary.expectedHours.toFixed(0)} h`}
          />
        </Card>
        <Card className="p-4">
          <Stat label="Present" value={summary.daysPresent} unit="days" />
        </Card>
        <Card className="p-4">
          <Stat label="Absent" value={summary.daysAbsent} unit="days" />
        </Card>
        <Card className="p-4">
          <Stat
            label="Paid leave"
            value={summary.daysPaidLeave}
            unit="days"
          />
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
            if (!d) return <div key={idx} className="h-20 md:h-24" />;
            const key = toDateKey(d);
            const rec = recordMap.get(key);
            const isToday = key === todayKey;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const holiday = holidayMap.get(key);
            const status: "present" | "absent" | "leave" | "weekend" | "holiday" | null =
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
                onClick={() => setSelected(key)}
                className={cn(
                  "group relative flex h-20 flex-col items-start justify-between rounded-[8px] border p-2 text-left transition-colors hover:bg-secondary/40 md:h-24",
                  isToday
                    ? "border-primary/60 bg-primary/5"
                    : "border-border/60",
                  status === "present" && "bg-success/5",
                  status === "absent" && "bg-destructive/5",
                  status === "leave" && "bg-warning/5",
                  status === "holiday" && "bg-info/5",
                  status === "weekend" && "opacity-70"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span
                    className={cn(
                      "font-mono text-sm tabular",
                      isToday ? "text-primary" : "text-foreground"
                    )}
                  >
                    {String(d.getDate()).padStart(2, "0")}
                  </span>
                  {status && <StatusDot status={status} />}
                </div>
                <div className="flex flex-col gap-0.5">
                  {rec?.clockIn && (
                    <span className="font-mono text-[10px] text-muted-foreground tabular">
                      {formatTimeShort(rec.clockIn)}
                      {rec.clockOut && ` → ${formatTimeShort(rec.clockOut)}`}
                    </span>
                  )}
                  {rec?.overtimeChunks ? (
                    <span className="text-[10px] text-warning tabular">
                      +{rec.overtimeChunks} OT
                    </span>
                  ) : null}
                  {holiday && !rec && (
                    <span className="truncate text-[10px] text-info">{holiday}</span>
                  )}
                </div>
              </button>
            );
          })}
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
