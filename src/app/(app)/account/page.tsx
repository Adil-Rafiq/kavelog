import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { users, departments } from "@/db/schema";
import { AccountClient } from "./account-client";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user] = await db
    .select({
      name: users.name,
      email: users.email,
      role: users.role,
      departmentId: users.departmentId,
      autoLogShift: users.autoLogShift,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) redirect("/login");

  const depts = await db
    .select({
      id: departments.id,
      name: departments.name,
      shift: departments.shift,
    })
    .from(departments)
    .orderBy(asc(departments.name));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Account
        </span>
        <h1 className="text-2xl text-foreground">Your profile</h1>
      </header>
      <AccountClient
        profile={{
          name: user.name,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId,
          autoLogShift: user.autoLogShift,
        }}
        departments={depts}
      />
    </div>
  );
}
