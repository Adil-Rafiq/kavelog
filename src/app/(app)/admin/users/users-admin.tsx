"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  currentUserId,
}: {
  departments: { id: string; name: string }[];
  currentUserId: string;
}) {
  const [tab, setTab] = React.useState<(typeof TABS)[number]["key"]>("pending");
  const [items, setItems] = React.useState<UserRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<UserRow | null>(null);

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

  async function handleDelete(id: string) {
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast({
        kind: "error",
        title: "Delete failed",
        description: data?.error ?? "Please try again.",
      });
      return;
    }
    toast({ kind: "success", title: "User deleted" });
    setDeleteTarget(null);
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
                        {u.id !== currentUserId && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleteTarget(u)}
                          >
                            Delete
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

      {deleteTarget && (
        <DeleteUserDialog
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget.id)}
        />
      )}
    </div>
  );
}

function DeleteUserDialog({
  user,
  onClose,
  onConfirm,
}: {
  user: UserRow;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [confirmText, setConfirmText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const matches = confirmText.trim().toLowerCase() === user.email.toLowerCase();

  async function submit() {
    if (!matches || pending) return;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 p-0 backdrop-blur-sm md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-[16px] border border-border bg-card text-card-foreground md:rounded-[16px] animate-reveal grain"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-destructive">
              Delete user
            </div>
            <div className="text-base text-foreground">{user.name}</div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <p className="text-sm text-muted-foreground">
            This permanently removes{" "}
            <span className="text-foreground">{user.email}</span> and all their
            attendance records, notifications, support tickets, and password
            reset tokens. This cannot be undone.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-email">
              Type the email to confirm
            </Label>
            <Input
              id="confirm-email"
              autoFocus
              autoComplete="off"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={user.email}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={!matches || pending}
          >
            {pending ? "Deleting…" : "Delete user"}
          </Button>
        </div>
      </div>
    </div>
  );
}
