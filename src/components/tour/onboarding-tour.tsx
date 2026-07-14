"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { subscribeToPush } from "@/lib/push-client";

/**
 * First-login product tour. A spotlight highlights one real control at a time,
 * walking the user across the actual pages (Today → Calendar → Reports →
 * Account) so each feature is shown where it lives. The finale lands on the
 * "Attendance reminders" setting, where the user can allow notifications.
 *
 * Persistence is per-account: `users.onboarded_at`. The provider auto-starts
 * the tour when that column is null (passed down as `autoStart`), and any
 * component can replay it via `useTour().start()`.
 */

interface Step {
  /** Route the target lives on. The runner navigates here first if needed. */
  path: string;
  /** CSS selector for the element to spotlight (a stable `data-tour` hook). */
  selector: string;
  title: string;
  body: string;
  /** Emphasized (lime) coach card — used for the reminders finale. */
  accent?: boolean;
  /**
   * Show an "Allow notifications" CTA on this step that triggers the browser
   * push-permission prompt inside the click, then subscribes this device. Used
   * so first-run users can turn reminders on right here instead of hunting for
   * the account toggle later.
   */
  promptPush?: boolean;
}

const STEPS: Step[] = [
  {
    path: "/",
    selector: '[data-tour="clock"]',
    title: "Clock in & out",
    body: "This panel is your day. Tap once to stamp in, tap again when you leave — your hours and overtime are worked out for you.",
  },
  {
    path: "/",
    selector: '[data-tour="month"]',
    title: "Your month, live",
    body: "Hours against target, days present, overtime and paid leaves — always up to date as you clock.",
  },
  {
    path: "/calendar",
    selector: '[data-tour="calendar"]',
    title: "Fix a missed day",
    body: "Forgot to log a day? Open any past date here to add or correct it. Weekends stay blank unless you actually worked.",
  },
  {
    path: "/reports",
    selector: '[data-tour="reports"]',
    title: "Totals & CSV export",
    body: "Filter by month or year-to-date, then export a CSV whenever you want a record to compare against HR.",
  },
  {
    path: "/account",
    selector: '[data-tour="autolog"]',
    title: "Auto-log your shift",
    body: "One handy setting: switch this on and any weekday you forget fills itself from your shift times — never left blank, never marked absent.",
  },
  {
    path: "/account",
    selector: '[data-tour="reminders"]',
    title: "Reminders keep you on track",
    body: "These are on by default — a gentle push nudge if you forget to clock in, clock out, or log yesterday. Allow notifications to start getting them (or switch reminders off any time).",
    accent: true,
    promptPush: true,
  },
];

const SESSION_KEY = "kavelog.tour.done";
const SCRIM = "rgba(8, 10, 14, 0.7)";

interface TourContextValue {
  start: () => void;
  active: boolean;
}

const TourContext = React.createContext<TourContextValue | null>(null);

/** Access the tour from anywhere in the app (e.g. a "Replay tour" button). */
export function useTour(): TourContextValue {
  return React.useContext(TourContext) ?? { start: () => {}, active: false };
}

export function TourProvider({
  autoStart,
  children,
}: {
  autoStart: boolean;
  children: React.ReactNode;
}) {
  const [active, setActive] = React.useState(false);
  const [index, setIndex] = React.useState(0);

  const start = React.useCallback(() => {
    setIndex(0);
    setActive(true);
  }, []);

  const end = React.useCallback(() => {
    setActive(false);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* private mode — best effort */
    }
    // Persist so the tour never auto-starts again on any device. Fire & forget.
    fetch("/api/account/onboarding", { method: "POST" }).catch(() => {});
  }, []);

  // Auto-start once for a first-login user, after the first page has painted.
  const autoStarted = React.useRef(false);
  React.useEffect(() => {
    if (!autoStart || autoStarted.current) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      /* ignore */
    }
    autoStarted.current = true;
    const t = setTimeout(start, 650);
    return () => clearTimeout(t);
  }, [autoStart, start]);

  const value = React.useMemo(() => ({ start, active }), [start, active]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {active && <TourRunner index={index} setIndex={setIndex} onEnd={end} />}
    </TourContext.Provider>
  );
}

