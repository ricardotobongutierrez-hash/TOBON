import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  ExternalLink,
  FileText,
  Handshake,
  Receipt,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { PURCHASING_CAPACITY_LABEL, type Currency, type PurchasingCapacity } from "@/db/enums";
import { requireUser } from "@/lib/auth";
import { companyDetail } from "@/server/queries/detail";
import { timelineFor } from "@/server/queries/timeline";
import { loadPickers, loadRefs } from "@/server/queries/refs";
import { formatMoney } from "@/lib/money";
import { toNumber } from "@/lib/money";
import { formatDate, formatDateTime, isOverdue, relativeDay } from "@/lib/dates";
import { formatPhone, whatsappLink } from "@/lib/normalize";
import {
  billingChip,
  contactChip,
  deliveryChip,
  paymentChip,
  proposalChip,
  stageChip,
} from "@/lib/status";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { LeadScore } from "@/components/ui/lead-score";
import { MoneyStat } from "@/components/ui/stat";
import { Timeline } from "@/components/timeline";
import { RecordActions } from "@/components/record-actions";
import { AttachmentsList } from "@/components/attachments-list";
import { AuditTrail } from "@/components/audit-trail";
import { CompleteTaskButton } from "@/components/quick/complete-task";
import { CompanyHeaderActions } from "./header-actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const company = await companyDetail(id);
  return { title: company?.name ?? "Empresa" };
}

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const company = await companyDetail(id);
  if (!company) notFound();

  const [timeline, refs, pickers] = await Promise.all([
    timelineFor({ companyId: id }),
    loadRefs(),
    loadPickers(),
  ]);

  const open = company.opportunities.filter((o) => !o.closedAt);
  const won = company.opportunities.filter(
    (o) => company.stages.find((s) => s.slug === o.stage)?.kind === "ganado",
  );
  const openValue = open.reduce((acc, o) => acc + toNumber(o.amount), 0);
  const wonValue = won.reduce((acc, o) => acc + toNumber(o.amount), 0);
  const paid = company.payments
    .filter((p) => p.paidOn && p.status !== "reembolsado")
    .reduce((acc, p) => acc + toNumber(p.amount), 0);
  const outstanding = company.payments
    .filter((p) => !p.paidOn && p.status !== "reembolsado")
    .reduce((acc, p) => acc + toNumber(p.amount), 0);

  const invoiceOptions = company.invoices.map((i) => ({
    id: i.id,
    number: i.number,
    amount: i.amount,
    currency: i.currency,
  }));

  return (
    <div className="mx-auto max-w-[1400px]">
      <Link
        href="/empresas"
        className="no-print mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-brand"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Empresas
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-ink text-white">
            <Building2 className="size-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="break-anywhere text-[24px] font-semibold leading-tight text-ink sm:text-[28px]">
              {company.name}
            </h1>
            <p className="mt-0.5 text-[14px] text-muted">
              {[company.industry, company.city, company.country].filter(Boolean).join(" · ") ||
                "Sin sector registrado"}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <Badge
                tone={company.purchasingCapacity === "alta" ? "verde" : company.purchasingCapacity === "media" ? "azul" : "gris"}
                dot
              >
                Capacidad {PURCHASING_CAPACITY_LABEL[company.purchasingCapacity as PurchasingCapacity].toLowerCase()}
              </Badge>
              {company.size ? <Badge tone="gris">{company.size} empleados</Badge> : null}
              {company.website ? (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:text-brand-dark"
                >
                  {company.website.replace(/^https?:\/\//, "")}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <CompanyHeaderActions company={company} refs={refs} pickers={pickers} />
      </div>

      <div className="mb-5">
        <RecordActions
          refs={refs}
          pickers={pickers}
          scope={{ companyId: company.id }}
          show={["interaccion", "seguimiento"]}
        />
      </div>

      {/* Resumen de la relacion en dinero */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MoneyStat amount={formatMoney(openValue)} label="Pipeline abierto" help={`${open.length} negocios`} tone="marca" />
        <MoneyStat amount={formatMoney(wonValue)} label="Ganado histórico" help={`${won.length} negocios`} tone="bueno" />
        <MoneyStat amount={formatMoney(paid)} label="Pagado" help="Dinero recibido" tone="bueno" />
        <MoneyStat
          amount={formatMoney(outstanding)}
          label="Saldo pendiente"
          help={outstanding > 0 ? "Falta cobrar" : "Nada pendiente"}
          tone={outstanding > 0 ? "critico" : "neutro"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {/* Pendientes */}
          <Card className="overflow-hidden">
            <CardHeader title="Próximas acciones" description="Lo que está agendado con esta empresa." />
            {company.openTasks.length === 0 ? (
              <Empty
                icon={CalendarClock}
                title="Nada agendado con esta empresa"
                message="Agenda una llamada o un correo para que la relación no se enfrie."
              />
            ) : (
              <ul className="divide-y divide-line-soft">
                {company.openTasks.map((task) => (
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
                      clientName={company.name}
                      variant="outline"
                      label="Marcar como realizado"
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Negocios */}
          <Card className="overflow-hidden">
            <CardHeader title="Negocios" description={`${company.opportunities.length} en total`} />
            {company.opportunities.length === 0 ? (
              <Empty
                icon={Handshake}
                title="Sin negocios todavía"
                message="Crea el primer negocio para empezar a gestionar esta cuenta en el pipeline."
              />
            ) : (
              <ul className="divide-y divide-line-soft">
                {company.opportunities.map((opp) => {
                  const stage = company.stages.find((s) => s.slug === opp.stage);
                  const chip = stageChip(stage?.name ?? opp.stage, stage?.kind ?? "activa");
                  return (
                    <li key={opp.id} className="px-4 py-3.5 sm:px-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <Link
                          href={`/negocios/${opp.id}`}
                          className="break-anywhere min-w-0 text-[14px] font-medium text-ink hover:text-brand"
                        >
                          {opp.name}
                        </Link>
                        <span className="tnum shrink-0 text-[14px] font-semibold text-ink">
                          {formatMoney(opp.amount, opp.currency as Currency)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge tone={chip.tone} size="sm" dot>
                          {chip.label}
                        </Badge>
                        <Badge tone={proposalChip(opp.proposalStatus).tone} size="sm">
                          {proposalChip(opp.proposalStatus).label}
                        </Badge>
                        <Badge tone={billingChip(opp.billingStatus).tone} size="sm">
                          {billingChip(opp.billingStatus).label}
                        </Badge>
                        <Badge tone={paymentChip(opp.paymentStatus).tone} size="sm">
                          {paymentChip(opp.paymentStatus).label}
                        </Badge>
                        <Badge tone={deliveryChip(opp.deliveryStatus).tone} size="sm">
                          {deliveryChip(opp.deliveryStatus).label}
                        </Badge>
                      </div>
                      {opp.lostReason ? (
                        <p className="mt-1.5 text-[12px] text-muted">Motivo de perdida: {opp.lostReason}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Propuestas, facturas y pagos */}
          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="overflow-hidden">
              <CardHeader title="Propuestas" />
              {company.proposals.length === 0 ? (
                <Empty icon={FileText} title="Sin propuestas" message="Todavía no se ha enviado ninguna." />
              ) : (
                <ul className="divide-y divide-line-soft">
                  {company.proposals.map((p) => (
                    <li key={p.id} className="px-4 py-3 sm:px-5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-[13px] font-medium text-ink">
                          {p.number}
                          {p.currentVersion > 1 ? ` v${p.currentVersion}` : ""}
                        </span>
                        <span className="tnum text-[13px] font-semibold text-ink">
                          {formatMoney(p.amount, p.currency)}
                        </span>
                      </div>
                      <p className="clip-1 mt-0.5 text-[12px] text-muted">{p.title}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Badge tone={proposalChip(p.status).tone} size="sm" dot>
                          {proposalChip(p.status).label}
                        </Badge>
                        {p.sentAt ? (
                          <span className="text-[12px] text-muted">Enviada {relativeDay(p.sentAt)}</span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="overflow-hidden">
              <CardHeader title="Facturas y pagos" />
              {company.invoices.length === 0 && company.payments.length === 0 ? (
                <Empty icon={Receipt} title="Sin movimientos" message="No hay facturas ni pagos registrados." />
              ) : (
                <ul className="divide-y divide-line-soft">
                  {company.invoices.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink">Factura {i.number}</p>
                        <p className="text-[12px] text-muted">
                          {i.dueDate ? `Vence ${formatDate(i.dueDate)}` : "Sin fecha de vencimiento"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone={billingChip(i.status).tone} size="sm" dot>
                          {billingChip(i.status).label}
                        </Badge>
                        <span className="tnum text-[13px] font-semibold text-ink">
                          {formatMoney(toNumber(i.amount) * (1 + toNumber(i.taxRate) / 100), i.currency)}
                        </span>
                      </div>
                    </li>
                  ))}
                  {company.payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
                      <div className="min-w-0">
                        <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink">
                          <Wallet className="size-3.5 text-muted" aria-hidden />
                          {p.paidOn ? `Pago recibido ${formatDate(p.paidOn)}` : `Pago esperado ${formatDate(p.expectedOn)}`}
                        </p>
                        {p.notes ? <p className="clip-1 text-[12px] text-muted">{p.notes}</p> : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone={paymentChip(p.status).tone} size="sm" dot>
                          {paymentChip(p.status).label}
                        </Badge>
                        <span className="tnum text-[13px] font-semibold text-ink">
                          {formatMoney(p.amount, p.currency)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Timeline */}
          <Card className="overflow-hidden">
            <CardHeader title="Actividad" description="Toda la relación con esta empresa, en orden." />
            <Timeline entries={timeline} />
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Documentos" />
            <AttachmentsList entityType="empresa" entityId={company.id} files={company.attachments} />
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Historial de cambios" />
            <AuditTrail entityType="empresa" entityId={company.id} />
          </Card>
        </div>

        {/* Lateral */}
        <div className="min-w-0 space-y-5">
          <Card className="overflow-hidden">
            <CardHeader
              title="Contactos"
              description={`${company.contacts.length} en esta empresa`}
            />
            {company.contacts.length === 0 ? (
              <Empty
                icon={UserPlus}
                title="Sin contactos"
                message="Agrega a la persona con la que se habla en esta empresa."
              />
            ) : (
              <ul className="divide-y divide-line-soft">
                {company.contacts.map((c) => {
                  const chip = contactChip(c.status);
                  const wa = whatsappLink(c.phone);
                  return (
                    <li key={c.id} className="px-4 py-3 sm:px-5">
                      <div className="flex items-start gap-2.5">
                        <Avatar name={c.fullName} size="sm" />
                        <div className="min-w-0 flex-1">
                          <Link href={`/contactos/${c.id}`} className="clip-1 text-[14px] font-medium text-ink hover:text-brand">
                            {c.fullName}
                          </Link>
                          <p className="clip-1 text-[12px] text-muted">{c.position ?? "Sin cargo registrado"}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge tone={chip.tone} size="sm" dot>
                              {chip.label}
                            </Badge>
                            <LeadScore
                              score={c.leadScore}
                              factors={c.leadScoreBreakdown}
                              manual={c.leadScoreManual}
                              size="sm"
                            />
                          </div>
                          {c.phone || c.email ? (
                            <p className="mt-1.5 flex flex-wrap gap-x-3 text-[12px] text-muted">
                              {wa ? (
                                <a href={wa} target="_blank" rel="noreferrer" className="hover:text-brand">
                                  {formatPhone(c.phone)}
                                </a>
                              ) : null}
                              {c.email ? (
                                <a href={`mailto:${c.email}`} className="break-anywhere hover:text-brand">
                                  {c.email}
                                </a>
                              ) : null}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Datos" />
            <dl className="divide-y divide-line-soft">
              {[
                { label: "Sector", value: company.industry },
                { label: "Tamaño", value: company.size ? `${company.size} empleados` : null },
                { label: "Ciudad", value: company.city },
                { label: "País", value: company.country },
                { label: "Responsable", value: company.responsibleName },
                { label: "De dónde salió", value: company.sourceName },
                {
                  label: "Capacidad de compra",
                  value: PURCHASING_CAPACITY_LABEL[company.purchasingCapacity as PurchasingCapacity],
                },
                { label: "Creada", value: formatDate(company.createdAt) },
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

          {company.deliveries.length > 0 ? (
            <Card className="overflow-hidden">
              <CardHeader title="Servicios" />
              <ul className="divide-y divide-line-soft">
                {company.deliveries.map((d) => (
                  <li key={d.id} className="px-4 py-3 sm:px-5">
                    <p className="break-anywhere text-[13px] font-medium text-ink">{d.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge tone={deliveryChip(d.status).tone} size="sm" dot>
                        {deliveryChip(d.status).label}
                      </Badge>
                      {d.scheduledAt ? (
                        <span className="text-[12px] text-muted">{formatDateTime(d.scheduledAt)}</span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {company.notes ? (
            <Card>
              <CardHeader title="Notas" />
              <div className="px-4 py-3.5 sm:px-5">
                <p className="whitespace-pre-line break-anywhere text-[13px] leading-relaxed text-ink">
                  {company.notes}
                </p>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
