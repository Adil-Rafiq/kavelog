"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";

export function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);

  if (!token) {
    return (
      <div className="flex flex-col gap-3 rounded-[12px] border border-border bg-card p-5">
        <span className="text-[11px] uppercase tracking-[0.22em] text-destructive">
          Missing token
        </span>
        <p className="text-sm text-foreground">
          This reset link is incomplete. Request a new one from the{" "}
          <Link href="/forgot" className="underline">
            forgot password
          </Link>{" "}
          page.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3 rounded-[12px] border border-border bg-card p-5">
        <span className="text-[11px] uppercase tracking-[0.22em] text-success">
          Password updated
        </span>
        <p className="text-sm text-foreground">
          Your password has been reset.{" "}
          <Link href="/login" className="underline">
            Sign in
          </Link>{" "}
          to continue.
        </p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast({ kind: "error", title: "Passwords don't match" });
      return;
    }
    setPending(true);
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast({
        kind: "error",
        title: "Could not reset",
        description: data?.error ?? "The link may have expired.",
      });
      return;
    }
    setDone(true);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">New password (min 8 characters)</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
