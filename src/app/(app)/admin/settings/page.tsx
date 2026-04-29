import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SettingsAdmin } from "./settings-admin";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Admin
        </span>
        <h1 className="text-2xl text-foreground">Settings</h1>
      </header>
      <SettingsAdmin />
    </div>
  );
}
