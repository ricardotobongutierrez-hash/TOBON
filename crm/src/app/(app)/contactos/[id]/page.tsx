import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  Handshake,
  Mail,
  MapPin,
  MessageCircle,
  Tag,
} from "lucide-react";
import { CONTACT_STATUS_LABEL, SEGMENT_LABEL, type ContactStatus, type Segment } from "@/db/enums";
import { requireUser } from "@/lib/auth";
import { contactDetail } from "@/server/queries/detail";
import { timelineFor } from "@/server/queries/timeline";
import { loadPickers, loadRefs } from "@/server/queries/refs";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime, isOverdue, relativeDay } from "@/lib/dates";
import { formatPhone, whatsappLink } from "@/lib/normalize";
import { contactChip, stageChip } from "@/lib/status";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { LeadScore } from "@/components/ui/lead-score";
import { Timeline } from "@/components/timeline";
import { Lifecycles } from "@/components/lifecycles";
import { RecordActions } from "@/components/record-actions";
import { AttachmentsList } from "@/components/attachments-list";
import { AuditTrail } from "@/components/audit-trail";
import { CompleteTaskButton } from "@/components/quick/complete-task";
import { ContactHeaderActions } from "./header-actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const contact = await contactDetail(id);
  return { title: contact?.fullName ?? "Contacto" };
}

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const contact = await contactDetail(id);
  if (!contact) notFound();

  const [timeline, refs, pickers] = await Promise.all([
    timelineFor({ contactId: id }),
    loadRefs(),
    loadPickers(),
  ]);

  const chip = contactChip(contact.status as ContactStatus);
  const wa = whatsappLink(contact.phone);
  const nextTask = contact.openTasks[0];
  const openOpp = contact.opportunities.find((o) => !o.closedAt) ?? contact.opportunities[0];
  const stage = openOpp ? contact.stages.find((s) => s.slug === openOpp.stage) : undefined;

  return (
    <div className="mx-auto max-w-[1400px]">
      <Link
        href="/contactos"
        className="no-print mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-brand"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Contactos
      </Link>

      {/* ───────── Identidad ───────── */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar name={contact.fullName} size="lg" />
          <div className="min-w-0">
            <h1 className="break-anywhere text-[24px] font-semibold leading-tight text-ink sm:text-[28px]">
              {contact.fullName}
            </h1>
            <p className="mt-0.5 text-[14px] text-muted">
              {contact.position ? (
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="size-3.5" aria-hidden />
                  {contact.position}
                </span>
              ) : null}
              {contact.position && contact.companyName ? <span className="px-2">·</span> : null}
              {contact.companyId ? (
                <Link href={`/empresas/${contact.companyId}`} className="inline-flex items-center gap-1.5 font-medium text-brand hover:text-brand-dark">
                  <Building2 className="size-3.5" aria-hidden />
                  {contact.companyName}
                </Link>
              ) : (
                <span>{SEGMENT_LABEL[contact.segment as Segment]}</span>
              )}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={chip.tone} dot>
                {chip.label}
              </Badge>
              <LeadScore
                score={contact.leadScore}
                factors={contact.leadScoreBreakdown}
                manual={contact.leadScoreManual}
              />
              {contact.tags.map((tag) => (
                <Badge key={tag} tone="acento" size="sm">
                  <Tag className="size-3" aria-hidden />
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <ContactHeaderActions contact={contact} refs={refs} pickers={pickers} />
      </div>

      {/* ───────── Contacto directo ───────── */}
      <div className="mb-5 flex flex-wrap gap-2">
        {wa ? (
          <Button variant="outline" asChild>
            <a href={wa} target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden />
              WhatsApp
            </a>
          </Button>
        ) : null}
        {contact.email ? (
          <Button variant="outline" asChild>
            <a href={`mailto:${contact.email}`}>
              <Mail aria-hidden />
              Enviar correo
            </a>
          </Button>
        ) : null}
        <RecordActions
          refs={refs}
          pickers={pickers}
          scope={{ contactId: contact.id, companyId: contact.companyId }}
          show={["interaccion", "seguimiento"]}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ───────── Columna principal ───────── */}
        <div className="min-w-0 space-y-5">
          {/* Estado comercial de su negocio principal */}
          {openOpp ? (
            <Card>
              <CardHeader
                title="Estado comercial"
                description={openOpp.name}
                action={
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/negocios/${openOpp.id}`}>Abrir el negocio</Link>
                  </Button>
                }
              />
              <div className="px-4 py-4 sm:px-5">
                <Lifecycles
                  stageName={stage?.name ?? openOpp.stage}
                  stageKind={stage?.kind ?? "activa"}
                  proposalStatus={openOpp.proposalStatus}
                  billingStatus={openOpp.billingStatus}
                  paymentStatus={openOpp.paymentStatus}
                  deliveryStatus={openOpp.deliveryStatus}
                />
                <p className="tnum mt-4 border-t border-line-soft pt-3 text-[18px] font-semibold text-ink">
                  {formatMoney(openOpp.amount, openOpp.currency)}
                </p>
              </div>
            </Card>
          ) : null}

          {/* Proxima accion */}
          <Card>
            <CardHeader
              title="Próxima acción"
              description={
                contact.openTasks.length > 1
                  ? `Hay ${contact.openTasks.length} pendientes abiertos con este contacto.`
                  : undefined
              }
            />
            {nextTask ? (
              <ul className="divide-y divide-line-soft">
                {contact.openTasks.map((task) => (
                  <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="break-anywhere text-[14px] font-medium text-ink">{task.title}</p>
                      <p className="text-[12px] text-muted">
                        <span className={isOverdue(task.dueAt) ? "font-medium text-danger" : undefined}>
                          {formatDateTime(task.dueAt)} · {relativeDay(task.dueAt)}
                        </span>
                        {task.responsibleName ? ` · ${task.responsibleName}` : ""}
                      </p>
                    </div>
                    <CompleteTaskButton
                      taskId={task.id}
                      taskTitle={task.title}
                      clientName={contact.fullName}
                      variant="outline"
                      label="Marcar como realizado"
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty
                icon={Calendar}
                title="No hay nada agendado con este contacto"
                message="Sin siguiente paso la conversación se enfria. Agenda una llamada o un correo."
              />
            )}
          </Card>

          {/* Timeline */}
          <Card className="overflow-hidden">
            <CardHeader
              title="Actividad"
              description="Todo lo que ha pasado con este contacto, en orden."
            />
            <Timeline entries={timeline} />
          </Card>

          {/* Documentos */}
          <Card className="overflow-hidden">
            <CardHeader title="Documentos" />
            <AttachmentsList entityType="contacto" entityId={contact.id} files={contact.attachments} />
          </Card>

          {/* Historial de cambios */}
          <Card className="overflow-hidden">
            <CardHeader title="Historial de cambios" description="Quien cambio que y cuando." />
            <AuditTrail entityType="contacto" entityId={contact.id} />
          </Card>
        </div>

        {/* ───────── Columna lateral ───────── */}
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Datos" />
            <dl className="divide-y divide-line-soft">
              {[
                { label: "WhatsApp o celular", value: contact.phone ? formatPhone(contact.phone) : null },
                { label: "Correo", value: contact.email },
                { label: "Tipo", value: SEGMENT_LABEL[contact.segment as Segment] },
                { label: "Responsable", value: contact.responsibleName },
                { label: "Interesado en", value: contact.productName },
                { label: "De dónde salió", value: contact.sourceName },
                { label: "Campaña", value: contact.campaignName },
                {
                  label: "Ubicación",
                  value: [contact.city, contact.country].filter(Boolean).join(", ") || null,
                  icon: MapPin,
                },
                { label: "Última interacción", value: formatDate(contact.lastInteractionAt) },
                { label: "Creado", value: formatDate(contact.createdAt) },
              ].map((item) => (
                <div key={item.label} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5 sm:px-5">
                  <dt className="text-[12px] text-muted">{item.label}</dt>
                  <dd className="break-anywhere max-w-full text-right text-[13px] font-medium text-ink">
                    {item.value ?? <span className="font-normal text-muted-light">Sin registrar</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Negocios"
              description={contact.opportunities.length === 0 ? undefined : undefined}
            />
            {contact.opportunities.length === 0 ? (
              <Empty
                icon={Handshake}
                title="Sin negocios todavía"
                message="Crea un negocio para empezar a gestionar esta oportunidad en el pipeline."
              />
            ) : (
              <ul className="divide-y divide-line-soft">
                {contact.opportunities.map((opp) => {
                  const oppStage = contact.stages.find((s) => s.slug === opp.stage);
                  const oppChip = stageChip(oppStage?.name ?? opp.stage, oppStage?.kind ?? "activa");
                  return (
                    <li key={opp.id} className="px-4 py-3 sm:px-5">
                      <Link href={`/negocios/${opp.id}`} className="break-anywhere text-[14px] font-medium text-ink hover:text-brand">
                        {opp.name}
                      </Link>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Badge tone={oppChip.tone} size="sm" dot>
                          {oppChip.label}
                        </Badge>
                        <span className="tnum text-[13px] font-medium text-ink">
                          {formatMoney(opp.amount, opp.currency)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {contact.notes ? (
            <Card>
              <CardHeader title="Notas" />
              <div className="px-4 py-3.5 sm:px-5">
                <p className="whitespace-pre-line break-anywhere text-[13px] leading-relaxed text-ink">
                  {contact.notes}
                </p>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
