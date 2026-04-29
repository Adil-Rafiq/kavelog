import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, departments, notifications } from "@/db/schema";
import { isOpenRegistration } from "@/lib/settings";

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  departmentId: z.string().uuid().nullable().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, email, password, departmentId } = parsed.data;
  const lowercased = email.toLowerCase();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, lowercased))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
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

  const open = await isOpenRegistration();
  const hash = await bcrypt.hash(password, 10);

  const [created] = await db
    .insert(users)
    .values({
      name,
      email: lowercased,
      passwordHash: hash,
      role: "employee",
      status: open ? "active" : "pending",
      departmentId: departmentId ?? null,
    })
    .returning({ id: users.id });

  if (!open) {
    // Notify all admins
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"));
    if (admins.length) {
      await db.insert(notifications).values(
        admins.map((a) => ({
          userId: a.id,
          type: "registration_pending" as const,
          title: "New registration pending",
          message: `${name} (${lowercased}) is awaiting approval.`,
          link: "/admin/users",
        }))
      );
    }
  }

  return NextResponse.json({
    ok: true,
    userId: created.id,
    openRegistration: open,
  });
}
