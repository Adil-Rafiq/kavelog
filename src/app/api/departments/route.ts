import { NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { departments } from "@/db/schema";
import { auth } from "@/auth";

export async function GET() {
  const items = await db
    .select()
    .from(departments)
    .orderBy(asc(departments.name));
  return NextResponse.json({ items });
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  shift: z.enum(["first", "second"]).default("first"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  try {
    const [created] = await db
      .insert(departments)
      .values(parsed.data)
      .returning();
    return NextResponse.json({ ok: true, item: created });
  } catch {
    return NextResponse.json(
      { error: "A department with that name already exists." },
      { status: 409 }
    );
  }
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  shift: z.enum(["first", "second"]).optional(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { id, ...patch } = parsed.data;
  const [updated] = await db
    .update(departments)
    .set(patch)
    .where(eq(departments.id, id))
    .returning();
  return NextResponse.json({ ok: true, item: updated });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  await db.delete(departments).where(eq(departments.id, id));
  return NextResponse.json({ ok: true });
}
