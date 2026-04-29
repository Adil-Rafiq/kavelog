"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export function SettingsAdmin() {
  const [openRegistration, setOpenRegistration] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        setOpenRegistration(!!d.openRegistration);
        setLoaded(true);
      });
  }, []);

  async function toggle(next: boolean) {
    setPending(true);
    setOpenRegistration(next);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openRegistration: next }),
    });
    setPending(false);
    if (!res.ok) {
      toast({ kind: "error", title: "Could not save" });
      setOpenRegistration(!next);
      return;
    }
    toast({
      kind: "success",
      title: next ? "Open registration on" : "Approval required",
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <div className="text-sm font-medium text-foreground">
            Open registration
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            When on, new accounts are immediately active. When off, they sit in
            a pending state until you approve them.
          </p>
        </div>
        <button
          onClick={() => toggle(!openRegistration)}
          disabled={!loaded || pending}
          aria-pressed={openRegistration}
          className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
            openRegistration
              ? "border-primary/40 bg-primary"
              : "border-border bg-secondary"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform ${
              openRegistration ? "translate-x-6" : "translate-x-0.5"
            }`}
          />
        </button>
      </CardContent>
    </Card>
  );
}
