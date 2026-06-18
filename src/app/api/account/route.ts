import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, departments } from "@/db/schema";
import { auth } from "@/auth";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(2).max(100),
  departmentId: z.string().uuid().nullable().optional(),
});

/** Update the signed-in user's own profile (name + department). */
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

  const { name, departmentId } = parsed.data;

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

  await db
    .update(users)
    .set({
      name: name.trim(),
      departmentId: departmentId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ ok: true });
}
