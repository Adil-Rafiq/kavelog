"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Calendar,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Settings,
  Users,
  CalendarDays,
  ChartLine,
  Building2,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { InstallButton } from "@/components/install-button";

interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: "admin" | "employee";
}

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const nav = [
    { href: "/", label: "Today", icon: LayoutDashboard },
    { href: "/calendar", label: "Calendar", icon: Calendar },
    { href: "/reports", label: "Reports", icon: ChartLine },
    { href: "/support", label: "Support", icon: LifeBuoy },
  ];

  const adminNav = [
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/departments", label: "Departments", icon: Building2 },
    { href: "/admin/holidays", label: "Holidays", icon: CalendarDays },
    { href: "/admin/tickets", label: "Tickets", icon: LifeBuoy },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — hidden on mobile, slide-in via menu */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-border bg-background/95 backdrop-blur",
          "transform transition-transform duration-200 ease-out md:translate-x-0 md:static md:bg-background/40",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between p-5">
            <Link href="/" className="wordmark text-2xl text-foreground">
              KaveLog
            </Link>
            <button
              onClick={() => setOpen(false)}
              className="md:hidden text-muted-foreground hover:text-foreground"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 px-3">
            <SectionLabel>Workspace</SectionLabel>
            {nav.map((n) => (
              <NavLink
                key={n.href}
                href={n.href}
                icon={n.icon}
                label={n.label}
                active={isActive(n.href)}
                onClick={() => setOpen(false)}
              />
            ))}

            {user.role === "admin" && (
              <>
                <SectionLabel className="mt-6">Admin</SectionLabel>
                {adminNav.map((n) => (
                  <NavLink
                    key={n.href}
                    href={n.href}
                    icon={n.icon}
                    label={n.label}
                    active={isActive(n.href)}
                    onClick={() => setOpen(false)}
                  />
                ))}
              </>
            )}
          </nav>

          <div className="border-t border-border/60 p-3">
            <div className="flex items-center justify-between gap-2 rounded-[10px] bg-secondary/40 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-foreground">
                  {user.name || user.email}
                </div>
                <div className="truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {user.role}
                </div>
              </div>
              <button
                onClick={async () => {
                  await signOut({ redirect: false });
                  router.push("/login");
                }}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Backdrop on mobile */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="md:hidden text-muted-foreground hover:text-foreground"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
            <span className="hidden text-[11px] uppercase tracking-[0.22em] text-muted-foreground md:inline">
              {pathname === "/" ? "Today" : pathname?.replace("/", "").split("/")[0]}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <InstallButton />
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-3 pb-2 pt-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  onClick,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-[8px] px-3 py-2 text-sm transition-colors",
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
      )}
    >
      <Icon size={16} className={cn(active && "text-primary")} />
      <span>{label}</span>
    </Link>
  );
}
