"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export function NewTicketForm() {
  const router = useRouter();
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, message }),
    });
    setPending(false);
    if (!res.ok) {
      toast({ kind: "error", title: "Could not submit" });
      return;
    }
    const data = await res.json();
    toast({ kind: "success", title: "Ticket submitted" });
    router.push(`/support/${data.id}`);
  }

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            required
            minLength={2}
            maxLength={200}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Short summary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="message">Message</Label>
          <textarea
            id="message"
            required
            minLength={2}
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className="flex w-full rounded-[8px] border border-input bg-background/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors signal-ring"
            placeholder="Describe what you need…"
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Submitting…" : "Submit ticket"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
