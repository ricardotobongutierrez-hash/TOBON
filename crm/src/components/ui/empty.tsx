import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Estado vacio con un mensaje util y una accion. Nunca una pantalla en blanco:
 * si no hay nada, se dice por que y que hacer.
 */
export function Empty({
  icon: Icon,
  title,
  message,
  action,
  tone = "neutro",
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  message?: string;
  action?: React.ReactNode;
  tone?: "neutro" | "bueno";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {Icon ? (
        <div
          className={cn(
            "mb-3 flex size-11 items-center justify-center rounded-full",
            tone === "bueno" ? "bg-ok-soft text-ok" : "bg-off-soft text-muted",
          )}
        >
          <Icon className="size-5" />
        </div>
      ) : null}
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {message ? <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{message}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
