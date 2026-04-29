import * as React from "react";
import { cn } from "@/lib/utils";

interface StatProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  className?: string;
}

/**
 * Stat — instrument-panel-style metric display.
 * Big tabular mono number, tiny uppercase label, optional unit and hint line.
 */
export function Stat({ label, value, unit, hint, className }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-3xl font-medium text-foreground tabular leading-none">
          {value}
        </span>
        {unit && (
          <span className="text-xs text-muted-foreground tabular">{unit}</span>
        )}
      </div>
      {hint && (
        <span className="text-xs text-muted-foreground">{hint}</span>
      )}
    </div>
  );
}
