import { NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  supportMessages,
  supportTickets,
  users,
} from "@/db/schema";
import { auth } from "@/auth";
import { notify } from "@/lib/notifications";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ items: [] }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope"); // "all" for admin
  const isAdmin = session.user.role === "admin";

  const where =
    isAdmin && scope === "all"
      ? undefined
      : eq(supportTickets.userId, session.user.id);

  const rows = await db
    .select({
      id: supportTickets.id,
      subject: supportTickets.subject,
      status: supportTickets.status,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(supportTickets)
    .leftJoin(users, eq(supportTickets.userId, users.id))
    .where(where)
    .orderBy(desc(supportTickets.updatedAt));

  return NextResponse.json({ items: rows });
}

const createSchema = z.object({
  subject: z.string().min(2).max(200),
  message: z.string().min(2).max(2000),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.status !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const [ticket] = await db
    .insert(supportTickets)
    .values({
      userId: session.user.id,
      subject: parsed.data.subject,
    })
    .returning();
  await db.insert(supportMessages).values({
    ticketId: ticket.id,
    userId: session.user.id,
    message: parsed.data.message,
  });

  // Notify admins
  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"));
  if (admins.length) {
    for (const a of admins) {
      await notify({
        userId: a.id,
        type: "ticket_opened",
        title: "New support ticket",
        message: `${session.user.name ?? session.user.email}: ${parsed.data.subject}`,
        link: `/admin/tickets/${ticket.id}`,
      });
    }
  }

  return NextResponse.json({ ok: true, id: ticket.id });
}
