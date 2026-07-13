import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { auth } from "@/auth";

export const runtime = "nodejs";

/**
 * Marks the signed-in user's first-login walkthrough as seen (finished or
 * skipped) by stamping `onboarded_at`. Idempotent — safe to call on every
 * completion, including replays. Once set, the tour never auto-starts again.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .update(users)
    .set({ onboardedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ ok: true });
}
