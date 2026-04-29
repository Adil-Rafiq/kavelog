"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: "admin" | "employee";
  status: "pending" | "active" | "rejected";
  departmentId: string | null;
  departmentName: string | null;
  createdAt: string;
}

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "active", label: "Active" },
  { key: "rejected", label: "Rejected" },
] as const;

export function UsersAdmin({
  departments,
}: {
  departments: { id: string; name: string }[];
}) {
  const [tab, setTab] = React.useState<(typeof TABS)[number]["key"]>("pending");
  const [items, setItems] = React.useState<UserRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/users?status=${tab}`);
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }, [tab]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function patch(id: string, patch: Partial<UserRow>) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!res.ok) {
      toast({ kind: "error", title: "Update failed" });
      return;
    }
    toast({ kind: "success", title: "Updated" });
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-[8px] px-3 py-1.5 text-sm transition-colors ${
              t.key === tab
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                    Nothing here.
                  </td>
                </tr>
              ) : (
                items.map((u) => (
                  <tr key={u.id} className="border-t border-border/50 align-middle">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={u.departmentId ?? ""}
                        onChange={(e) =>
                          patch(u.id, {
                            departmentId: e.target.value || null,
                          })
                        }
                        className="h-9 max-w-[180px]"
                      >
                        <option value="">— None —</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={u.role}
                        onChange={(e) =>
                          patch(u.id, {
                            role: e.target.value as "admin" | "employee",
                          })
                        }
                        className="h-9 max-w-[140px]"
                      >
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
                      </Select>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground tabular">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {tab !== "active" && (
                          <Button
                            size="sm"
                            onClick={() => patch(u.id, { status: "active" })}
                          >
                            Approve
                          </Button>
                        )}
                        {tab !== "rejected" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => patch(u.id, { status: "rejected" })}
                          >
                            Reject
                          </Button>
                        )}
                        {tab === "rejected" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => patch(u.id, { status: "pending" })}
                          >
                            Re-pend
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
