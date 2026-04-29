import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { HolidaysAdmin } from "./holidays-admin";

export const dynamic = "force-dynamic";

export default async function AdminHolidaysPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Admin
        </span>
        <h1 className="text-2xl text-foreground">Holidays</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Holidays reduce the monthly hour target for everyone and skip the
          auto-absent marker.
        </p>
      </header>
      <HolidaysAdmin />
    </div>
  );
}
