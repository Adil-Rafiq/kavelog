"use client";

import * as React from "react";
import { ArrowRight, Check } from "lucide-react";
import { cn, formatHours } from "@/lib/utils";
import { computeWorkedHours } from "@/lib/policy";

interface DoneCardProps {
  clockInISO: string;
  clockOutISO: string;
  overtimeChunks: number;
  shiftLabel?: string;
}

export function DoneCard({
  clockInISO,
  clockOutISO,
  overtimeChunks,
  shiftLabel,
}: DoneCardProps) {
  const clockIn = new Date(clockInISO);
  const clockOut = new Date(clockOutISO);
  const worked = computeWorkedHours(clockIn, clockOut);
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="stamp signal-ring relative w-full overflow-hidden rounded-[16px] border border-border/60 bg-card text-left">
      {/* Decorative tick rail — matches ClockButton */}
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

      <div className="relative flex flex-col gap-7 px-6 pb-6 pt-8 sm:px-8 sm:pb-7">
        {/* Status header */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
            Done for today
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

        {/* In → Out */}
        <div className="flex items-end justify-between gap-3 sm:gap-6">
          <TimeBlock label="Clock in" date={clockIn} />
          <ArrowRight
            size={22}
            className="mb-3 shrink-0 text-muted-foreground/40 sm:mb-4"
          />
          <TimeBlock label="Clock out" date={clockOut} align="right" />
        </div>

        {/* Stats footer */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border/60 pt-4">
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <Stat label="Hours worked" value={formatHours(worked)} unit="h" />
            {overtimeChunks > 0 && (
              <Stat label="Overtime" value={overtimeChunks} unit="× 30m" />
            )}
          </div>
          <div className="inline-flex items-center gap-2 self-end rounded-[12px] bg-secondary px-4 py-2 text-muted-foreground">
            <Check size={14} />
            <span className="text-[12px] uppercase tracking-[0.16em]">
              Wrapped
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimeBlock({
  label,
  date,
  align = "left",
}: {
  label: string;
  date: Date;
  align?: "left" | "right";
}) {
  let h = date.getHours();
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-1.5",
        align === "right" && "items-end text-right"
      )}
    >
      <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </span>
      <div className="font-mono text-4xl font-medium tabular leading-none tracking-tight sm:text-5xl">
        {String(h).padStart(2, "0")}
        <span className="mx-0.5 text-muted-foreground/60">:</span>
        {mm}
        <span className="ml-2 text-lg tabular text-muted-foreground/40 sm:text-xl">
          {ampm}
        </span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-2xl tabular text-foreground">
        {value}
        {unit && (
          <span className="ml-1 text-base text-muted-foreground/70">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
