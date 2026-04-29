import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DepartmentsAdmin } from "./departments-admin";

export const dynamic = "force-dynamic";

export default async function AdminDepartmentsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Admin
        </span>
        <h1 className="text-2xl text-foreground">Departments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Departments determine an employee&apos;s shift.
        </p>
      </header>
      <DepartmentsAdmin />
    </div>
  );
}
