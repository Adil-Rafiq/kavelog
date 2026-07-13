import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, departments } from "@/db/schema";
import { auth } from "@/auth";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(2).max(100).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  autoLogShift: z.boolean().optional(),
});

/**
 * Partially update the signed-in user's own profile. Only the fields present in
 * the request body are changed, so the account page can save the profile form
 * (name + department) and the "auto-log my shift" toggle independently without
 * clobbering each other.
 */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, departmentId, autoLogShift } = parsed.data;

  const updates: Partial<typeof users.$inferInsert> = {};
  if (name !== undefined) updates.name = name.trim();
  if (departmentId !== undefined) updates.departmentId = departmentId;
  if (autoLogShift !== undefined) updates.autoLogShift = autoLogShift;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No fields to update." },
      { status: 400 }
    );
  }

  if (departmentId) {
    const [dept] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, departmentId))
      .limit(1);
    if (!dept) {
      return NextResponse.json(
        { error: "Selected department not found." },
        { status: 400 }
      );
    }
  }

  updates.updatedAt = new Date();
  await db.update(users).set(updates).where(eq(users.id, session.user.id));

  return NextResponse.json({ ok: true });
}
