import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { supportTickets, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminTicketsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");

  const tickets = await db
    .select({
      id: supportTickets.id,
      subject: supportTickets.subject,
      status: supportTickets.status,
      updatedAt: supportTickets.updatedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(supportTickets)
    .leftJoin(users, eq(supportTickets.userId, users.id))
    .orderBy(desc(supportTickets.updatedAt));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Admin
        </span>
        <h1 className="text-2xl text-foreground">Support tickets</h1>
      </header>
      <Card className="overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">From</th>
              <th className="px-4 py-3 text-left">Subject</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Updated</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                  No tickets yet.
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-border/50 hover:bg-secondary/30"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {t.userName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.userEmail}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/tickets/${t.id}`}
                      className="text-foreground hover:underline"
                    >
                      {t.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={t.status === "open" ? "signal" : "outline"}
                    >
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
