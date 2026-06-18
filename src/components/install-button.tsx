"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

/** The non-standard event Chromium fires when the app meets install criteria. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * In-app "Install app" affordance. Renders only when installation is actually
 * possible and the app isn't already installed:
 *  - Android / desktop Chromium: captures `beforeinstallprompt` and triggers the
 *    native install dialog on click.
 *  - iOS Safari: never fires the event, so we surface manual Share-sheet steps.
 *  - Standalone (already installed): renders nothing.
 */
export function InstallButton() {
  const [promptEvent, setPromptEvent] =
    React.useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = React.useState(false);
  const [installed, setInstalled] = React.useState(false);

  React.useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    // iPadOS 13+ masquerades as macOS — distinguish it by touch support.
    const iPadOS = /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
    setIsIOS(ios || iPadOS);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      toast({
        kind: "success",
        title: "KaveLog installed",
        description: "Find it on your home screen or app list.",
      });
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  if (!promptEvent && !isIOS) return null;

  async function handleClick() {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") setPromptEvent(null);
      return;
    }
    // iOS has no programmatic install — walk the user through the Share sheet.
    toast({
      kind: "info",
      title: "Install KaveLog",
      description: "Tap the Share button, then “Add to Home Screen”.",
    });
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleClick}
      aria-label="Install app"
      title="Install KaveLog"
    >
      <Download size={15} />
      <span className="hidden sm:inline">Install app</span>
    </Button>
  );
}
