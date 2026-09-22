"use client";

import { Check } from "lucide-react";
import { moveStage } from "@/server/actions/opportunities";
import { useRun } from "@/lib/use-submit";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/db/schema";

/**
 * Avance de la venta en un solo trazo. Se hace clic en la etapa y el negocio se
 * mueve; no hay que buscar un selector escondido.
 */
export function StageStepper({
  opportunityId,
  stages,
  current,
}: {
  opportunityId: string;
  stages: PipelineStage[];
  current: string;
}) {
  const { run, pending } = useRun();
  const active = stages.filter((s) => s.kind === "activa" && s.active);
  const currentStage = stages.find((s) => s.slug === current);
  const currentIndex = active.findIndex((s) => s.slug === current);

  // Un negocio cerrado no se mueve por aqui: se reabre desde el menu de acciones.
  if (currentStage && currentStage.kind !== "activa") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-2 text-[14px] font-medium",
            currentStage.kind === "ganado" ? "bg-ok-soft text-ok" : "bg-off-soft text-muted",
          )}
        >
          {currentStage.kind === "ganado" ? <Check className="size-4" aria-hidden /> : null}
          {currentStage.name}
        </span>
        <p className="text-[13px] text-muted">
          Para reabrirlo, muevelo a una etapa activa desde el menu de acciones.
        </p>
      </div>
    );
  }

  return (
    <div className="scroll-thin relative -mx-1 overflow-x-auto px-1 pb-1">
      <ol className="flex min-w-max items-stretch gap-1">
        {active.map((stage, index) => {
          const done = index < currentIndex;
          const isCurrent = stage.slug === current;
          return (
            <li key={stage.slug}>
              <button
                type="button"
                disabled={pending || isCurrent}
                onClick={() => void run(() => moveStage(opportunityId, stage.slug), `Movido a ${stage.name}`)}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex h-full min-w-[104px] max-w-[150px] flex-col justify-between gap-1 rounded-md border px-2.5 py-2 text-left transition-colors disabled:cursor-default",
                  isCurrent
                    ? "border-brand bg-brand text-white"
                    : done
                      ? "border-ok/25 bg-ok-soft text-ok hover:border-ok/50"
                      : "border-line bg-white text-muted hover:border-brand hover:text-brand-dark",
                )}
              >
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider opacity-70">
                  {done ? <Check className="size-3" aria-hidden /> : null}
                  {index + 1}
                </span>
                <span className="text-[12px] font-medium leading-snug">{stage.name}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
