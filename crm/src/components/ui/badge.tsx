import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Los estados llevan texto y color. Nunca solo color: quien no distingue tonos
 * tiene que poder leer el estado igual.
 */
const badgeVariants = cva(
  "inline-flex max-w-full items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[12px] font-medium leading-5",
  {
    variants: {
      tone: {
        verde: "border-ok/25 bg-ok-soft text-ok",
        azul: "border-brand/25 bg-brand-light text-brand-dark",
        ambar: "border-warn/25 bg-warn-soft text-warn",
        rojo: "border-danger/25 bg-danger-soft text-danger",
        gris: "border-line bg-off-soft text-off",
        acento: "border-accent/40 bg-accent-soft text-brand-dark",
        tinta: "border-ink/15 bg-ink/5 text-ink",
      },
      size: { sm: "text-[11px] px-1.5", md: "" },
    },
    defaultVariants: { tone: "gris", size: "md" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({
  className,
  tone,
  size,
  dot,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {dot ? <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden /> : null}
      <span className="clip-1">{children}</span>
    </span>
  );
}
