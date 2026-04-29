"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

interface Ticket {
  id: string;
  subject: string;
  status: "open" | "closed";
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  message: string;
  createdAt: string;
  userId: string;
  userName: string | null;
  userRole: "admin" | "employee" | null;
}

export function TicketThread({
  id,
  backHref,
  canClose,
}: {
  id: string;
  backHref: string;
  canClose?: boolean;
}) {
  const [ticket, setTicket] = React.useState<Ticket | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [reply, setReply] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/tickets/${id}`);
    const data = await res.json();
    setTicket(data.ticket);
    setMessages(data.messages ?? []);
    setLoading(false);
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function send(close = false) {
    if (!reply.trim()) return;
    setSending(true);
    const res = await fetch(`/api/tickets/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: reply, close }),
    });
    setSending(false);
    if (!res.ok) {
      toast({ kind: "error", title: "Could not send" });
      return;
    }
    setReply("");
    load();
  }

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">Loading ticket…</div>
    );
  }

  if (!ticket) {
    return <div className="text-sm text-muted-foreground">Ticket not found.</div>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Back
        </Link>
        <Badge variant={ticket.status === "open" ? "signal" : "outline"}>
          {ticket.status}
        </Badge>
      </div>

      <header>
        <h1 className="text-2xl text-foreground">{ticket.subject}</h1>
        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground tabular">
          Opened {new Date(ticket.createdAt).toLocaleString()}
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {messages.map((m) => (
          <Card
            key={m.id}
            className={cn(
              "p-4",
              m.userRole === "admin" && "border-primary/30 bg-primary/[0.03]"
            )}
          >
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {m.userName}
                </span>
                {m.userRole === "admin" && (
                  <Badge variant="signal">Admin</Badge>
                )}
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground tabular">
                {new Date(m.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-foreground/90">
              {m.message}
            </p>
          </Card>
        ))}
      </div>

      {ticket.status === "open" && (
        <Card className="p-4">
          <div className="flex flex-col gap-3">
            <Label htmlFor="reply">Your reply</Label>
            <textarea
              id="reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
              className="flex w-full rounded-[8px] border border-input bg-background/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors signal-ring"
              placeholder="Write a reply…"
            />
            <div className="flex items-center justify-end gap-2">
              {canClose && (
                <Button
                  variant="outline"
                  onClick={() => send(true)}
                  disabled={sending || !reply.trim()}
                >
                  Reply & close
                </Button>
              )}
              <Button
                onClick={() => send(false)}
                disabled={sending || !reply.trim()}
              >
                {sending ? "Sending…" : "Reply"}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
