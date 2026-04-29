"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

interface Holiday {
  id: string;
  date: string;
  name: string;
  createdAt: string;
}

export function HolidaysAdmin() {
  const [items, setItems] = React.useState<Holiday[]>([]);
  const [date, setDate] = React.useState("");
  const [name, setName] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/admin/holidays");
    const data = await res.json();
    setItems(data.items ?? []);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !name) return;
    setPending(true);
    const res = await fetch("/api/admin/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, name }),
    });
    setPending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ kind: "error", title: "Could not add", description: data?.error });
      return;
    }
    setDate("");
    setName("");
    toast({ kind: "success", title: "Holiday added" });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this holiday?")) return;
    await fetch(`/api/admin/holidays?id=${id}`, { method: "DELETE" });
    toast({ kind: "info", title: "Holiday removed" });
    load();
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <form onSubmit={add} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1.5 sm:w-48">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Independence Day"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add"}
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-12 text-center text-sm text-muted-foreground">
                  No holidays added.
                </td>
              </tr>
            ) : (
              items.map((h) => (
                <tr key={h.id} className="border-t border-border/50">
                  <td className="px-4 py-3 font-mono tabular text-foreground">
                    {h.date}
                  </td>
                  <td className="px-4 py-3 text-foreground">{h.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(h.id)}
                        aria-label="Delete"
                      >
                        <Trash2 size={14} className="text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
