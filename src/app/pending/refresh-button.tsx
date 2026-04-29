"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export function RefreshButton() {
  const { update } = useSession();
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function check() {
    setPending(true);
    try {
      const updated = await update({ refresh: true });
      const status = updated?.user?.status;
      if (status === "active") {
        toast({
          kind: "success",
          title: "You're approved",
          description: "Taking you in…",
        });
        router.push("/");
        router.refresh();
      } else if (status === "rejected") {
        toast({
          kind: "error",
          title: "Account rejected",
          description: "Please contact your admin.",
        });
        router.refresh();
      } else {
        toast({
          kind: "info",
          title: "Still pending",
          description: "Check back in a bit.",
        });
      }
    } catch {
      toast({ kind: "error", title: "Could not check status" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button onClick={check} disabled={pending}>
      <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
      {pending ? "Checking…" : "Check status"}
    </Button>
  );
}
