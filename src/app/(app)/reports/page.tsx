import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ReportsView } from "./reports-view";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Reports
        </span>
        <h1 className="text-2xl text-foreground">
          Monthly summary &{" "}
          <span className="wordmark text-primary">year-to-date</span>
        </h1>
      </header>

      <ReportsView role={session.user.role} />
    </div>
  );
}
