import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tabla contenida: la cabecera se queda pegada al desplazar y el ancho no
 * explota. En movil las vistas usan tarjetas, no esta tabla encogida.
 */
export function DataTable({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("scroll-thin relative w-full overflow-x-auto", className)}>
      <table className="w-full min-w-full border-collapse text-left text-[14px]" {...props} />
    </div>
  );
}

export function Thead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("sticky top-0 z-10 bg-canvas/95 backdrop-blur-sm", className)}
      {...props}
    />
  );
}

export function Th({
  className,
  align = "left",
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line-soft px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted whitespace-nowrap",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("border-b border-line-soft transition-colors hover:bg-canvas", className)} {...props} />
  );
}

export function Td({
  className,
  align = "left",
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "px-3 py-2.5 align-middle",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}
