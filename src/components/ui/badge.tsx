import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-border bg-secondary text-secondary-foreground",
        present:
          "border-success/30 bg-success/10 text-success",
        absent:
          "border-destructive/30 bg-destructive/10 text-destructive",
        leave:
          "border-warning/30 bg-warning/10 text-warning",
        weekend:
          "border-border bg-muted/50 text-muted-foreground",
        holiday:
          "border-info/30 bg-info/10 text-info",
        signal:
          "border-primary/40 bg-primary/15 text-primary",
        outline:
          "border-border bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

/**
 * StatusDot — a small filled circle used inline beside text labels.
 * Color-codes attendance status without taking up much room.
 */
export function StatusDot({
  status,
  className,
}: {
  status: "present" | "absent" | "leave" | "weekend" | "holiday";
  className?: string;
}) {
  const color = {
    present: "bg-success",
    absent: "bg-destructive",
    leave: "bg-warning",
    weekend: "bg-muted-foreground/40",
    holiday: "bg-info",
  }[status];
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full",
        color,
        className
      )}
    />
  );
}
