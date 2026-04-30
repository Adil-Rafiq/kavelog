"use client";

import * as React from "react";
import { Clock } from "lucide-react";
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

type AmPm = "AM" | "PM";
interface Draft {
  h12: number; // 1-12
  m: number; // 0-59
  ampm: AmPm;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function format12(h24: number, m: number): string {
  const ampm: AmPm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${pad(m)} ${ampm}`;
}

function labelFor(value: string): string {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  return format12(h, m);
}

function combine(h12: number, m: number, ampm: AmPm): string {
  let h = h12 % 12;
  if (ampm === "PM") h += 12;
  return `${pad(h)}:${pad(m)}`;
}

function deriveDraft(value: string): Draft {
  if (value) {
    const [h, m] = value.split(":").map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) {
      return {
        h12: h % 12 || 12,
        m,
        ampm: h >= 12 ? "PM" : "AM",
      };
    }
  }
  const now = new Date();
  const h = now.getHours();
  return {
    h12: h % 12 || 12,
    m: now.getMinutes(),
    ampm: h >= 12 ? "PM" : "AM",
  };
}

/**
 * Parse a wide variety of time-string inputs into a 24h "HH:MM" value.
 * Accepts: "10:15", "10:15 AM", "10:15 PM", "10:15p", "1015", "1015pm",
 * "22:15", "10pm", "10p", "10 am", "10 a.m.", " 10 : 15 pm ", "9.45am"
 * Returns null if it cannot be parsed.
 */
function parseTimeInput(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/\./g, "").replace(/\s+/g, "");
  const ampmMatch = s.match(/(am|pm|a|p)$/);
  let core = s;
  let ampm: "am" | "pm" | null = null;
  if (ampmMatch) {
    const t = ampmMatch[1];
    ampm = t.startsWith("p") ? "pm" : "am";
    core = s.slice(0, -t.length);
  }
  let h: number;
  let m: number;
  if (core.includes(":")) {
    const parts = core.split(":");
    h = parseInt(parts[0].replace(/\D/g, ""), 10);
    m = parseInt(parts[1].replace(/\D/g, ""), 10);
  } else {
    const d = core.replace(/\D/g, "");
    if (!d) return null;
    if (d.length <= 2) {
      h = parseInt(d, 10);
      m = 0;
    } else if (d.length === 3) {
      h = parseInt(d.slice(0, 1), 10);
      m = parseInt(d.slice(1), 10);
    } else if (d.length === 4) {
      h = parseInt(d.slice(0, 2), 10);
      m = parseInt(d.slice(2), 10);
    } else return null;
  }
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (m < 0 || m > 59) return null;
  if (ampm) {
    if (h < 1 || h > 12) return null;
    if (ampm === "pm" && h !== 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
  } else {
    if (h < 0 || h > 23) return null;
  }
  return `${pad(h)}:${pad(m)}`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

export function TimePicker({
  value,
  onChange,
  id,
  placeholder = "e.g. 10:15 AM",
  disabled,
  className,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(() => labelFor(value));
  const [invalid, setInvalid] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const hourColRef = React.useRef<HTMLDivElement>(null);
  const minuteColRef = React.useRef<HTMLDivElement>(null);

  const draft = React.useMemo(() => deriveDraft(value), [value]);

  // Sync displayed text when canonical value changes from outside.
  React.useEffect(() => {
    const parsed = parseTimeInput(text);
    if (parsed === value) return;
    setText(labelFor(value));
    setInvalid(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Outside click + Escape close the popover.
  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        commit();
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Scroll the active hour/minute into view when the popover opens.
  React.useEffect(() => {
    if (!open) return;
    hourColRef.current
      ?.querySelector<HTMLElement>(`[data-h="${draft.h12}"]`)
      ?.scrollIntoView({ block: "center" });
    minuteColRef.current
      ?.querySelector<HTMLElement>(`[data-m="${draft.m}"]`)
      ?.scrollIntoView({ block: "center" });
  }, [open, draft.h12, draft.m]);

  function commit() {
    if (!text.trim()) {
      onChange("");
      setInvalid(false);
      return;
    }
    const parsed = parseTimeInput(text);
    if (parsed) {
      onChange(parsed);
      setText(labelFor(parsed));
      setInvalid(false);
    } else {
      setInvalid(true);
    }
  }

  function handleInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && !open) {
      e.preventDefault();
      setOpen(true);
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit();
      setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Tab") {
      commit();
      setOpen(false);
    }
  }

  function applyPart(patch: Partial<Draft>) {
    const next: Draft = { ...draft, ...patch };
    const newValue = combine(next.h12, next.m, next.ampm);
    onChange(newValue);
    setText(labelFor(newValue));
    setInvalid(false);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex h-10 w-full items-center rounded-[8px] border bg-background/40 px-3 text-sm transition-colors signal-ring focus-within:border-ring",
          invalid ? "border-destructive/60" : "border-input",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="text"
          autoComplete="off"
          disabled={disabled}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setInvalid(false);
          }}
          onKeyDown={handleInputKey}
          onFocus={() => inputRef.current?.select()}
          onBlur={() => {
            // Defer so a click inside the popover wins over blur.
            setTimeout(() => {
              if (!rootRef.current?.contains(document.activeElement)) commit();
            }, 0);
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent tabular text-foreground outline-none placeholder:text-muted-foreground/60"
          aria-invalid={invalid}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setOpen((o) => !o);
            inputRef.current?.focus();
          }}
          disabled={disabled}
          className="ml-2 flex h-7 w-7 items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:hover:bg-transparent"
          aria-label="Show time picker"
        >
          <Clock size={14} />
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Pick a time"
          className="absolute z-50 mt-1 w-full min-w-[260px] rounded-[8px] border border-border bg-popover p-2 shadow-lg"
        >
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Column
              label="Hour"
              listRef={hourColRef}
              items={HOURS.map((h) => ({
                key: h,
                label: pad(h),
                selected: draft.h12 === h,
                dataAttr: { "data-h": h },
                onPick: () => applyPart({ h12: h }),
              }))}
            />
            <Column
              label="Min"
              listRef={minuteColRef}
              items={MINUTES.map((m) => ({
                key: m,
                label: pad(m),
                selected: draft.m === m,
                dataAttr: { "data-m": m },
                onPick: () => applyPart({ m }),
              }))}
            />
            <div className="flex flex-col">
              <div className="px-2 pb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                AM/PM
              </div>
              <div className="flex flex-col gap-1">
                {(["AM", "PM"] as const).map((p) => {
                  const selected = draft.ampm === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyPart({ ampm: p })}
                      className={cn(
                        "rounded-[6px] px-4 py-1.5 text-sm font-medium tabular transition-colors",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-accent"
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const now = new Date();
                const h24 = now.getHours();
                applyPart({
                  h12: h24 % 12 || 12,
                  m: now.getMinutes(),
                  ampm: h24 >= 12 ? "PM" : "AM",
                });
              }}
              className="rounded-[6px] px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Now
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setOpen(false)}
              className="rounded-[6px] px-3 py-1 text-xs font-medium text-foreground hover:bg-accent"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ColumnItem {
  key: number;
  label: string;
  selected: boolean;
  dataAttr: Record<string, number>;
  onPick: () => void;
}

function Column({
  label,
  items,
  listRef,
}: {
  label: string;
  items: ColumnItem[];
  listRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <div className="px-2 pb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div
        ref={listRef}
        className="max-h-48 overflow-y-auto rounded-[6px] border border-border/40"
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            {...item.dataAttr}
            onMouseDown={(e) => e.preventDefault()}
            onClick={item.onPick}
            className={cn(
              "block w-full px-3 py-1.5 text-center text-sm tabular transition-colors",
              item.selected
                ? "bg-primary font-medium text-primary-foreground"
                : "text-foreground hover:bg-accent"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
