import { NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { supportMessages, supportTickets, users } from "@/db/schema";
import { auth } from "@/auth";
import { notify } from "@/lib/notifications";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, id))
    .limit(1);
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticket.userId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const messages = await db
    .select({
      id: supportMessages.id,
      message: supportMessages.message,
      createdAt: supportMessages.createdAt,
      userId: supportMessages.userId,
      userName: users.name,
      userRole: users.role,
    })
    .from(supportMessages)
    .leftJoin(users, eq(supportMessages.userId, users.id))
    .where(eq(supportMessages.ticketId, id))
    .orderBy(asc(supportMessages.createdAt));

  return NextResponse.json({ ticket, messages });
}

const replySchema = z.object({
  message: z.string().min(1).max(2000),
  close: z.boolean().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.status !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, id))
    .limit(1);
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticket.userId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.insert(supportMessages).values({
    ticketId: id,
    userId: session.user.id,
    message: parsed.data.message,
  });

  await db
    .update(supportTickets)
    .set({
      updatedAt: new Date(),
      status: parsed.data.close ? "closed" : ticket.status,
    })
    .where(eq(supportTickets.id, id));

  // Notify the other party
  const recipientId =
    session.user.id === ticket.userId
      ? // ticket creator replied → notify all admins
        null
      : ticket.userId;
  if (recipientId) {
    await notify({
      userId: recipientId,
      type: "ticket_reply",
      title: "Admin replied to your ticket",
      message: parsed.data.message.slice(0, 120),
      link: `/support/${id}`,
    });
  } else {
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"));
    for (const a of admins) {
      await notify({
        userId: a.id,
        type: "ticket_reply",
        title: "New reply on a ticket",
        message: parsed.data.message.slice(0, 120),
        link: `/admin/tickets/${id}`,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
