"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClockButton } from "@/components/clock-button";
import { toast } from "@/components/ui/toaster";
import { Badge } from "@/components/ui/badge";
import type { Shift } from "@/lib/policy";

export function TodayPanel({
  state: initialState,
  sinceISO: initialSince,
  lastClockOut,
  shift,
  shiftLabel,
}: {
  state: "in" | "out";
  sinceISO: string | null;
  lastClockOut: string | null;
  shift: Shift;
  shiftLabel: string;
}) {
  const router = useRouter();
  const [state, setState] = React.useState(initialState);
  const [sinceISO, setSinceISO] = React.useState(initialSince);
  const [outAt, setOutAt] = React.useState(lastClockOut);

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
      setState("in");
      setSinceISO(data.record.clockIn);
      setOutAt(null);
      toast({ kind: "success", title: "Clocked in", description: "Have a great shift." });
    } else {
      setState("out");
      setOutAt(data.record.clockOut);
      setSinceISO(null);
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

  const formattedOut = outAt
    ? new Date(outAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : null;

  return (
    <div className="flex flex-col gap-3">
      <ClockButton
        state={state}
        sinceISO={sinceISO}
        onAction={action}
        shiftLabel={shiftLabel}
      />
      {state === "out" && formattedOut && (
        <div className="flex items-center gap-2 px-1">
          <Badge variant="present">Done for today</Badge>
          <span className="text-xs text-muted-foreground tabular">
            Clocked out at {formattedOut}
          </span>
        </div>
      )}
      {!shift && (
        <p className="text-xs text-warning">
          No department assigned — your shift is using defaults. Contact admin to fix.
        </p>
      )}
    </div>
  );
}
