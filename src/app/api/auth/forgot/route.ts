import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import { db } from "@/db/client";
import { users, passwordResetTokens } from "@/db/schema";
import { sendResetEmail } from "@/lib/email";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email().max(255),
});

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: true });
  }

  const lower = parsed.data.email.toLowerCase();
  const [user] = await db
    .select({ id: users.id, status: users.status, email: users.email })
    .from(users)
    .where(eq(users.email, lower))
    .limit(1);

  if (user && user.status !== "rejected") {
    const raw = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(req.url).origin;
    const link = `${base}/reset?token=${raw}`;
    await sendResetEmail(user.email, link);
  }

  return NextResponse.json({ ok: true });
}
