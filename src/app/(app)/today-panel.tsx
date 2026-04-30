"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ClockButton } from "@/components/clock-button";
import { toast } from "@/components/ui/toaster";
import type { Shift } from "@/lib/policy";

export function TodayPanel({
  state: initialState,
  sinceISO: initialSince,
  lastClockOut,
  shift,
  shiftLabel,
}: {
  state: "in" | "out" | "done";
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
      setState("done");
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
      {state === "done" && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <span className="text-xs text-muted-foreground tabular">
            {formattedOut
              ? `Clocked out at ${formattedOut}`
              : "Done for today"}
          </span>
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
          No department assigned — your shift is using defaults. Contact admin to fix.
        </p>
      )}
    </div>
  );
}
