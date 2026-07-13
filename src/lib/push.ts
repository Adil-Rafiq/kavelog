import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { pushSubscriptions, type PushSubscriptionRow } from "@/db/schema";

/**
 * Web Push delivery. Reminders are push-only (they never land in the in-app
 * notification bell), so this is the single path a reminder takes to a device.
 *
 * VAPID keys come from env (see .env.example). If they're missing the module
 * quietly no-ops rather than throwing, so a deploy without push configured
 * still runs — reminders simply don't go out.
 */

export interface PushPayload {
  title: string;
  body: string;
  /** In-app path to open when the notification is clicked (default "/"). */
  url?: string;
  /** Collapses/replaces same-tag notifications on the device. */
  tag?: string;
}

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

/**
 * Send a payload to a specific set of subscription rows, pruning any the push
 * service reports as gone. Returns the number of successful deliveries.
 */
export async function sendToSubscriptions(
  subs: PushSubscriptionRow[],
  payload: PushPayload
): Promise<number> {
  if (!ensureConfigured() || subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
        sent++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // 404/410 mean the subscription is permanently gone — prune it so we
        // stop trying. Other errors (timeouts, 5xx) are transient; leave them.
        if (statusCode === 404 || statusCode === 410) {
          dead.push(sub.id);
        }
      }
    })
  );

  if (dead.length > 0) {
    await db
      .delete(pushSubscriptions)
      .where(inArray(pushSubscriptions.id, dead));
  }

  return sent;
}

/**
 * Send a payload to every device a single user has subscribed.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<number> {
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  return sendToSubscriptions(subs, payload);
}
