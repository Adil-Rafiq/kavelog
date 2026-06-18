"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TimePicker } from "@/components/ui/time-picker";
import { toast } from "@/components/ui/toaster";
import { shiftDefaultTimes, shiftLabel, type Shift } from "@/lib/policy";

type Status = "present" | "absent" | "paid_leave";

interface RecordInput {
  status: Status;
  clockIn: string | null;
  clockOut: string | null;
  notes: string | null;
}

export function DayEditor({
  dateKey,
  record,
  holiday,
  shift,
  onClose,
  onSaved,
  isAdmin,
  targetUserId,
}: {
  dateKey: string;
  record: RecordInput | null;
  holiday: string | null;
  shift: Shift;
  onClose: () => void;
  onSaved: () => void;
  isAdmin: boolean;
  targetUserId: string;
}) {
  const [status, setStatus] = React.useState<Status>(
    record?.status ?? "present",
  );
  const [clockIn, setClockIn] = React.useState(
    toLocalTime(record?.clockIn ?? null),
  );
  const [clockOut, setClockOut] = React.useState(
    toLocalTime(record?.clockOut ?? null),
  );
  const [notes, setNotes] = React.useState(record?.notes ?? "");
  const [pending, setPending] = React.useState(false);

  const defaults = React.useMemo(() => shiftDefaultTimes(shift), [shift]);

  // When the user fills one time and leaves the other blank, auto-fill the
  // empty side with the shift default. Never overwrites a value the user set.
  function handleClockInChange(value: string) {
    setClockIn(value);
    if (value && !clockOut) setClockOut(defaults.clockOut);
  }
  function handleClockOutChange(value: string) {
    setClockOut(value);
    if (value && !clockIn) setClockIn(defaults.clockIn);
  }

  const dateLabel = new Date(dateKey + "T00:00:00").toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  );

  async function save() {
    setPending(true);
    const payload: Record<string, unknown> = {
      userId: targetUserId,
      date: dateKey,
      status,
      notes: notes || null,
    };
    if (status === "present") {
      payload.clockIn = clockIn ? localToISO(dateKey, clockIn) : null;
      payload.clockOut = clockOut
        ? localToISO(dateKey, clockOut, clockIn)
        : null;
    } else {
      payload.clockIn = null;
      payload.clockOut = null;
    }
    const res = await fetch("/api/attendance/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      toast({
        kind: "error",
        title: "Could not save",
        description: data?.error ?? "Please try again.",
      });
      return;
    }
    toast({ kind: "success", title: "Saved" });
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 md:p-6 backdrop-blur-sm overflow-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-[16px] border border-border bg-card text-card-foreground animate-reveal grain"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Edit day
            </div>
            <div className="text-base text-foreground">{dateLabel}</div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-5 p-5">
          {holiday && <Badge variant="holiday">Holiday — {holiday}</Badge>}

          <div className="flex flex-col gap-2">
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="paid_leave">Paid leave</option>
            </Select>
          </div>

          {status === "present" && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="in">Clock in</Label>
                  <TimePicker
                    id="in"
                    value={clockIn}
                    onChange={handleClockInChange}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="out">Clock out</Label>
                  <TimePicker
                    id="out"
                    value={clockOut}
                    onChange={handleClockOutChange}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Fill one time and the other defaults to your shift (
                {shiftLabel(shift)}). Edit either freely.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. half day, WFH, client visit"
            />
          </div>

          {isAdmin && (
            <div className="text-[11px] text-warning">
              Editing as admin — the user will be notified.
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button
            variant="destructive"
            onClick={async () => {
              if (!record) return;
              // confirm destructive undo
              // eslint-disable-next-line no-restricted-globals
              if (!confirm("Undo this day (remove the attendance record)?"))
                return;
              setPending(true);
              const params = new URLSearchParams({ date: dateKey });
              if (targetUserId) params.set("userId", targetUserId);
              const res = await fetch(
                `/api/attendance/record?${params.toString()}`,
                {
                  method: "DELETE",
                },
              );
              const data = await res.json().catch(() => ({}));
              setPending(false);
              if (!res.ok) {
                toast({
                  kind: "error",
                  title: "Could not undo",
                  description: data?.error ?? "Please try again.",
                });
                return;
              }
              toast({ kind: "success", title: "Undone" });
              onSaved();
            }}
            disabled={pending}
          >
            {pending ? "Working…" : "Undo"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function toLocalTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function localToISO(dateKey: string, time: string, clockInTime?: string) {
  const [y, mo, da] = dateKey.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const d = new Date(y, mo - 1, da, h, mi, 0, 0);
  // If this is a clock-out for a second-shift day where in > out, push to next day.
  if (clockInTime) {
    const [ih, im] = clockInTime.split(":").map(Number);
    if (ih * 60 + im > h * 60 + mi) {
      d.setDate(d.getDate() + 1);
    }
  }
  return d.toISOString();
}
