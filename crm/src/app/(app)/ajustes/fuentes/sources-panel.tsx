"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { saveSource } from "@/server/actions/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/drawer";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useSubmit } from "@/lib/use-submit";
import type { LeadSource } from "@/db/schema";

export function SourcesPanel({ rows, counts }: { rows: LeadSource[]; counts: Record<string, number> }) {
  const [editing, setEditing] = useState<LeadSource | null>(null);
  const [creating, setCreating] = useState(false);

  const form = useSubmit({
    action: (fd) => saveSource(editing?.id ?? null, fd),
    success: editing ? "Fuente actualizada" : "Fuente creada",
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
          Nueva fuente
        </Button>
      </div>

      <ul className="divide-y divide-line-soft">
        {rows.map((source) => (
          <li key={source.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="clip-1 text-[14px] font-medium text-ink">{source.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="tnum text-[12px] text-muted">{counts[source.id] ?? 0} contactos</span>
                {!source.active ? (
                  <Badge tone="gris" size="sm">
                    Inactiva
                  </Badge>
                ) : null}
              </div>
            </div>
            <Button
              variant="quiet"
              size="icon"
              onClick={() => {
                setCreating(false);
                setEditing(source);
              }}
              aria-label={`Editar ${source.name}`}
            >
              <Pencil aria-hidden />
            </Button>
          </li>
        ))}
      </ul>

      <Modal
        open={creating || editing !== null}
        onOpenChange={(v) => {
          if (!v) {
            setEditing(null);
            setCreating(false);
          }
        }}
        title={editing ? "Editar fuente" : "Nueva fuente"}
        size="sm"
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
            <Button type="submit" form="fuente-form" loading={form.pending}>
              Guardar
            </Button>
          </>
        }
      >
        <form id="fuente-form" onSubmit={form.submit} className="space-y-4" key={editing?.id ?? "nueva"}>
          <FormError message={form.error} />
          <Field label="Nombre" htmlFor="name" required>
            <Input id="name" name="name" defaultValue={editing?.name} required autoFocus placeholder="Meta Ads" />
          </Field>
          <Checkbox
            label="Disponible al crear contactos"
            name="active"
            defaultChecked={editing?.active ?? true}
          />
        </form>
      </Modal>
    </>
  );
}
