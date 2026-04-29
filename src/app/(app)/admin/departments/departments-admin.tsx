"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";

interface Department {
  id: string;
  name: string;
  shift: "first" | "second";
  createdAt: string;
}

export function DepartmentsAdmin() {
  const [items, setItems] = React.useState<Department[]>([]);
  const [name, setName] = React.useState("");
  const [shift, setShift] = React.useState<"first" | "second">("first");
  const [pending, setPending] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/departments");
    const data = await res.json();
    setItems(data.items ?? []);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    const res = await fetch("/api/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), shift }),
    });
    setPending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ kind: "error", title: "Could not create", description: data?.error });
      return;
    }
    setName("");
    setShift("first");
    toast({ kind: "success", title: "Department created" });
    load();
  }

  async function patchShift(id: string, shift: "first" | "second") {
    await fetch("/api/departments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, shift }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this department? Users will be unassigned.")) return;
    await fetch(`/api/departments?id=${id}`, { method: "DELETE" });
    toast({ kind: "info", title: "Department deleted" });
    load();
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <form onSubmit={create} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="name">Department name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Development"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:w-56">
            <Label htmlFor="shift">Shift</Label>
            <Select
              id="shift"
              value={shift}
              onChange={(e) => setShift(e.target.value as "first" | "second")}
            >
              <option value="first">First (10 AM – 7 PM)</option>
              <option value="second">Second (6 PM – 3 AM)</option>
            </Select>
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
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Shift</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-12 text-center text-sm text-muted-foreground">
                  No departments yet.
                </td>
              </tr>
            ) : (
              items.map((d) => (
                <tr key={d.id} className="border-t border-border/50">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {d.name}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={d.shift}
                      onChange={(e) =>
                        patchShift(d.id, e.target.value as "first" | "second")
                      }
                      className="h-9 max-w-[260px]"
                    >
                      <option value="first">First (10 AM – 7 PM)</option>
                      <option value="second">Second (6 PM – 3 AM)</option>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(d.id)}
                        aria-label="Delete department"
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
