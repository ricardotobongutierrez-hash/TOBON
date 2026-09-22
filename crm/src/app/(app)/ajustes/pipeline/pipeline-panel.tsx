"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteStage, saveStage } from "@/server/actions/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { Drawer } from "@/components/ui/drawer";
import { Checkbox, Field, FieldGrid, Input, Select } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useRun, useSubmit } from "@/lib/use-submit";
import type { PipelineStage } from "@/db/schema";

const KIND_LABEL: Record<string, string> = {
  activa: "Etapa activa",
  ganado: "Cierre ganado",
  perdido: "Cierre perdido",
  nutricion: "Nutrición",
};

export function PipelinePanel({
  stages,
  counts,
}: {
  stages: PipelineStage[];
  counts: Record<string, number>;
}) {
  const [editing, setEditing] = useState<PipelineStage | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<PipelineStage | null>(null);
  const { run } = useRun();

  const form = useSubmit({
    action: (fd) => saveStage(editing?.id ?? null, fd),
    success: editing ? "Etapa actualizada" : "Etapa creada",
    onDone: () => {
      setEditing(null);
      setCreating(false);
    },
  });

  return (
    <>
      <div className="flex justify-end border-b border-line-soft px-4 py-3 sm:px-5">
        <Button
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
        >
          <Plus aria-hidden />
          Nueva etapa
        </Button>
      </div>

      <ul className="divide-y divide-line-soft">
        {stages.map((stage, index) => (
          <li key={stage.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="tnum flex size-7 shrink-0 items-center justify-center rounded-md bg-off-soft text-[12px] font-semibold text-muted">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="clip-1 text-[14px] font-medium text-ink">{stage.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge
                    tone={
                      stage.kind === "ganado"
                        ? "verde"
                        : stage.kind === "perdido"
                          ? "gris"
                          : stage.kind === "nutricion"
                            ? "gris"
                            : "azul"
                    }
                    size="sm"
                  >
                    {KIND_LABEL[stage.kind]}
                  </Badge>
                  <Badge tone="gris" size="sm">
                    {stage.probability} % de probabilidad
                  </Badge>
                  {!stage.active ? (
                    <Badge tone="gris" size="sm">
                      Oculta
                    </Badge>
                  ) : null}
                  <span className="tnum text-[12px] text-muted">
                    {counts[stage.slug] ?? 0} negocios
                  </span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="quiet"
                size="icon"
                onClick={() => {
                  setCreating(false);
                  setEditing(stage);
                }}
                aria-label={`Editar ${stage.name}`}
              >
                <Pencil aria-hidden />
              </Button>
              <Button
                variant="quiet"
                size="icon"
                onClick={() => setRemoving(stage)}
                aria-label={`Eliminar ${stage.name}`}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Drawer
        open={creating || editing !== null}
        onOpenChange={(v) => {
          if (!v) {
            setEditing(null);
            setCreating(false);
          }
        }}
        title={editing ? "Editar etapa" : "Nueva etapa"}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" form="etapa-form" loading={form.pending}>
              Guardar
            </Button>
          </>
        }
      >
        <form id="etapa-form" onSubmit={form.submit} className="space-y-4" key={editing?.id ?? "nueva"}>
          <FormError message={form.error} />
          <Field label="Nombre" htmlFor="name" required>
            <Input id="name" name="name" defaultValue={editing?.name} required autoFocus />
          </Field>
          <FieldGrid>
            <Field label="Tipo" htmlFor="kind" hint="Solo las activas cuentan en el pipeline.">
              <Select id="kind" name="kind" defaultValue={editing?.kind ?? "activa"}>
                {Object.entries(KIND_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Probabilidad" htmlFor="probability" hint="De 0 a 100. Alimenta el pipeline ponderado.">
              <Input
                id="probability"
                name="probability"
                type="number"
                min={0}
                max={100}
                defaultValue={editing?.probability ?? 10}
              />
            </Field>
          </FieldGrid>
          <Field label="Posición" htmlFor="sort" hint="Menor número, más a la izquierda en el tablero.">
            <Input id="sort" name="sort" type="number" defaultValue={editing?.sort ?? 100} />
          </Field>
          <Checkbox
            label="Mostrar en el tablero"
            name="active"
            defaultChecked={editing?.active ?? true}
          />
        </form>
      </Drawer>

      <Confirm
        open={removing !== null}
        onOpenChange={(v) => !v && setRemoving(null)}
        title="Eliminar esta etapa"
        description={`Se elimina "${removing?.name ?? ""}". Si hay negocios en ella, primero hay que moverlos.`}
        confirmLabel="Eliminar"
        onConfirm={async () => {
          if (removing) await run(() => deleteStage(removing.id), "Etapa eliminada");
        }}
      />
    </>
  );
}
