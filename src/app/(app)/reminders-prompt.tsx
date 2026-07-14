"use client";

import * as React from "react";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import {
  isPushSupported,
  isSubscribedOnThisDevice,
  pushPermission,
  subscribeToPush,
} from "@/lib/push-client";

/**
 * Dashboard nudge that gets a user to actually grant browser push permission —
 * the step "reminders on by default" can't do on its own, since browsers only
 * surface the permission dialog inside a click. Lives on the page everyone
 * lands on (not tucked away in Account) and uses permission *priming*: this is
 * our own soft ask, and the real OS prompt only fires when the user clicks
 * "Enable". That keeps the one-shot browser prompt out of the hands of anyone
 * who'd reflexively hit "Block" (a block is sticky and can't be re-asked).
 *
 * Only appears when it can actually accomplish something: reminders are on
 * account-wide, push is possible, permission isn't already granted/denied, and
 * this device has no subscription yet. Snoozes for a week when dismissed.
 */

const SNOOZE_KEY = "kavelog.reminders.prompt";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // re-ask at most once a week

function isSnoozed(): boolean {
  try {
    const until = Number(localStorage.getItem(SNOOZE_KEY));
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

function snooze() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
  } catch {
    /* private mode — best effort */
  }
}

// iOS Safari can subscribe to push only once the PWA is installed to the Home
// Screen, so an un-installed iPhone needs a different nudge than an Enable
// button (the button would just fail as "unsupported").
function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS =
    /iP(hone|ad|od)/.test(ua) ||
    // iPadOS reports as desktop Safari but is touch-capable.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari's non-standard installed-PWA flag.
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

type Mode = "hidden" | "enable" | "ios";

export function ReminderPrompt({
  remindersEnabled,
}: {
  remindersEnabled: boolean;
}) {
  const [mode, setMode] = React.useState<Mode>("hidden");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!remindersEnabled) return; // user opted out — never nag
    if (isSnoozed()) return;

    if (isPushSupported()) {
      // A denial is a dead end (browser won't re-prompt); the account page's
      // "blocked" hint covers recovery, so don't show a button that can't work.
      if (pushPermission() === "denied") return;
      isSubscribedOnThisDevice().then((subscribed) => {
        if (!subscribed) setMode("enable");
      });
    } else if (isIosSafari() && !isStandalone()) {
      setMode("ios");
    }
  }, [remindersEnabled]);

  if (mode === "hidden") return null;

  function dismiss() {
    snooze();
    setMode("hidden");
  }

  async function enable() {
    if (pending) return;
    setPending(true);
    const result = await subscribeToPush();
    setPending(false);

    if (result.ok) {
      setMode("hidden");
      toast({
        kind: "success",
        title: "Reminders on",
        description: "This device will now get attendance nudges.",
      });
      return;
    }
    if (result.reason === "denied") {
      // Now permanently denied for this origin — stop nudging here.
      setMode("hidden");
      toast({
        kind: "error",
        title: "Notifications blocked",
        description: "You can enable them later from your account page.",
      });
    } else if (result.reason === "unsupported") {
      setMode("hidden");
    } else {
      // Transient — leave the banner up so they can retry.
      toast({
        kind: "error",
        title: "Could not enable reminders",
        description: "Please try again.",
      });
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-primary/40 bg-primary/10 px-4 py-3 ring-1 ring-primary/20 animate-reveal">
      <BellRing size={16} className="shrink-0 text-primary" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[10px] uppercase tracking-[0.22em] text-primary">
          {mode === "enable" ? "Attendance reminders" : "Reminders on iPhone"}
        </span>
        <span className="text-sm text-foreground">
          {mode === "enable"
            ? "Get a nudge if you forget to clock in, clock out, or log a day."
            : "Install KaveLog to your Home Screen (Share → Add to Home Screen), then enable reminders."}
        </span>
      </div>
      {mode === "enable" ? (
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={dismiss}
            disabled={pending}
          >
            Not now
          </Button>
          <Button size="sm" onClick={enable} disabled={pending}>
            {pending ? "Enabling…" : "Enable"}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
