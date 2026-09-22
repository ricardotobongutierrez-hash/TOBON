"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Info } from "lucide-react";
import { scoreBand } from "@/lib/scoring";
import { cn } from "@/lib/utils";

/**
 * El puntaje se puede abrir y muestra de donde sale cada punto. No hay un numero
 * de IA sin explicacion: si el usuario no entiende por que, no lo va a usar.
 */
export function LeadScore({
  score,
  factors,
  manual,
  size = "md",
}: {
  score: number;
  factors: { factor: string; label: string; points: number; detail: string }[];
  manual?: number | null;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const band = scoreBand(score);
  const tones = {
    verde: "border-ok/25 bg-ok-soft text-ok",
    azul: "border-brand/25 bg-brand-light text-brand-dark",
    ambar: "border-warn/25 bg-warn-soft text-warn",
    gris: "border-line bg-off-soft text-off",
  }[band.tone];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          "inline-flex items-center gap-1.5 rounded-sm border font-medium transition-shadow hover:shadow-[var(--shadow-card)]",
          tones,
          size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-[12px]",
        )}
        aria-label={`Puntaje ${score} de 100, ${band.label}. Ver por que.`}
      >
        <span className="tnum font-semibold">{score}</span>
        <span>{band.label}</span>
        <Info className="size-3 opacity-60" aria-hidden />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="anim-in z-50 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-line-soft bg-white p-4 shadow-[var(--shadow-float)]"
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[14px] font-semibold text-ink">Puntaje {score} de 100</p>
            <span className="text-[12px] text-muted">{band.label}</span>
          </div>
          {manual !== null && manual !== undefined ? (
            <p className="mt-1.5 rounded-sm border border-warn/25 bg-warn-soft px-2 py-1 text-[12px] text-warn">
              Este puntaje está fijado a mano. El calculo automático no lo modifica.
            </p>
          ) : null}

          {factors.length === 0 ? (
            <p className="mt-3 text-[13px] text-muted">
              Todavía no hay datos suficientes. El puntaje se calcula con el cargo, la capacidad de
              compra, el producto de interes y la conversación registrada.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {factors.map((factor) => (
                <li key={factor.factor} className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "tnum mt-0.5 w-9 shrink-0 rounded-sm px-1 py-0.5 text-center text-[11px] font-semibold",
                      factor.points > 0
                        ? "bg-ok-soft text-ok"
                        : factor.points < 0
                          ? "bg-danger-soft text-danger"
                          : "bg-off-soft text-muted",
                    )}
                  >
                    {factor.points > 0 ? "+" : ""}
                    {factor.points}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-ink">{factor.label}</span>
                    <span className="block text-[12px] leading-snug text-muted">{factor.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
