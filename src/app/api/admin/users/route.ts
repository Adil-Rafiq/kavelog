import { NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { departments, users } from "@/db/schema";
import { auth } from "@/auth";
import { notify } from "@/lib/notifications";

export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ items: [] }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as
    | "pending"
    | "active"
    | "rejected"
    | null;

  const where = status ? eq(users.status, status) : undefined;
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
      departmentId: users.departmentId,
      departmentName: departments.name,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(where)
    .orderBy(asc(users.createdAt));
  return NextResponse.json({ items: rows });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "active", "rejected"]).optional(),
  role: z.enum(["admin", "employee"]).optional(),
  departmentId: z.string().uuid().nullable().optional(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { id, ...patch } = parsed.data;
  const [previous] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const [updated] = await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();

  if (patch.status && patch.status !== previous.status) {
    if (patch.status === "active" && previous.status === "pending") {
      await notify({
        userId: id,
        type: "account_approved",
        title: "Account approved",
        message: "Welcome to KaveLog. You can now clock in.",
        link: "/",
      });
    } else if (patch.status === "rejected") {
      await notify({
        userId: id,
        type: "account_rejected",
        title: "Account rejected",
        message: "Your account was rejected by an admin.",
        link: null,
      });
    }
  }

  return NextResponse.json({ ok: true, item: updated });
}

const deleteSchema = z.object({
  id: z.string().uuid(),
});

export async function DELETE(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { id } = parsed.data;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 }
    );
  }

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // FK cascades drop attendance records, notifications, support tickets +
  // messages, and password-reset tokens for this user automatically.
  await db.delete(users).where(eq(users.id, id));

  return NextResponse.json({ ok: true });
}
