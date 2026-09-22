import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tarjeta de cifra. Siempre lleva a algun lado: un numero que no se puede abrir
 * no sirve para trabajar.
 */
export function Stat({
  value,
  label,
  help,
  href,
  tone = "neutro",
  icon: Icon,
}: {
  value: string | number;
  label: string;
  help?: string;
  href?: string;
  tone?: "neutro" | "bueno" | "atencion" | "critico" | "marca";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const tones = {
    neutro: { ring: "border-line-soft", num: "text-ink", chip: "bg-off-soft text-muted" },
    bueno: { ring: "border-ok/20", num: "text-ok", chip: "bg-ok-soft text-ok" },
    atencion: { ring: "border-warn/25", num: "text-warn", chip: "bg-warn-soft text-warn" },
    critico: { ring: "border-danger/25", num: "text-danger", chip: "bg-danger-soft text-danger" },
    marca: { ring: "border-brand/20", num: "text-brand-dark", chip: "bg-brand-light text-brand-dark" },
  }[tone];

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={cn("tnum text-[28px] font-semibold leading-none", tones.num)}>{value}</span>
        {Icon ? (
          <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", tones.chip)}>
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-2.5 text-[13px] font-medium leading-snug text-ink">{label}</p>
      {help ? <p className="mt-0.5 text-[12px] leading-snug text-muted">{help}</p> : null}
    </>
  );

  const base = cn(
    "block rounded-lg border bg-white px-4 py-3.5 shadow-[var(--shadow-card)] transition-shadow",
    tones.ring,
  );

  if (!href) return <div className={base}>{body}</div>;

  return (
    <Link href={href} className={cn(base, "hover:shadow-[var(--shadow-raised)]")}>
      {body}
    </Link>
  );
}

/** Cifra de dinero grande, para pipeline y cobros. */
export function MoneyStat({
  amount,
  label,
  help,
  href,
  tone = "neutro",
}: {
  amount: string;
  label: string;
  help?: string;
  href?: string;
  tone?: "neutro" | "bueno" | "atencion" | "critico" | "marca";
}) {
  const color = {
    neutro: "text-ink",
    bueno: "text-ok",
    atencion: "text-warn",
    critico: "text-danger",
    marca: "text-brand-dark",
  }[tone];

  const body = (
    <>
      <p className="eyebrow">{label}</p>
      <p className={cn("tnum mt-1.5 break-anywhere text-[24px] font-semibold leading-tight sm:text-[27px]", color)}>
        {amount}
      </p>
      {help ? <p className="mt-1 text-[12px] leading-snug text-muted">{help}</p> : null}
    </>
  );

  const base = "block rounded-lg border border-line-soft bg-white px-4 py-4 shadow-[var(--shadow-card)]";
  if (!href) return <div className={base}>{body}</div>;
  return (
    <Link href={href} className={cn(base, "transition-shadow hover:shadow-[var(--shadow-raised)]")}>
      {body}
    </Link>
  );
}
