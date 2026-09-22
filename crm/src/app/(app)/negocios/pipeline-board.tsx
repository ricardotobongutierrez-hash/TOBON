"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Clock, GripVertical } from "lucide-react";
import { moveStage } from "@/server/actions/opportunities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { useRun } from "@/lib/use-submit";
import { formatMoneyShort, toNumber } from "@/lib/money";
import { daysBetween, isOverdue, relativeDay } from "@/lib/dates";
import { cn, truncate } from "@/lib/utils";
import type { OpportunityRow } from "@/server/queries/lists";
import type { PipelineStage } from "@/db/schema";

/**
 * Tablero del pipeline. Se arrastra con el mouse en escritorio y, en movil o con
 * teclado, cada tarjeta trae un selector "mover a": arrastrar con el dedo no
 * funciona bien y dejar la accion solo ahi seria dejar fuera al telefono.
 */
export function PipelineBoard({
  stages,
  rows,
  highValueCop,
}: {
  stages: PipelineStage[];
  rows: OpportunityRow[];
  highValueCop: number;
}) {
  const { run, pending } = useRun();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const visible = stages.filter((s) => s.active && s.kind !== "nutricion");
  const byStage = new Map<string, OpportunityRow[]>();
  for (const stage of stages) byStage.set(stage.slug, []);
  for (const row of rows) {
    if (!byStage.has(row.stage)) byStage.set(row.stage, []);
    byStage.get(row.stage)!.push(row);
  }

  async function move(id: string, slug: string) {
    await run(() => moveStage(id, slug));
  }

  return (
    <div className="scroll-thin relative -mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">
      <div className="flex min-w-max gap-3">
        {visible.map((stage) => {
          const cards = byStage.get(stage.slug) ?? [];
          const total = cards.reduce((acc, c) => acc + toNumber(c.amount), 0);
          return (
            <section
              key={stage.slug}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(stage.slug);
              }}
              onDragLeave={() => setOver((s) => (s === stage.slug ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData("text/plain") || dragging;
                if (id) void move(id, stage.slug);
                setDragging(null);
              }}
              className={cn(
                "flex w-[272px] shrink-0 flex-col rounded-lg border bg-canvas/70 transition-colors",
                over === stage.slug ? "border-brand bg-brand-light/50" : "border-line-soft",
              )}
              aria-label={`${stage.name}, ${cards.length} negocios`}
            >
              <header className="sticky top-0 rounded-t-lg border-b border-line-soft bg-canvas/95 px-3 py-2.5 backdrop-blur">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="clip-1 text-[13px] font-semibold text-ink">{stage.name}</h3>
                  <span className="tnum shrink-0 rounded-full bg-white px-1.5 text-[11px] font-medium text-muted">
                    {cards.length}
                  </span>
                </div>
                <p className="tnum mt-0.5 text-[12px] text-muted">
                  {total > 0 ? formatMoneyShort(total) : "Sin valor"}
                </p>
              </header>

              <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
                {cards.length === 0 ? (
                  <p className="px-1 py-4 text-center text-[12px] leading-snug text-muted-light">
                    Nada en esta etapa
                  </p>
                ) : (
                  cards.map((card) => {
                    const daysInStage = daysBetween(card.stageChangedAt);
                    const highValue = toNumber(card.amount) >= highValueCop;
                    const noNext = !card.nextAction;
                    return (
                      <article
                        key={card.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", card.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDragging(card.id);
                        }}
                        onDragEnd={() => setDragging(null)}
                        className={cn(
                          "group rounded-md border bg-white p-2.5 shadow-[var(--shadow-card)] transition-shadow",
                          dragging === card.id && "opacity-40",
                          noNext ? "border-warn/40" : "border-line-soft",
                          "hover:shadow-[var(--shadow-raised)]",
                        )}
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical
                            className="mt-0.5 hidden size-3.5 shrink-0 cursor-grab text-line group-hover:text-muted-light lg:block"
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <p className="clip-1 text-[12px] text-muted">
                              {card.companyName ?? card.contactName ?? "Sin cliente"}
                            </p>
                            <Link
                              href={`/negocios/${card.id}`}
                              className="mt-0.5 block text-[13px] font-medium leading-snug text-ink hover:text-brand"
                            >
                              {truncate(card.name, 62)}
                            </Link>
                          </div>
                        </div>

                        <p className="tnum mt-2 text-[15px] font-semibold text-ink">
                          {formatMoneyShort(card.amount, card.currency)}
                        </p>

                        {card.productName ? (
                          <p className="clip-1 mt-0.5 text-[12px] text-muted">{card.productName}</p>
                        ) : null}

                        <div className="mt-2 flex flex-wrap gap-1">
                          {noNext ? (
                            <Badge tone="ambar" size="sm">
                              <AlertTriangle className="size-3" aria-hidden />
                              Sin próxima acción
                            </Badge>
                          ) : (
                            <Badge tone={isOverdue(card.nextActionDate) ? "rojo" : "gris"} size="sm">
                              {relativeDay(card.nextActionDate)}
                            </Badge>
                          )}
                          {daysInStage >= 14 ? (
                            <Badge tone={daysInStage >= 30 ? "rojo" : "ambar"} size="sm">
                              <Clock className="size-3" aria-hidden />
                              {daysInStage} d
                            </Badge>
                          ) : null}
                          {highValue ? (
                            <Badge tone="acento" size="sm">
                              Alto valor
                            </Badge>
                          ) : null}
                        </div>

                        {card.nextAction ? (
                          <p className="clip-2 mt-1.5 text-[12px] leading-snug text-muted">{card.nextAction}</p>
                        ) : null}

                        {/* El responsable va en su propia linea: compitiendo con
                            el selector quedaba recortado a tres letras. */}
                        <div className="mt-2 border-t border-line-soft pt-2">
                          <p className="clip-1 text-[11px] text-muted">
                            {card.responsibleName ?? "Sin responsable"}
                          </p>
                          <label className="relative mt-1.5 block">
                            <span className="sr-only">Mover {card.name} a otra etapa</span>
                            <Select
                              value=""
                              disabled={pending}
                              onChange={(e) => e.target.value && void move(card.id, e.target.value)}
                              className="h-7 w-full border-line-soft bg-canvas px-2 pr-7 text-[11px]"
                            >
                              <option value="">Mover a…</option>
                              {stages
                                .filter((s) => s.slug !== card.stage && s.active)
                                .map((s) => (
                                  <option key={s.slug} value={s.slug}>
                                    {s.name}
                                  </option>
                                ))}
                            </Select>
                          </label>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}

        {/* Nutricion va al final: no es parte del avance, es el descanso. */}
        {stages
          .filter((s) => s.kind === "nutricion" && s.active)
          .map((stage) => {
            const cards = byStage.get(stage.slug) ?? [];
            return (
              <section
                key={stage.slug}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(stage.slug);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const id = e.dataTransfer.getData("text/plain") || dragging;
                  if (id) void move(id, stage.slug);
                }}
                className={cn(
                  "flex w-[240px] shrink-0 flex-col rounded-lg border border-dashed bg-canvas/50",
                  over === stage.slug ? "border-brand" : "border-line",
                )}
              >
                <header className="border-b border-line-soft px-3 py-2.5">
                  <h3 className="text-[13px] font-semibold text-muted">{stage.name}</h3>
                  <p className="text-[12px] text-muted-light">{cards.length} en espera</p>
                </header>
                <div className="flex flex-col gap-2 p-2">
                  {cards.map((card) => (
                    <Link
                      key={card.id}
                      href={`/negocios/${card.id}`}
                      className="rounded-md border border-line-soft bg-white p-2.5 hover:border-muted-light"
                    >
                      <p className="clip-1 text-[12px] text-muted">
                        {card.companyName ?? card.contactName ?? "Sin cliente"}
                      </p>
                      <p className="clip-2 text-[13px] font-medium text-ink">{card.name}</p>
                      <p className="tnum mt-1 text-[13px] text-muted">
                        {formatMoneyShort(card.amount, card.currency)}
                      </p>
                    </Link>
                  ))}
                  {cards.length === 0 ? (
                    <p className="px-1 py-3 text-center text-[12px] text-muted-light">Vacio</p>
                  ) : null}
                </div>
              </section>
            );
          })}
      </div>
    </div>
  );
}
