"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ArrowRight, Check } from "lucide-react";

type State = "out" | "in" | "done";

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

  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const since = React.useMemo(
    () => (sinceISO ? new Date(sinceISO) : null),
    [sinceISO]
  );

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
  const isDone = state === "done";

  return (
    <button
      type="button"
      onClick={handlePress}
      disabled={disabled || isDone || pending}
      className={cn(
        "stamp signal-ring relative w-full overflow-hidden rounded-[16px] border text-left",
        "transition-colors",
        isDone
          ? "border-border/60 bg-card"
          : isIn
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
                i % 4 === 0
                  ? "bg-muted-foreground/40"
                  : "bg-muted-foreground/15"
              )}
            />
          ))}
        </div>
      </div>

      {isIn && since ? (
        <InContent
          now={now}
          since={since}
          dateLabel={dateLabel}
          shiftLabel={shiftLabel}
        />
      ) : (
        <OutContent
          now={now}
          dateLabel={dateLabel}
          shiftLabel={shiftLabel}
          isDone={isDone}
        />
      )}
    </button>
  );
}

function OutContent({
  now,
  dateLabel,
  shiftLabel,
  isDone,
}: {
  now: Date;
  dateLabel: string;
  shiftLabel?: string;
  isDone: boolean;
}) {
  const time = formatLargeTime(now);

  return (
    <div className="relative flex flex-col gap-6 px-6 pb-6 pt-8 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:pb-7">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <span
            className={cn(
              "inline-block h-1.5 w-1.5 rounded-full",
              isDone ? "bg-success" : "bg-primary animate-pulse-soft"
            )}
          />
          {isDone ? "Done for today" : "Ready to clock in"}
        </div>

        <div className="font-mono text-5xl font-medium tabular leading-none tracking-tight sm:text-6xl">
          {time.h}
          <span className="mx-0.5 text-muted-foreground/60">:</span>
          {time.m}
          <span className="ml-2 text-2xl tabular text-muted-foreground/40 sm:text-3xl">
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

      <ActionChip variant={isDone ? "done" : "out"} />
    </div>
  );
}

function InContent({
  now,
  since,
  dateLabel,
  shiftLabel,
}: {
  now: Date;
  since: Date;
  dateLabel: string;
  shiftLabel?: string;
}) {
  const elapsed = formatElapsed(since, now);
  const inTime = formatLargeTime(since);

  return (
    <div className="relative flex flex-col gap-6 px-6 pb-6 pt-8 sm:px-8 sm:pb-7">
      {/* Header strip */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
          Clocked in
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="normal-case tracking-normal">{dateLabel}</span>
        {shiftLabel && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span className="tabular normal-case tracking-normal">
              Shift {shiftLabel}
            </span>
          </>
        )}
      </div>

      {/* Two prominent values + action */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          {/* Clock-in time */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Clocked in at
            </span>
            <div className="font-mono text-4xl font-medium tabular leading-none tracking-tight sm:text-5xl">
              {inTime.h}
              <span className="mx-0.5 text-muted-foreground/60">:</span>
              {inTime.m}
              <span className="ml-2 text-lg tabular text-muted-foreground/40 sm:text-xl">
                {inTime.ampm}
              </span>
            </div>
          </div>

          {/* Live elapsed */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Elapsed
            </span>
            <div className="font-mono text-4xl font-medium tabular leading-none tracking-tight text-success sm:text-5xl">
              {elapsed.h}
              <span className="mx-0.5 text-muted-foreground/60">:</span>
              {elapsed.m}
              <span className="ml-2 text-lg tabular text-muted-foreground/40 sm:text-xl">
                h
              </span>
            </div>
          </div>
        </div>

        <ActionChip variant="in" />
      </div>
    </div>
  );
}

function ActionChip({ variant }: { variant: "in" | "out" | "done" }) {
  return (
    <div
      className={cn(
        "group inline-flex items-center gap-3 self-start rounded-[12px] px-5 py-3 text-sm font-medium transition-colors sm:self-auto",
        variant === "done"
          ? "bg-secondary text-muted-foreground"
          : variant === "in"
            ? "bg-foreground/95 text-background"
            : "bg-primary text-primary-foreground"
      )}
    >
      <span className="text-[12px] uppercase tracking-[0.16em]">
        {variant === "done"
          ? "Done"
          : variant === "in"
            ? "Clock out"
            : "Clock in"}
      </span>
      {variant === "done" ? (
        <Check size={16} />
      ) : (
        <ArrowRight
          size={16}
          className="transition-transform group-hover:translate-x-0.5"
        />
      )}
    </div>
  );
}

function formatLargeTime(d: Date) {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return { h: String(h).padStart(2, "0"), m, ampm };
}

function formatElapsed(since: Date, now: Date) {
  const ms = Math.max(0, now.getTime() - since.getTime());
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return { h: String(h).padStart(2, "0"), m: String(m).padStart(2, "0") };
}
