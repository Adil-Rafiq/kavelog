import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TicketThread } from "@/components/ticket-thread";

export const dynamic = "force-dynamic";

export default async function AdminTicketDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");
  const { id } = await params;
  return <TicketThread id={id} backHref="/admin/tickets" canClose />;
}
