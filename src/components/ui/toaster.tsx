"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

let _emit: ((t: Omit<Toast, "id">) => void) | null = null;

export function toast(t: Omit<Toast, "id">) {
  _emit?.(t);
}

export function Toaster() {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  React.useEffect(() => {
    _emit = (t) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, 4500);
    };
    return () => {
      _emit = null;
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 sm:top-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-[12px] border bg-card px-4 py-3 shadow-lg",
            "animate-reveal",
            t.kind === "success" && "border-success/30",
            t.kind === "error" && "border-destructive/30",
            t.kind === "info" && "border-border"
          )}
        >
          <span className="mt-0.5">
            {t.kind === "success" && (
              <CheckCircle2 size={16} className="text-success" />
            )}
            {t.kind === "error" && (
              <AlertCircle size={16} className="text-destructive" />
            )}
            {t.kind === "info" && (
              <Info size={16} className="text-info" />
            )}
          </span>
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">{t.title}</div>
            {t.description && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {t.description}
              </div>
            )}
          </div>
          <button
            onClick={() =>
              setToasts((prev) => prev.filter((x) => x.id !== t.id))
            }
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
