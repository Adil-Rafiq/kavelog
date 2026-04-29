import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshButton } from "./refresh-button";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.status === "active") redirect("/");

  const isRejected = session.user.status === "rejected";

  return (
    <SessionProvider session={session}>
      <div className="flex min-h-screen flex-col">
        <header className="p-5">
          <span className="wordmark text-xl text-foreground/80">KaveLog</span>
        </header>
        <main className="flex flex-1 items-center justify-center px-5">
          <Card className="w-full max-w-md p-8">
            <CardContent className="flex flex-col items-start gap-4 p-0">
              <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                {isRejected ? "Account rejected" : "Awaiting approval"}
              </span>
              <h1 className="text-2xl text-foreground">
                {isRejected
                  ? "Your account was rejected."
                  : "Your account is pending approval."}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isRejected
                  ? "If you think this was a mistake, please reach out to your admin."
                  : "An admin will review your account shortly. Once approved, click below to refresh your access."}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <RefreshButton />
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <Button variant="outline" type="submit">
                    Sign out
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </SessionProvider>
  );
}