interface CoachPos {
  top: number;
  left: number;
}

function TourRunner({
  index,
  setIndex,
  onEnd,
}: {
  index: number;
  setIndex: (i: number) => void;
  onEnd: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const step = STEPS[index];

  const [mounted, setMounted] = React.useState(false);
  const [pushBusy, setPushBusy] = React.useState(false);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [coachPos, setCoachPos] = React.useState<CoachPos | null>(null);
  // The target couldn't be located after polling — reveal a centered fallback
  // card so the user is never trapped behind a blank scrim.
  const [stuck, setStuck] = React.useState(false);
  // Locating has run long enough to be worth a spinner (avoids a flicker on
  // fast same-page hops, where the target is found almost immediately).
  const [slowLoad, setSlowLoad] = React.useState(false);
  const elRef = React.useRef<HTMLElement | null>(null);
  const coachRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => setMounted(true), []);

  const isLast = index === STEPS.length - 1;

  const next = React.useCallback(() => {
    if (isLast) onEnd();
    else setIndex(index + 1);
  }, [isLast, onEnd, setIndex, index]);

  const back = React.useCallback(() => {
    if (index > 0) setIndex(index - 1);
  }, [index, setIndex]);

  // "Allow notifications" CTA: request permission + subscribe inside the click
  // (browsers only surface the prompt from a gesture), then finish the tour.
  const allowPush = React.useCallback(async () => {
    if (pushBusy) return;
    setPushBusy(true);
    const result = await subscribeToPush();
    setPushBusy(false);
    if (result.ok) {
      toast({
        kind: "success",
        title: "Reminders on",
        description: "This device will now get attendance nudges.",
      });
      next();
    } else if (result.reason === "denied") {
      toast({
        kind: "error",
        title: "Notifications blocked",
        description: "You can enable them later from your account page.",
      });
    } else if (result.reason === "unsupported") {
      toast({
        kind: "error",
        title: "Not available on this device",
        description: "On iPhone, install KaveLog to your Home Screen first.",
      });
    } else {
      toast({
        kind: "error",
        title: "Could not enable reminders",
        description: "Please try again.",
      });
    }
  }, [pushBusy, next]);

  // Locate the target for the current step, navigating to its page first if
  // needed, then measure it once it's in the DOM.
  React.useEffect(() => {
    let raf = 0;
    let tries = 0;
    let cancelled = false;

    setRect(null);
    setCoachPos(null);
    setStuck(false);
    elRef.current = null;

    if (pathname !== step.path) {
      router.push(step.path);
      return; // re-runs when pathname updates
    }

    const find = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(step.selector);
      if (el) {
        elRef.current = el;
        el.scrollIntoView({ block: "center", behavior: "auto" });
        raf = requestAnimationFrame(() => {
          if (!cancelled && elRef.current) {
            setRect(elRef.current.getBoundingClientRect());
          }
        });
        return;
      }
      // Poll while the page (and its data) finish loading after navigation.
      if (tries++ < 120) raf = requestAnimationFrame(find);
      // Genuinely absent target — reveal the card centered so the tour can
      // still be read and dismissed rather than hanging on a blank scrim.
      else setStuck(true);
    };
    find();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [index, pathname, step.path, step.selector, router]);

  // Only bother with a spinner if locating drags on, so quick same-page hops
  // don't flash one. Clears the instant a target is measured (or we fall back).
  React.useEffect(() => {
    if (rect || stuck) {
      setSlowLoad(false);
      return;
    }
    const t = setTimeout(() => setSlowLoad(true), 240);
    return () => clearTimeout(t);
  }, [rect, stuck]);

  // Keep the spotlight glued to the element as the page scrolls or resizes.
  React.useEffect(() => {
    if (!rect) return;
    const update = () => {
      if (elRef.current) setRect(elRef.current.getBoundingClientRect());
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [rect]);

  // Position the coach card relative to the hole once both are measurable.
  React.useLayoutEffect(() => {
    if (!rect || !coachRef.current) return;
    const cw = coachRef.current.offsetWidth;
    const ch = coachRef.current.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 14;

    let top = rect.bottom + gap;
    if (top + ch > vh - 12) {
      const above = rect.top - gap - ch;
      top = above >= 12 ? above : Math.max(12, vh - ch - 12);
    }
    let left = rect.left + rect.width / 2 - cw / 2;
    left = Math.max(12, Math.min(left, vw - cw - 12));
    setCoachPos({ top, left });
  }, [rect, index]);

  // Keyboard: Esc skips, arrows navigate.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEnd();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEnd, next, back]);

  if (!mounted) return null;

  const pad = 8;
  const holeStyle: React.CSSProperties | null = rect
    ? {
        position: "fixed",
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
        borderRadius: 12,
        boxShadow: `0 0 0 2px hsl(var(--primary)), 0 0 0 9999px ${SCRIM}`,
        pointerEvents: "none",
        zIndex: 101,
        transition:
          "top .3s cubic-bezier(.32,.72,0,1), left .3s cubic-bezier(.32,.72,0,1), width .3s cubic-bezier(.32,.72,0,1), height .3s cubic-bezier(.32,.72,0,1)",
      }
    : null;

  const anchored = Boolean(rect && coachPos);
  // Hide the card for the one frame between having a target and knowing its
  // size, so it never flashes centered before it anchors.
  const measuring = Boolean(rect) && !coachPos;
  // The card is only ever shown attached to its target (or centered as a
  // last-resort fallback). While we navigate to a step's page and wait for the
  // target to mount, we keep just the dim scrim up — so the card never floats
  // over an unrelated page mid-navigation.
  const showCard = Boolean(rect) || stuck;

  return createPortal(
    <div aria-live="polite">
      {/* Click blocker — dims the whole screen while locating; once anchored the
          hole's box-shadow supplies the dim and this just captures clicks. */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          background: rect ? "transparent" : SCRIM,
          transition: "background .2s ease",
        }}
      />

      {holeStyle && <div style={holeStyle} />}

      {/* Coach layer — holds the card once its target is located, or a spinner
          while we navigate to the step's page. Flex-centers until it anchors. */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 102,
          pointerEvents: "none",
          display: anchored ? "block" : "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: anchored ? 0 : 12,
        }}
      >
        {showCard ? (
        <div
          ref={coachRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
          className={
            "animate-reveal w-[min(320px,calc(100vw-24px))] rounded-[12px] border bg-popover p-4 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.7)] " +
            (step.accent
              ? "border-primary/50 ring-1 ring-primary/25"
              : "border-border")
          }
          style={
            anchored
              ? {
                  position: "absolute",
                  top: coachPos!.top,
                  left: coachPos!.left,
                  pointerEvents: "auto",
                }
              : {
                  position: "relative",
                  pointerEvents: "auto",
                  visibility: measuring ? "hidden" : "visible",
                }
          }
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
              Step {index + 1} / {STEPS.length}
            </span>
            <button
              onClick={onEnd}
              className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Skip
            </button>
          </div>
          <h2
            id="tour-title"
            className="mb-1.5 text-base font-medium text-foreground"
          >
            {step.title}
          </h2>
          <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
            {step.body}
          </p>
          {step.promptPush && (
            <Button
              size="sm"
              onClick={allowPush}
              disabled={pushBusy}
              className="mb-3 w-full"
            >
              {pushBusy ? "Enabling…" : "Allow notifications"}
            </Button>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  aria-hidden
                  className={
                    "h-1.5 rounded-full transition-all " +
                    (i === index
                      ? "w-4 bg-primary"
                      : i < index
                        ? "w-1.5 bg-primary/50"
                        : "w-1.5 bg-border")
                  }
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {index > 0 && (
                <Button variant="outline" size="sm" onClick={back}>
                  Back
                </Button>
              )}
              <Button
                variant={step.promptPush ? "outline" : "primary"}
                size="sm"
                onClick={next}
              >
                {isLast ? "Finish" : "Next"}
              </Button>
            </div>
          </div>
        </div>
        ) : slowLoad ? (
          <div
            aria-hidden
            className="h-7 w-7 animate-spin rounded-full border-2 border-white/25 border-t-white"
          />
        ) : null}
      </div>
    </div>,
    document.body
  );
}
