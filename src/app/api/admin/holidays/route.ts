import { NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { holidays } from "@/db/schema";
import { auth } from "@/auth";

export async function GET() {
  const items = await db
    .select()
    .from(holidays)
    .orderBy(asc(holidays.date));
  return NextResponse.json({ items });
}

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1).max(100),
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
      .insert(holidays)
      .values(parsed.data)
      .returning();
    return NextResponse.json({ ok: true, item: created });
  } catch {
    return NextResponse.json(
      { error: "A holiday already exists on that date." },
      { status: 409 }
    );
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await db.delete(holidays).where(eq(holidays.id, id));
  return NextResponse.json({ ok: true });
}
