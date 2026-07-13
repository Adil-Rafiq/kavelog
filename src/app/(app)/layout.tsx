import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { SessionProvider } from "next-auth/react";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { AppShell } from "@/components/app-shell";
import { TourProvider } from "@/components/tour/onboarding-tour";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.status !== "active") redirect("/pending");

  // First-login walkthrough auto-starts until the user has finished/skipped it.
  const [row] = await db
    .select({ onboardedAt: users.onboardedAt })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const needsOnboarding = !row?.onboardedAt;

  return (
    <SessionProvider session={session}>
      <TourProvider autoStart={needsOnboarding}>
        <AppShell user={session.user}>{children}</AppShell>
      </TourProvider>
    </SessionProvider>
  );
}
