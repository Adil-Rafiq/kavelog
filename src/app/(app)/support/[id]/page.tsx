import { TicketThread } from "@/components/ticket-thread";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TicketThread id={id} backHref="/support" />;
}
