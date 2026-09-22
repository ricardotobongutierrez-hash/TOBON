"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Los botones se ven como botones. Area de clic amplia, texto siempre visible,
 * nunca solo un icono cuando la accion no es obvia.
 */
const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white hover:bg-brand-dark active:bg-brand-dark shadow-xs",
        ink: "bg-ink text-white hover:bg-ink-80 active:bg-ink-80",
        outline: "border border-line bg-white text-ink hover:bg-canvas hover:border-muted-light",
        ghost: "text-ink hover:bg-brand-light",
        quiet: "text-muted hover:bg-off-soft hover:text-ink",
        danger: "border border-danger/30 bg-white text-danger hover:bg-danger-soft",
        link: "text-brand underline underline-offset-2 hover:text-brand-dark",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-5 text-[15px]",
        icon: "size-9",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, asChild, loading, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          <span>Guardando…</span>
        </>
      ) : (
        children
      )}
    </Comp>
  );
});

export { buttonVariants };
