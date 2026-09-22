"use client";

import { useState } from "react";
import { ChevronDown, FileUp, Paperclip } from "lucide-react";
import { PROPOSAL_STATUSES, PROPOSAL_STATUS_LABEL, type ProposalStatus } from "@/db/enums";
import { addProposalVersion, setProposalStatus } from "@/server/actions/proposals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Field, FieldGrid, Input, Select, Textarea } from "@/components/ui/field";
import { FileInput } from "@/components/ui/file-input";
import { FormError } from "@/components/ui/form-error";
import { useRun, useSubmit } from "@/lib/use-submit";
import { proposalAgeChip, proposalChip } from "@/lib/status";
import { formatMoney, toNumber } from "@/lib/money";
import { daysBetween, formatDate } from "@/lib/dates";
import type { Proposal } from "@/db/schema";

export function ProposalRow({ proposal }: { proposal: Proposal }) {
  const { run, pending } = useRun();
  const [newVersion, setNewVersion] = useState(false);
  const chip = proposalChip(proposal.status);
  const age = proposal.sentAt && !proposal.respondedAt ? proposalAgeChip(daysBetween(proposal.sentAt)) : null;

  const { submit, pending: saving, error } = useSubmit({
    action: (fd) => addProposalVersion(proposal.id, fd),
    success: "Nueva versión registrada",
    onDone: () => setNewVersion(false),
  });

  return (
    <li className="px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-[14px] font-medium text-ink">
            <span className="tnum">{proposal.number}</span>
            {proposal.currentVersion > 1 ? (
              <span className="text-[12px] font-normal text-muted">version {proposal.currentVersion}</span>
            ) : null}
          </p>
          <p className="break-anywhere text-[13px] text-muted">{proposal.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={chip.tone} size="sm" dot>
              {chip.label}
            </Badge>
            {age ? (
              <Badge tone={age.tone} size="sm">
                {age.label}
              </Badge>
            ) : null}
            {proposal.expiresOn ? (
              <span className="text-[12px] text-muted">Vence {formatDate(proposal.expiresOn)}</span>
            ) : null}
          </div>
        </div>
        <span className="tnum shrink-0 text-[16px] font-semibold text-ink">
          {formatMoney(proposal.amount, proposal.currency)}
        </span>
      </div>

      <div className="no-print mt-3 flex flex-wrap items-center gap-2">
        {proposal.status !== "aceptada" && proposal.status !== "rechazada" ? (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => void run(() => setProposalStatus(proposal.id, "aceptada"), "Propuesta aceptada")}
            >
              Marcar aceptada
            </Button>
            <Button
              variant="quiet"
              size="sm"
              disabled={pending}
              onClick={() => void run(() => setProposalStatus(proposal.id, "rechazada"), "Propuesta rechazada")}
            >
              Rechazada
            </Button>
          </>
        ) : null}
        {proposal.status === "borrador" || proposal.status === "lista-para-enviar" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => void run(() => setProposalStatus(proposal.id, "enviada"), "Propuestá marcada como enviada")}
          >
            Marcar enviada
          </Button>
        ) : null}
        <Button variant="quiet" size="sm" onClick={() => setNewVersion(true)}>
          <FileUp aria-hidden />
          Nueva versión
        </Button>
        <label className="relative ml-auto">
          <span className="sr-only">Cambiar el estado de la propuesta {proposal.number}</span>
          <Select
            value=""
            disabled={pending}
            onChange={(e) =>
              e.target.value && void run(() => setProposalStatus(proposal.id, e.target.value as ProposalStatus), "Estado actualizado")
            }
            className="h-8 w-auto min-w-0 text-[12px]"
          >
            <option value="">Otro estado…</option>
            {PROPOSAL_STATUSES.filter((s) => s !== "sin-propuesta" && s !== proposal.status).map((s) => (
              <option key={s} value={s}>
                {PROPOSAL_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <Drawer
        open={newVersion}
        onOpenChange={setNewVersion}
        title={`Version ${proposal.currentVersion + 1} de ${proposal.number}`}
        description="La versión anterior queda guardada en el historial."
        footer={
          <>
            <Button variant="outline" onClick={() => setNewVersion(false)}>
              Cancelar
            </Button>
            <Button type="submit" form={`version-${proposal.id}`} loading={saving}>
              Guardar versión
            </Button>
          </>
        }
      >
        <form id={`version-${proposal.id}`} onSubmit={submit} className="space-y-4">
          <FormError message={error} />
          <FieldGrid>
            <Field label="Nuevo valor" htmlFor={`amount-${proposal.id}`} required>
              <Input
                id={`amount-${proposal.id}`}
                name="amount"
                required
                inputMode="numeric"
                defaultValue={String(toNumber(proposal.amount))}
              />
            </Field>
            <Field label="Estado" htmlFor={`status-${proposal.id}`}>
              <Select id={`status-${proposal.id}`} name="status" defaultValue="enviada">
                <option value="borrador">Borrador</option>
                <option value="lista-para-enviar">Lista para enviar</option>
                <option value="enviada">Enviada</option>
              </Select>
            </Field>
          </FieldGrid>
          <Field label="Vence el" htmlFor={`expires-${proposal.id}`}>
            <Input id={`expires-${proposal.id}`} name="expiresOn" type="date" defaultValue={proposal.expiresOn ?? ""} />
          </Field>
          <FileInput label="Documento de esta versión" name="file" />
          <Field label="Qué cambió" htmlFor={`notes-${proposal.id}`}>
            <Textarea
              id={`notes-${proposal.id}`}
              name="notes"
              rows={3}
              placeholder="El cliente pidió quitar la sesión de cierre y ajustar el valor."
            />
          </Field>
        </form>
      </Drawer>
    </li>
  );
}
