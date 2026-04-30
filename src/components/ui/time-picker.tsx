"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  /** "HH:MM" 24-hour value, or empty string when unset. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const STEP_MINUTES = 15;
const OPTIONS: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = [];
  for (let m = 0; m < 24 * 60; m += STEP_MINUTES) {
    const h24 = Math.floor(m / 60);
    const mm = m % 60;
    const value = `${String(h24).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    out.push({ value, label: format12(h24, mm) });
  }
  return out;
})();

function format12(h24: number, m: number): string {
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function labelFor(value: string): string {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  return format12(h, m);
}

export function TimePicker({
  value,
  onChange,
  id,
  placeholder = "Select time",
  disabled,
  className,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const idx = OPTIONS.findIndex((o) => o.value === value);
    setHighlight(idx >= 0 ? idx : 0);
  }, [open, value]);

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.querySelector<HTMLElement>(
      `[data-idx="${highlight}"]`
    );
    item?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  function handleKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(OPTIONS.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = OPTIONS[highlight];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
      }
    }
  }

  const display = labelFor(value);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKey}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-[8px] border border-input bg-background/40 px-3 py-2 text-sm transition-colors signal-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          display ? "text-foreground" : "text-muted-foreground/70"
        )}
      >
        <span className="tabular">{display || placeholder}</span>
        <ChevronDown
          size={14}
          className={cn(
            "text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-[8px] border border-border bg-popover p-1 shadow-lg"
        >
          {OPTIONS.map((opt, idx) => {
            const selected = opt.value === value;
            const highlighted = idx === highlight;
            return (
              <button
                key={opt.value}
                type="button"
                data-idx={idx}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-[6px] px-3 py-1.5 text-left text-sm tabular",
                  highlighted
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground",
                  selected && "font-medium text-primary"
                )}
              >
                <span>{opt.label}</span>
                {selected && <span className="text-[10px]">●</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
