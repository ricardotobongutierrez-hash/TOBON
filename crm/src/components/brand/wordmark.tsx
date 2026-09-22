import { cn } from "@/lib/utils";

/**
 * JOSE I. TOBON — EXPERTOS EN NEGOCIACION.
 *
 * Con `asset` se pinta el logo oficial sin alterarlo. Sin el, se compone el
 * nombre en tipografia serif, que es el nombre de la firma, no una marca nueva.
 */
export function Wordmark({
  asset,
  size = "md",
  variant = "oscuro",
  className,
}: {
  asset?: string | null;
  size?: "sm" | "md" | "lg";
  variant?: "oscuro" | "claro";
  className?: string;
}) {
  const scale = {
    sm: { name: "text-[12px]", tag: "text-[8px]", img: "h-6" },
    md: { name: "text-[15px]", tag: "text-[9px]", img: "h-8" },
    lg: { name: "text-[22px]", tag: "text-[11px]", img: "h-12" },
  }[size];

  if (asset) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={asset}
        alt="José I. Tobón — Expertos en Negociación"
        className={cn("w-auto shrink-0 object-contain", scale.img, className)}
      />
    );
  }

  const nameColor = variant === "claro" ? "text-white" : "text-ink";
  const tagColor = variant === "claro" ? "text-accent" : "text-brand";
  const ruleColor = variant === "claro" ? "bg-white/25" : "bg-line";

  return (
    <span className={cn("flex min-w-0 flex-col leading-none", className)}>
      <span
        className={cn("brand-wordmark font-semibold uppercase", scale.name, nameColor)}
        style={{ letterSpacing: "0.06em" }}
      >
        José I. Tobón
      </span>
      <span className="mt-1 flex items-center gap-1.5">
        <span className={cn("h-px w-3 shrink-0", ruleColor)} aria-hidden />
        <span
          className={cn("font-semibold uppercase", scale.tag, tagColor)}
          style={{ letterSpacing: "0.16em" }}
        >
          Expertos en Negociación
        </span>
      </span>
    </span>
  );
}
