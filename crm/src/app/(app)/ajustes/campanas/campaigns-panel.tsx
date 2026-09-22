"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { CURRENCIES } from "@/db/enums";
import { saveCampaign } from "@/server/actions/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Checkbox, Field, FieldGrid, Input, Select, Textarea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useSubmit } from "@/lib/use-submit";
import { formatMoney, toNumber } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import type { Campaign } from "@/db/schema";

type Row = Campaign & { sourceName: string | null; leads: number };

export function CampaignsPanel({
  rows,
  sources,
}: {
  rows: Row[];
  sources: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);

  const form = useSubmit({
    action: (fd) => saveCampaign(editing?.id ?? null, fd),
    success: editing ? "Campaña actualizada" : "Campaña creada",
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
          Nueva campaña
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-muted sm:px-5">
          Todavía no hay campañas. Crea una para poder medir de dónde vienen los leads.
        </p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {rows.map((campaign) => (
            <li key={campaign.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="break-anywhere text-[14px] font-medium text-ink">{campaign.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {campaign.sourceName ? (
                    <Badge tone="azul" size="sm">
                      {campaign.sourceName}
                    </Badge>
                  ) : null}
                  {!campaign.active ? (
                    <Badge tone="gris" size="sm">
                      Cerrada
                    </Badge>
                  ) : null}
                  <span className="tnum text-[12px] text-muted">{campaign.leads} leads</span>
                  {campaign.startsOn ? (
                    <span className="text-[12px] text-muted">
                      desde {formatDate(campaign.startsOn)}
                      {campaign.endsOn ? ` hasta ${formatDate(campaign.endsOn)}` : ""}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {campaign.budget ? (
                  <span className="tnum whitespace-nowrap text-[13px] text-muted">
                    {formatMoney(campaign.budget, campaign.currency)}
                  </span>
                ) : null}
                <Button
                  variant="quiet"
                  size="icon"
                  onClick={() => {
                    setCreating(false);
                    setEditing(campaign);
                  }}
                  aria-label={`Editar ${campaign.name}`}
                >
                  <Pencil aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Drawer
        open={creating || editing !== null}
        onOpenChange={(v) => {
          if (!v) {
            setEditing(null);
            setCreating(false);
          }
        }}
        title={editing ? "Editar campaña" : "Nueva campaña"}
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
            <Button type="submit" form="campana-form" loading={form.pending}>
              Guardar
            </Button>
          </>
        }
      >
        <form id="campana-form" onSubmit={form.submit} className="space-y-4" key={editing?.id ?? "nueva"}>
          <FormError message={form.error} />
          <Field label="Nombre" htmlFor="name" required>
            <Input
              id="name"
              name="name"
              defaultValue={editing?.name}
              required
              autoFocus
              placeholder="Meta Ads Bootcamp Septiembre"
            />
          </Field>
          <FieldGrid>
            <Field label="Fuente" htmlFor="sourceId">
              <Select id="sourceId" name="sourceId" defaultValue={editing?.sourceId ?? ""}>
                <option value="">Sin definir</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Canal" htmlFor="channel">
              <Input id="channel" name="channel" defaultValue={editing?.channel ?? ""} placeholder="Meta" />
            </Field>
          </FieldGrid>
          <FieldGrid>
            <Field label="Empieza" htmlFor="startsOn">
              <Input id="startsOn" name="startsOn" type="date" defaultValue={editing?.startsOn ?? ""} />
            </Field>
            <Field label="Termina" htmlFor="endsOn">
              <Input id="endsOn" name="endsOn" type="date" defaultValue={editing?.endsOn ?? ""} />
            </Field>
          </FieldGrid>
          <FieldGrid>
            <Field label="Presupuesto" htmlFor="budget">
              <Input
                id="budget"
                name="budget"
                inputMode="numeric"
                defaultValue={editing?.budget ? String(toNumber(editing.budget)) : ""}
              />
            </Field>
            <Field label="Moneda" htmlFor="currency">
              <Select id="currency" name="currency" defaultValue={editing?.currency ?? "COP"}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldGrid>
          <Field label="Notas" htmlFor="notes">
            <Textarea id="notes" name="notes" rows={2} defaultValue={editing?.notes ?? ""} />
          </Field>
          <Checkbox label="Campaña activa" name="active" defaultChecked={editing?.active ?? true} />
        </form>
      </Drawer>
    </>
  );
}
