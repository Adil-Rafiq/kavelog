import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SessionProvider } from "next-auth/react";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.status !== "active") redirect("/pending");

  return (
    <SessionProvider session={session}>
      <AppShell user={session.user}>{children}</AppShell>
    </SessionProvider>
  );
}
