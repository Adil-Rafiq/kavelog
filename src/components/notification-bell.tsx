"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Notif {
  id: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [items, setItems] = React.useState<Notif[]>([]);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => !n.read).length;

  const fetchItems = React.useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = (await res.json()) as { items: Notif[] };
    setItems(data.items);
  }, []);

  React.useEffect(() => {
    fetchItems();
    const id = setInterval(fetchItems, 60_000);
    return () => clearInterval(id);
  }, [fetchItems]);

  React.useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "POST" });
    fetchItems();
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse-soft" />
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 origin-top-right rounded-[12px] border border-border bg-popover shadow-xl animate-reveal">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Notifications
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nothing yet.
              </div>
            ) : (
              items.map((n) => (
                <NotifRow key={n.id} item={n} onClose={() => setOpen(false)} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotifRow({ item, onClose }: { item: Notif; onClose: () => void }) {
  const className = cn(
    "block border-b border-border/50 px-4 py-3 transition-colors hover:bg-secondary/40 last:border-0",
    !item.read && "bg-primary/5"
  );
  const inner = (
    <div className="flex items-start gap-3">
      {!item.read && (
        <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      )}
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{item.title}</div>
        <div className="text-xs text-muted-foreground">{item.message}</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60 tabular">
          {new Date(item.createdAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
  if (item.link) {
    return (
      <Link href={item.link} onClick={onClose} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <div className={className} onClick={onClose}>
      {inner}
    </div>
  );
}
