import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { departments } from "@/db/schema";
import { asc } from "drizzle-orm";
import { UsersAdmin } from "./users-admin";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");

  const depts = await db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .orderBy(asc(departments.name));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Admin
        </span>
        <h1 className="text-2xl text-foreground">Users</h1>
      </header>
      <UsersAdmin departments={depts} currentUserId={session.user.id} />
    </div>
  );
}
