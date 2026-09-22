"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * "Mis pendientes" frente a "Todo el equipo". Es un cambio de foco, no de
 * permisos: los tres usuarios ven la misma informacion comercial.
 */
export function ScopeToggle({ paramName = "vista" }: { paramName?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(paramName) === "equipo" ? "equipo" : "mios";

  function set(value: "mios" | "equipo") {
    const next = new URLSearchParams(params.toString());
    if (value === "mios") next.delete(paramName);
    else next.set(paramName, value);
    router.push(`${pathname}${next.toString() ? `?${next}` : ""}`);
  }

  return (
    <div
      className="inline-flex shrink-0 rounded-md border border-line bg-white p-0.5"
      role="group"
      aria-label="Qué quieres ver"
    >
      {(
        [
          { value: "mios", label: "Mis pendientes" },
          { value: "equipo", label: "Todo el equipo" },
        ] as const
      ).map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => set(option.value)}
          aria-pressed={current === option.value}
          className={cn(
            "rounded-[4px] px-3 py-1.5 text-[13px] font-medium transition-colors",
            current === option.value ? "bg-ink text-white" : "text-muted hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
