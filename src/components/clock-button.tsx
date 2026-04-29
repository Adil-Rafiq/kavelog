"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

type State = "out" | "in";

interface ClockButtonProps {
  /** Current state — "out" means user can clock in; "in" means user can clock out. */
  state: State;
  /** ISO timestamp string of last action (clock-in or clock-out). */
  sinceISO?: string | null;
  /** Called when the button is pressed. */
  onAction: () => Promise<void> | void;
  /** Display label for the user's shift, e.g. "10:00 AM – 7:00 PM". */
  shiftLabel?: string;
  disabled?: boolean;
}

/**
 * The hero element of KaveLog. A wide, instrument-panel clock-in/out card.
 * Press it to stamp in or out — gives a brief flash and scale animation.
 */
export function ClockButton({
  state,
  sinceISO,
  onAction,
  shiftLabel,
  disabled,
}: ClockButtonProps) {
  const [now, setNow] = React.useState(() => new Date());
  const [pressing, setPressing] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = formatLargeTime(now);
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const sinceLabel = React.useMemo(() => {
    if (!sinceISO) return null;
    const since = new Date(sinceISO);
    return since.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }, [sinceISO]);

  const handlePress = async () => {
    if (disabled || pending) return;
    setPressing(true);
    setPending(true);
    try {
      await onAction();
    } finally {
      setTimeout(() => setPressing(false), 600);
      setPending(false);
    }
  };

  const isIn = state === "in";

  return (
    <button
      type="button"
      onClick={handlePress}
      disabled={disabled || pending}
      className={cn(
        "stamp signal-ring relative w-full overflow-hidden rounded-[16px] border text-left",
        "transition-colors",
        isIn
          ? "border-success/30 bg-card"
          : "border-primary/40 bg-card hover:border-primary/70",
        "disabled:opacity-60",
        pressing && "animate-stamp-flash"
      )}
    >
      {/* Decorative tick rail at the top — instrument panel detail */}
      <div className="absolute inset-x-0 top-0 flex h-2 items-center">
        <div className="flex w-full items-center justify-between px-1">
          {Array.from({ length: 32 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 w-px",
                i % 4 === 0 ? "bg-muted-foreground/40" : "bg-muted-foreground/15"
              )}
            />
          ))}
        </div>
      </div>

      <div className="relative flex flex-col gap-6 px-6 pb-6 pt-8 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:pb-7">
        {/* Time + meta */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <span
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                isIn ? "bg-success animate-pulse-soft" : "bg-primary animate-pulse-soft"
              )}
            />
            {isIn ? "Clocked in" : "Ready to clock in"}
            {sinceLabel && (
              <span className="text-muted-foreground/70 normal-case tracking-normal">
                · since {sinceLabel}
              </span>
            )}
          </div>

          <div className="font-mono text-5xl font-medium tabular leading-none tracking-tight sm:text-6xl">
            {time.h}
            <span className="text-muted-foreground/60 mx-0.5">:</span>
            {time.m}
            <span className="text-muted-foreground/40 ml-2 text-2xl tabular sm:text-3xl">
              {time.ampm}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{dateLabel}</span>
            {shiftLabel && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="tabular">Shift {shiftLabel}</span>
              </>
            )}
          </div>
        </div>

        {/* Action chip */}
        <div
          className={cn(
            "group inline-flex items-center gap-3 self-start rounded-[12px] px-5 py-3 text-sm font-medium transition-colors sm:self-auto",
            isIn
              ? "bg-foreground/95 text-background"
              : "bg-primary text-primary-foreground"
          )}
        >
          <span className="uppercase tracking-[0.16em] text-[12px]">
            {isIn ? "Clock out" : "Clock in"}
          </span>
          <ArrowRight
            size={16}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </div>
      </div>
    </button>
  );
}

function formatLargeTime(d: Date) {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return { h: String(h).padStart(2, "0"), m, ampm };
}
