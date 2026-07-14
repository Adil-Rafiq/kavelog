/**
 * Browser-side Web Push helpers used by the Account "reminders" toggle.
 *
 * Push requires a service worker + the Push API + Notifications. On iOS these
 * only exist once the PWA is installed to the Home Screen, so callers should
 * treat `unsupported` as "install the app first" rather than a hard failure.
 */

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function readyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  // Rely on PwaRegister having registered /sw.js (production only — it skips dev
  // on purpose). If nothing is registered, bail rather than register here, so we
  // don't reintroduce the stale-chunk problem in dev. `ready` only resolves when
  // a registration exists, so guard on getRegistration() first to avoid hanging.
  const existing = await navigator.serviceWorker.getRegistration();
  if (!existing) return null;
  return navigator.serviceWorker.ready;
}

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "error" };

export async function subscribeToPush(): Promise<SubscribeResult> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) return { ok: false, reason: "error" };

  // Must run inside the click gesture — request permission before anything else.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  try {
    const reg = await readyRegistration();
    if (!reg) return { ok: false, reason: "error" };

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
    }

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys) return { ok: false, reason: "error" };

    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    return res.ok ? { ok: true } : { ok: false, reason: "error" };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * Whether this device already holds a live push subscription. Used by the
 * account toggle to tell "reminders on account-wide" apart from "this device is
 * actually set up to receive them" — the two can diverge when reminders default
 * on but the browser has never been granted permission.
 */
export async function isSubscribedOnThisDevice(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return Boolean(sub);
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  await fetch("/api/push", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
}
