"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ClockButton } from "@/components/clock-button";
import { DoneCard } from "@/components/done-card";
import { toast } from "@/components/ui/toaster";
import type { Shift } from "@/lib/policy";

export function TodayPanel({
  initialClockIn,
  initialClockOut,
  initialOvertimeChunks,
  shift,
  shiftLabel,
}: {
  initialClockIn: string | null;
  initialClockOut: string | null;
  initialOvertimeChunks: number;
  shift: Shift;
  shiftLabel: string;
}) {
  const router = useRouter();
  const [clockInAt, setClockInAt] = React.useState(initialClockIn);
  const [clockOutAt, setClockOutAt] = React.useState(initialClockOut);
  const [overtimeChunks, setOvertimeChunks] = React.useState(
    initialOvertimeChunks
  );

  const state: "in" | "out" | "done" =
    clockInAt && clockOutAt ? "done" : clockInAt ? "in" : "out";

  async function action() {
    const res = await fetch("/api/attendance/clock", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({
        kind: "error",
        title: "Could not record",
        description: data?.error ?? "Please try again.",
      });
      return;
    }
    if (data.action === "clock_in") {
      setClockInAt(data.record.clockIn);
      setClockOutAt(null);
      setOvertimeChunks(0);
      toast({
        kind: "success",
        title: "Clocked in",
        description: "Have a great shift.",
      });
    } else {
      setClockOutAt(data.record.clockOut);
      setOvertimeChunks(data.record.overtimeChunks ?? 0);
      toast({
        kind: "success",
        title: "Clocked out",
        description: data.record.overtimeChunks
          ? `${data.record.overtimeChunks} overtime chunk(s) recorded.`
          : "See you tomorrow.",
      });
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {state === "done" && clockInAt && clockOutAt ? (
        <DoneCard
          clockInISO={clockInAt}
          clockOutISO={clockOutAt}
          overtimeChunks={overtimeChunks}
          shiftLabel={shiftLabel}
        />
      ) : (
        <ClockButton
          state={state}
          sinceISO={state === "in" ? clockInAt : null}
          onAction={action}
          shiftLabel={shiftLabel}
        />
      )}
      {state === "done" && (
        <div className="flex items-center justify-end px-1">
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1 text-xs text-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            Edit today
            <ArrowRight size={12} />
          </Link>
        </div>
      )}
      {!shift && (
        <p className="text-xs text-warning">
          No department assigned — your shift is using defaults. Contact admin
          to fix.
        </p>
      )}
    </div>
  );
}
