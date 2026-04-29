import { cn } from "@/lib/utils";

export function DotDivider({ className }: { className?: string }) {
  return <div className={cn("divider-dots my-6", className)} aria-hidden />;
}

export function Hairline({ className }: { className?: string }) {
  return <hr className={cn("border-0 hairline my-6", className)} aria-hidden />;
}
