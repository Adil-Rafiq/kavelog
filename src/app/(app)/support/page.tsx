import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { supportTickets } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tickets = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, session.user.id))
    .orderBy(desc(supportTickets.updatedAt));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Support
          </span>
          <h1 className="text-2xl text-foreground">Your tickets</h1>
        </div>
        <Link href="/support/new">
          <Button size="sm">
            <Plus size={14} />
            New ticket
          </Button>
        </Link>
      </header>

      <Card className="overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Subject</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Updated</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-12 text-center text-sm text-muted-foreground">
                  No tickets yet. Open one if you need help.
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-border/50 hover:bg-secondary/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/support/${t.id}`}
                      className="text-foreground hover:underline"
                    >
                      {t.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={t.status === "open" ? "signal" : "outline"}>
                      {t.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular text-muted-foreground">
                    {new Date(t.updatedAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
