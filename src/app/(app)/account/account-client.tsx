"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "@/components/ui/toaster";
import { shiftLabel, type Shift } from "@/lib/policy";
import { useTour } from "@/components/tour/onboarding-tour";
import {
  isPushSupported,
  pushPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";

interface DepartmentOption {
  id: string;
  name: string;
  shift: Shift;
}

interface Profile {
  name: string;
  email: string;
  role: "admin" | "employee";
  departmentId: string | null;
  autoLogShift: boolean;
  remindersEnabled: boolean;
}

export function AccountClient({
  profile,
  departments,
}: {
  profile: Profile;
  departments: DepartmentOption[];
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <ProfileSection profile={profile} departments={departments} />
      <AutoLogSection profile={profile} departments={departments} />
      <RemindersSection profile={profile} />
      <PasswordSection />
      <ReplayTour />
    </div>
  );
}

function ReplayTour() {
  const { start } = useTour();
  return (
    <div className="flex items-center justify-between gap-4 rounded-[10px] border border-dashed border-border px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm text-foreground">Product tour</p>
        <p className="text-xs text-muted-foreground">
          Replay the quick walkthrough of how KaveLog works.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={start}>
        Take the tour
      </Button>
    </div>
  );
}

function AutoLogSection({
  profile,
  departments,
}: {
  profile: Profile;
  departments: DepartmentOption[];
}) {
  const [enabled, setEnabled] = React.useState(profile.autoLogShift);
  const [pending, setPending] = React.useState(false);

  // The shift is derived from the user's saved department (defaulting to first
  // shift when none is set, matching how the rest of the app resolves shift).
  const shift =
    departments.find((d) => d.id === profile.departmentId)?.shift ?? "first";

  async function toggle(next: boolean) {
    setPending(true);
    setEnabled(next);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoLogShift: next }),
    });
    setPending(false);
    if (!res.ok) {
      setEnabled(!next);
      toast({ kind: "error", title: "Could not save" });
      return;
    }
    toast({
      kind: "success",
      title: next ? "Auto-log turned on" : "Auto-log turned off",
    });
  }

  return (
    <Card data-tour="autolog">
      <CardHeader>
        <CardTitle>Auto-log my shift</CardTitle>
        <CardDescription>
          If you forget to log a weekday, record it automatically from your
          shift instead of leaving it blank.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Any weekday you didn&apos;t log (and isn&apos;t a holiday) will be
          saved as present, clocked in and out at your shift times —{" "}
          <span className="text-foreground">{shiftLabel(shift)}</span>
          {!profile.departmentId && " (default shift — set a department above)"}.
          Days you already logged are never changed.
        </p>
        <button
          type="button"
          role="switch"
          onClick={() => toggle(!enabled)}
          disabled={pending}
          aria-checked={enabled}
          aria-label="Auto-log my shift"
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-60 ${
            enabled
              ? "border-primary/40 bg-primary"
              : "border-border bg-secondary"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </CardContent>
    </Card>
  );
}

