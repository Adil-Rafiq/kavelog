import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="flex items-center justify-between p-5">
        <span className="wordmark text-xl text-foreground/80">KaveLog</span>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        {children}
      </main>
      <footer className="border-t border-border/50 px-5 py-4 text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Field instrument · v0.1
      </footer>
    </div>
  );
}
