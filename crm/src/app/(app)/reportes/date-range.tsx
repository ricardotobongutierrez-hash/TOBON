"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { addDays, ahora, formatDateInput, startOfMonth, startOfWeek } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Rango de fechas con los atajos que se usan de verdad. */
const PRESETS = [
  { label: "Esta semana", from: () => formatDateInput(startOfWeek(ahora(), { weekStartsOn: 1 })) },
  { label: "Este mes", from: () => formatDateInput(startOfMonth(ahora())) },
  { label: "Últimos 30 días", from: () => formatDateInput(addDays(ahora(), -30)) },
  { label: "Últimos 90 días", from: () => formatDateInput(addDays(ahora(), -90)) },
  { label: "Este año", from: () => `${ahora().getFullYear()}-01-01` },
];

export function DateRange({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function apply(nextFrom: string, nextTo: string) {
    const next = new URLSearchParams(params.toString());
    next.set("desde", nextFrom);
    next.set("hasta", nextTo);
    router.push(`/reportes?${next}`);
  }

  const today = formatDateInput(ahora());

  return (
    <div className="no-print mb-4 flex flex-wrap items-end gap-3">
      <Field label="Desde" htmlFor="desde" className="w-40">
        <Input id="desde" type="date" value={from} max={to} onChange={(e) => apply(e.target.value, to)} />
      </Field>
      <Field label="Hasta" htmlFor="hasta" className="w-40">
        <Input id="hasta" type="date" value={to} min={from} onChange={(e) => apply(from, e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-1.5 pb-0.5">
        {PRESETS.map((preset) => {
          const presetFrom = preset.from();
          const isActive = from === presetFrom && to === today;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => apply(presetFrom, today)}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                isActive
                  ? "border-brand bg-brand-light text-brand-dark"
                  : "border-line bg-white text-muted hover:text-ink",
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