function RemindersSection({ profile }: { profile: Profile }) {
  const [enabled, setEnabled] = React.useState(profile.remindersEnabled);
  const [pending, setPending] = React.useState(false);
  const [supported, setSupported] = React.useState(true);
  const [blocked, setBlocked] = React.useState(false);

  // Capability + permission are browser-only — read them after mount to avoid
  // an SSR/client mismatch.
  React.useEffect(() => {
    setSupported(isPushSupported());
    setBlocked(pushPermission() === "denied");
  }, []);

  async function persist(next: boolean): Promise<boolean> {
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remindersEnabled: next }),
    });
    return res.ok;
  }

  async function toggle(next: boolean) {
    if (pending) return;
    setPending(true);

    if (next) {
      // Subscribe first (this prompts for permission inside the click gesture).
      const result = await subscribeToPush();
      if (!result.ok) {
        setPending(false);
        if (result.reason === "denied") {
          setBlocked(true);
          toast({
            kind: "error",
            title: "Notifications are blocked",
            description:
              "Allow notifications for KaveLog in your browser settings, then try again.",
          });
        } else if (result.reason === "unsupported") {
          setSupported(false);
          toast({
            kind: "error",
            title: "Not available on this device",
            description:
              "On iPhone, install KaveLog to your Home Screen first.",
          });
        } else {
          toast({ kind: "error", title: "Could not enable reminders" });
        }
        return;
      }
      const ok = await persist(true);
      setPending(false);
      if (!ok) {
        await unsubscribeFromPush();
        toast({ kind: "error", title: "Could not save" });
        return;
      }
      setEnabled(true);
      setBlocked(false);
      toast({
        kind: "success",
        title: "Reminders turned on",
        description: "This device will now get attendance nudges.",
      });
    } else {
      setEnabled(false);
      const ok = await persist(false);
      await unsubscribeFromPush();
      setPending(false);
      if (!ok) {
        setEnabled(true);
        toast({ kind: "error", title: "Could not save" });
        return;
      }
      toast({ kind: "success", title: "Reminders turned off" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance reminders</CardTitle>
        <CardDescription>
          Get a push notification when you have a gap to fill, so your log stays
          complete.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            We&apos;ll nudge you if you haven&apos;t clocked in by mid-morning,
            if you&apos;re still clocked in after your shift ends, or if
            yesterday was left blank. Reminders are enabled per device.
          </p>
          <button
            type="button"
            role="switch"
            onClick={() => toggle(!enabled)}
            disabled={pending || (!supported && !enabled)}
            aria-checked={enabled}
            aria-label="Attendance reminders"
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-60 ${
              enabled
                ? "border-primary/40 bg-primary"
                : "border-border bg-secondary"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {!supported && (
          <p className="text-xs text-warning">
            This browser can&apos;t receive push notifications. On iPhone,
            install KaveLog to your Home Screen first (Share → Add to Home
            Screen).
          </p>
        )}
        {blocked && supported && (
          <p className="text-xs text-warning">
            Notifications are blocked for KaveLog. Enable them in your
            browser&apos;s site settings, then turn reminders on.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileSection({
  profile,
  departments,
}: {
  profile: Profile;
  departments: DepartmentOption[];
}) {
  const router = useRouter();
  const { update } = useSession();
  const [name, setName] = React.useState(profile.name);
  const [departmentId, setDepartmentId] = React.useState(
    profile.departmentId ?? ""
  );
  const [pending, setPending] = React.useState(false);

  const dirty =
    name.trim() !== profile.name ||
    (departmentId || null) !== profile.departmentId;
  const selectedShift =
    departments.find((d) => d.id === departmentId)?.shift ?? null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || name.trim().length < 2) return;
    setPending(true);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        departmentId: departmentId || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPending(false);
      toast({
        kind: "error",
        title: "Could not save",
        description: data?.error ?? "Please try again.",
      });
      return;
    }
    // Refresh the JWT so the sidebar name / department reflect the change.
    await update({ refresh: true });
    router.refresh();
    setPending(false);
    toast({ kind: "success", title: "Profile updated" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Your name and department. Your role is{" "}
          <span className="text-foreground">{profile.role}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={profile.email} disabled readOnly />
            <p className="text-xs text-muted-foreground">
              Email is your sign-in identifier — contact an admin to change it.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="department">Department</Label>
            <Select
              id="department"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">— No department —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            {selectedShift && (
              <p className="text-xs text-muted-foreground">
                Shift: {shiftLabel(selectedShift)}
              </p>
            )}
          </div>
          <div>
            <Button type="submit" disabled={pending || !dirty}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordSection() {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit =
    current.length > 0 && next.length >= 8 && next === confirm && !pending;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      toast({
        kind: "error",
        title: "Could not change password",
        description: data?.error ?? "Please try again.",
      });
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    toast({
      kind: "success",
      title: "Password changed",
      description: "Use your new password next time you sign in.",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>Change the password you sign in with.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="current-password">Current password</Label>
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">New password (min 8 characters)</Label>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              required
              minLength={8}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {mismatch && (
              <p className="text-xs text-destructive">Passwords don’t match.</p>
            )}
          </div>
          <div>
            <Button type="submit" disabled={!canSubmit}>
              {pending ? "Changing…" : "Change password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
