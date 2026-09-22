import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarClock,
  Clock,
  FileText,
  Mail,
  MessageCircle,
  Paperclip,
  Receipt,
  User,
  Wallet,
} from "lucide-react";
import type { Currency } from "@/db/enums";
import { requireUser } from "@/lib/auth";
import { opportunityDetail } from "@/server/queries/detail";
import { timelineFor } from "@/server/queries/timeline";
import { loadPickers, loadRefs } from "@/server/queries/refs";
import { balanceOf } from "@/lib/automation";
import { formatMoney, toNumber } from "@/lib/money";
import { daysBetween, formatDate, formatDateTime, isOverdue, relativeDay } from "@/lib/dates";
import { whatsappLink } from "@/lib/normalize";
import { billingChip, deliveryChip, paymentChip, proposalAgeChip, proposalChip } from "@/lib/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Timeline } from "@/components/timeline";
import { Lifecycles } from "@/components/lifecycles";
import { RecordActions } from "@/components/record-actions";
import { AttachmentsList } from "@/components/attachments-list";
import { AuditTrail } from "@/components/audit-trail";
import { CompleteTaskButton } from "@/components/quick/complete-task";
import { DealHeaderActions } from "./header-actions";
import { StageStepper } from "./stage-stepper";
import { ProposalRow } from "./proposal-row";
import { PaymentRow } from "./payment-row";
import { DeliveryRow } from "./delivery-row";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const opp = await opportunityDetail(id);
  return { title: opp?.name ?? "Negocio" };
}

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const opp = await opportunityDetail(id);
  if (!opp) notFound();

  const [timeline, refs, pickers] = await Promise.all([
    timelineFor({ opportunityId: id }),
    loadRefs(),
    loadPickers(),
  ]);

  const stage = opp.stages.find((s) => s.slug === opp.stage);
  const balance = balanceOf({
    amount: opp.amount,
    taxRate: opp.taxRate,
    invoices: opp.invoices,
    payments: opp.payments,
  });
  const silentDays = daysBetween(opp.lastInteractionAt ?? opp.createdAt);
  const client = opp.companyName ?? opp.contactName ?? "Sin cliente";
  const invoiceOptions = opp.invoices.map((i) => ({
    id: i.id,
    number: i.number,
    amount: i.amount,
    currency: i.currency,
  }));
  const wa = whatsappLink(opp.contactPhone);

  return (
    <div className="mx-auto max-w-[1400px]">
      <Link
        href="/negocios"
        className="no-print mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-brand"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Negocios
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
            {opp.companyId ? (
              <Link href={`/empresas/${opp.companyId}`} className="inline-flex items-center gap-1.5 font-medium text-brand hover:text-brand-dark">
                <Building2 className="size-3.5" aria-hidden />
                {opp.companyName}
              </Link>
            ) : null}
            {opp.contactId ? (
              <Link href={`/contactos/${opp.contactId}`} className="inline-flex items-center gap-1.5 font-medium text-brand hover:text-brand-dark">
                <User className="size-3.5" aria-hidden />
                {opp.contactName}
              </Link>
            ) : null}
            {opp.contactPosition ? (
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="size-3.5" aria-hidden />
                {opp.contactPosition}
              </span>
            ) : null}
          </p>
          <h1 className="break-anywhere text-[24px] font-semibold leading-tight text-ink sm:text-[28px]">
            {opp.name}
          </h1>
          <p className="tnum mt-1.5 text-[22px] font-semibold text-ink">
            {formatMoney(opp.amount, opp.currency as Currency)}
            {opp.requiresInvoice ? (
              <span className="ml-2 text-[13px] font-normal text-muted">
                más IVA: {formatMoney(toNumber(opp.amount) * (1 + toNumber(opp.taxRate) / 100), opp.currency as Currency)}
              </span>
            ) : null}
          </p>
        </div>

        <DealHeaderActions opp={opp} refs={refs} pickers={pickers} />
      </div>

      {/* ───────── Los cinco ciclos de vida ───────── */}
      <Card className="mb-5">
        <CardHeader
          title="Estado del negocio"
          description="Cinco dimensiones separadas: cada una avanza a su ritmo."
        />
        <div className="px-4 py-4 sm:px-5">
          <Lifecycles
            stageName={stage?.name ?? opp.stage}
            stageKind={stage?.kind ?? "activa"}
            proposalStatus={opp.proposalStatus}
            billingStatus={opp.billingStatus}
            paymentStatus={opp.paymentStatus}
            deliveryStatus={opp.deliveryStatus}
          />
        </div>
      </Card>

      {/* ───────── Etapa de venta ───────── */}
      <Card className="mb-5">
        <CardHeader
          title="Etapa de venta"
          description={
            stage?.kind === "activa"
              ? `${daysBetween(opp.stageChangedAt)} dias en esta etapa · probabilidad ${opp.probability} %`
              : opp.lostReason
                ? `Cerrado como perdido: ${opp.lostReason}`
                : `Cerrado el ${formatDate(opp.closedAt)}`
          }
        />
        <div className="px-4 py-4 sm:px-5">
          <StageStepper opportunityId={opp.id} stages={opp.stages} current={opp.stage} />
        </div>
      </Card>

      <div className="mb-5 flex flex-wrap gap-2">
        {wa ? (
          <Button variant="outline" asChild>
            <a href={wa} target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden />
              WhatsApp
            </a>
          </Button>
        ) : null}
        {opp.contactEmail ? (
          <Button variant="outline" asChild>
            <a href={`mailto:${opp.contactEmail}`}>
              <Mail aria-hidden />
              Correo
            </a>
          </Button>
        ) : null}
        <RecordActions
          refs={refs}
          pickers={pickers}
          scope={{ opportunityId: opp.id, contactId: opp.contactId, companyId: opp.companyId }}
          show={["interaccion", "seguimiento", "propuesta", "factura", "pago"]}
          defaults={{
            amount: opp.amount,
            currency: opp.currency,
            title: opp.name,
            requiresInvoice: opp.requiresInvoice,
            invoices: invoiceOptions,
          }}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {/* Proxima accion: la regla critica */}
          <Card className={opp.openTasks.length === 0 && stage?.kind === "activa" ? "border-warn/40" : undefined}>
            <CardHeader title="Próxima acción" />
            {opp.openTasks.length === 0 ? (
              stage?.kind === "activa" ? (
                <Empty
                  icon={CalendarClock}
                  title="Este negocio activo no tiene próxima acción"
                  message="Sin siguiente paso agendado el negocio deja de avanzar. Agenda una llamada, un correo o una reunión."
                />
              ) : (
                <Empty
                  icon={CalendarClock}
                  tone="bueno"
                  title="Sin pendientes"
                  message="El negocio está cerrado, no hace falta agendar nada."
                />
              )
            ) : (
              <ul className="divide-y divide-line-soft">
                {opp.openTasks.map((task) => (
                  <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="break-anywhere text-[14px] font-medium text-ink">{task.title}</p>
                      <p className="text-[12px] text-muted">
                        <span className={isOverdue(task.dueAt) ? "font-medium text-danger" : undefined}>
                          {formatDateTime(task.dueAt)} · {relativeDay(task.dueAt)}
                        </span>
                        {task.responsibleName ? ` · ${task.responsibleName}` : ""}
                      </p>
                      {task.notes ? (
                        <p className="mt-1 break-anywhere text-[12px] text-muted">{task.notes}</p>
                      ) : null}
                    </div>
                    <CompleteTaskButton
                      taskId={task.id}
                      taskTitle={task.title}
                      clientName={client}
                      variant="outline"
                      label="Marcar como realizado"
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Propuestas */}
          <Card className="overflow-hidden">
            <CardHeader
              title="Propuestas"
              description={opp.proposals.length > 0 ? `${opp.proposals.length} registradas` : undefined}
            />
            {opp.proposals.length === 0 ? (
              <Empty
                icon={FileText}
                title="Sin propuestas todavía"
                message="Registra la propuesta cuando este lista, y sube el PDF para tenerlo a mano."
              />
            ) : (
              <ul className="divide-y divide-line-soft">
                {opp.proposals.map((proposal) => (
                  <ProposalRow key={proposal.id} proposal={proposal} />
                ))}
              </ul>
            )}
          </Card>

          {/* Facturas y pagos */}
          <Card className="overflow-hidden">
            <CardHeader
              title="Facturación y cobro"
              description="El saldo se calcula, no se escribe a mano."
            />
            <div className="border-b border-line-soft bg-canvas px-4 py-3.5 sm:px-5">
              <dl className="grid grid-cols-3 gap-3">
                <div>
                  <dt className="eyebrow">Valor total</dt>
                  <dd className="tnum mt-1 break-anywhere text-[15px] font-semibold text-ink">
                    {formatMoney(balance.total, opp.currency as Currency)}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">Pagado</dt>
                  <dd className="tnum mt-1 break-anywhere text-[15px] font-semibold text-ok">
                    {formatMoney(balance.paid, opp.currency as Currency)}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">Saldo</dt>
                  <dd
                    className={`tnum mt-1 break-anywhere text-[15px] font-semibold ${
                      balance.outstanding > 0 ? "text-danger" : "text-ok"
                    }`}
                  >
                    {formatMoney(balance.outstanding, opp.currency as Currency)}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone={billingChip(opp.billingStatus).tone} dot>
                  {billingChip(opp.billingStatus).label}
                </Badge>
                <Badge tone={paymentChip(opp.paymentStatus).tone} dot>
                  {paymentChip(opp.paymentStatus).label}
                </Badge>
              </div>
            </div>

            {opp.invoices.length === 0 && opp.payments.length === 0 ? (
              <Empty
                icon={Receipt}
                title="Sin facturas ni pagos"
                message={
                  opp.requiresInvoice
                    ? "Este cliente pidió factura electrónica. Registrala cuando se emita."
                    : "Este cliente no requiere factura. Puedes registrar el pago directamente."
                }
              />
            ) : (
              <ul className="divide-y divide-line-soft">
                {opp.invoices.map((invoice) => (
                  <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="inline-flex items-center gap-1.5 text-[14px] font-medium text-ink">
                        <Receipt className="size-3.5 text-muted" aria-hidden />
                        Factura {invoice.number}
                      </p>
                      <p className="text-[12px] text-muted">
                        {invoice.issueDate ? `Emitida ${formatDate(invoice.issueDate)}` : "Sin emitir"}
                        {invoice.dueDate ? ` · vence ${formatDate(invoice.dueDate)}` : ""}
                        {toNumber(invoice.taxRate) > 0 ? ` · IVA ${toNumber(invoice.taxRate)} %` : " · sin IVA"}
                      </p>
                      {invoice.accountingNotes ? (
                        <p className="mt-1 break-anywhere text-[12px] text-muted">{invoice.accountingNotes}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={billingChip(invoice.status).tone} size="sm" dot>
                        {billingChip(invoice.status).label}
                      </Badge>
                      <span className="tnum text-[14px] font-semibold text-ink">
                        {formatMoney(
                          toNumber(invoice.amount) * (1 + toNumber(invoice.taxRate) / 100),
                          invoice.currency,
                        )}
                      </span>
                      {invoice.attachmentId ? (
                        <Button variant="quiet" size="icon" asChild>
                          <a href={`/api/archivos/${invoice.attachmentId}`} target="_blank" rel="noreferrer" title="Ver la factura">
                            <Paperclip aria-hidden />
                            <span className="sr-only">Ver el archivo</span>
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
                {opp.payments.map((payment) => (
                  <PaymentRow key={payment.id} payment={payment} />
                ))}
              </ul>
            )}
          </Card>

          {/* Entrega */}
          <Card className="overflow-hidden">
            <CardHeader
              title="Entrega del servicio"
              description="Después del pago, lo que falta es prestar el servicio."
            />
            {opp.deliveries.length === 0 ? (
              <Empty
                icon={CalendarClock}
                title="Sin servicios programados"
                message="Cuando el pago quede completo se crea el registro para coordinar la fecha."
              />
            ) : (
              <ul className="divide-y divide-line-soft">
                {opp.deliveries.map((delivery) => (
                  <DeliveryRow key={delivery.id} delivery={delivery} />
                ))}
              </ul>
            )}
          </Card>

          {/* Timeline */}
          <Card className="overflow-hidden">
            <CardHeader title="Actividad" description="Todo lo que ha pasado en este negocio." />
            <Timeline entries={timeline} />
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Documentos" />
            <AttachmentsList entityType="negocio" entityId={opp.id} files={opp.attachments} />
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Historial de cambios" />
            <AuditTrail entityType="negocio" entityId={opp.id} />
          </Card>
        </div>

        {/* Lateral */}
        <div className="min-w-0 space-y-5">
          {silentDays >= 3 && stage?.kind === "activa" ? (
            <div
              className={`rounded-lg border px-4 py-3.5 ${
                silentDays >= 14 ? "border-danger/30 bg-danger-soft" : "border-warn/30 bg-warn-soft"
              }`}
            >
              <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
                <Clock className="size-4 shrink-0" aria-hidden />
                {silentDays} dias sin contacto
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink/80">
                Registra una llamada o un correo para que el negocio no se enfrie.
              </p>
            </div>
          ) : null}

          <Card>
            <CardHeader title="Datos del negocio" />
            <dl className="divide-y divide-line-soft">
              {[
                { label: "Producto o servicio", value: opp.productName },
                { label: "Tipo", value: opp.segment === "b2b" ? "Empresa (B2B)" : "Persona (B2C)" },
                { label: "Moneda", value: opp.currency },
                { label: "Requiere factura electrónica", value: opp.requiresInvoice ? "Si" : "No" },
                { label: "Probabilidad", value: `${opp.probability} %` },
                { label: "Cierre estimado", value: formatDate(opp.expectedCloseOn) },
                { label: "Responsable", value: opp.responsibleName },
                { label: "De dónde salió", value: opp.sourceName },
                { label: "Campaña", value: opp.campaignName },
                { label: "Última interacción", value: formatDate(opp.lastInteractionAt) },
                { label: "Creado", value: formatDate(opp.createdAt) },
                ...(opp.closedAt ? [{ label: "Cerrado", value: formatDate(opp.closedAt) }] : []),
                ...(opp.lostReason ? [{ label: "Motivo de pérdida", value: opp.lostReason }] : []),
              ].map((item) => (
                <div key={item.label} className="flex flex-wrap items-baseline justify-between gap-x-3 px-4 py-2.5 sm:px-5">
                  <dt className="text-[12px] text-muted">{item.label}</dt>
                  <dd className="break-anywhere max-w-full text-right text-[13px] font-medium text-ink">
                    {item.value ?? <span className="font-normal text-muted-light">Sin registrar</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          {opp.notes ? (
            <Card>
              <CardHeader title="Notas" />
              <div className="px-4 py-3.5 sm:px-5">
                <p className="whitespace-pre-line break-anywhere text-[13px] leading-relaxed text-ink">{opp.notes}</p>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
