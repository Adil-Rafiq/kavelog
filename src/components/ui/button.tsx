"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors signal-ring disabled:pointer-events-none disabled:opacity-40 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_1px_0_0_hsl(0_0%_100%/0.15)_inset,0_8px_24px_-12px_hsl(var(--primary)/0.6)]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70 border border-border",
        ghost:
          "text-foreground hover:bg-secondary/60",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-secondary/50",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link:
          "text-primary underline-offset-4 hover:underline px-0 py-0",
      },
      size: {
        sm: "h-8 px-3 text-[13px] rounded-[6px]",
        md: "h-10 px-4 text-sm rounded-[8px]",
        lg: "h-12 px-5 text-base rounded-[10px]",
        icon: "h-9 w-9 rounded-[8px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
