import * as React from "react";
import { cn } from "@/lib/utils";

/** Encabezado de pantalla: titulo, una linea de contexto y acciones. */
export function PageHeader({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("mb-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight text-ink sm:text-[25px]">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>
        {action ? (
          <div className="no-print flex min-w-0 flex-wrap items-center gap-2">{action}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-2.5 flex items-end justify-between gap-3", className)}>
      <h2 className="eyebrow">{children}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
