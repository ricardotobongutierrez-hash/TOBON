import Link from "next/link";
import type { Metadata } from "next";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquareDot,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { homeData } from "@/server/queries/dashboard";
import { formatMoney, formatMoneyShort, plural } from "@/lib/money";
import { greeting, monthLabel } from "@/lib/dates";
import { firstName } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { SectionTitle } from "@/components/ui/page-header";
import { MoneyStat, Stat } from "@/components/ui/stat";
import { ScopeToggle } from "@/components/ui/scope-toggle";
import { PrioritiesTable } from "./priorities-table";

export const metadata: Metadata = { title: "Inicio" };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const user = await requireUser();
  const { vista } = await searchParams;
  const scope = vista === "equipo" ? "equipo" : "mios";
  const data = await homeData(user.id, scope);

  const { counters, money, pipeline, alerts, priorities } = data;

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="brand-wordmark text-[26px] font-semibold leading-tight text-ink sm:text-[30px]">
            {greeting()}, {firstName(user.name)}.
          </h1>
          <p className="mt-1 text-[14px] text-muted">
            {scope === "mios" ? "Esto es lo tuyo para hoy." : "Esto es lo del equipo completo."}
          </p>
        </div>
        <ScopeToggle />
      </div>

      {/* ───────── HOY ───────── */}
      <SectionTitle>Hoy</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          value={counters.toAnswer}
          label="Clientes por responder"
          help="Escribieron y no les hemos contestado"
          href="/pendientes?seccion=esperando-cliente"
          tone={counters.toAnswer > 0 ? "atencion" : "neutro"}
          icon={MessageSquareDot}
        />
        <Stat
          value={counters.overdue}
          label="Seguimientos vencidos"
          help="Se pasó la fecha"
          href={`/pendientes?seccion=vencidos${scope === "equipo" ? "&vista=equipo" : ""}`}
          tone={counters.overdue > 0 ? "critico" : "bueno"}
          icon={Clock}
        />
        <Stat
          value={counters.meetings}
          label={counters.meetings === 1 ? "Reunión hoy" : "Reuniones hoy"}
          help="Agendadas para hoy"
          href="/pendientes?seccion=hoy"
          tone="marca"
          icon={CalendarClock}
        />
        <Stat
          value={counters.pendingProposals}
          label="Propuestas pendientes"
          help="Esperando respuesta del cliente"
          href="/negocios?pestana=propuestas"
          tone={counters.pendingProposals > 0 ? "atencion" : "neutro"}
          icon={FileText}
        />
        <Stat
          value={counters.pendingPayments}
          label="Pagos pendientes"
          help={counters.overduePayments > 0 ? `${plural(counters.overduePayments, "ya vencido", "ya vencidos")}` : "Ninguno vencido"}
          href="/finanzas"
          tone={counters.overduePayments > 0 ? "critico" : counters.pendingPayments > 0 ? "atencion" : "bueno"}
          icon={Wallet}
        />
      </div>

      {/* ───────── PRIORIDADES DE HOY ───────── */}
      <div className="mt-8">
        <SectionTitle
          action={
            <Button variant="quiet" size="sm" asChild>
              <Link href="/pendientes">
                Ver todos los pendientes
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          }
        >
          Prioridades de hoy
        </SectionTitle>
        <Card className="overflow-hidden">
          {priorities.length === 0 ? (
            <Empty
              icon={CheckCircle2}
              tone="bueno"
              title="No hay nada vencido ni pendiente para hoy"
              message={
                scope === "mios"
                  ? "Tus seguimientos están al día. Revisa el pipeline o mira lo del equipo completo."
                  : "El equipo está al día con los seguimientos de hoy."
              }
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link href="/negocios">Abrir el pipeline</Link>
                </Button>
              }
            />
          ) : (
            <PrioritiesTable rows={priorities} />
          )}
        </Card>
      </div>

      {/* ───────── ALERTA: negocios sin siguiente accion ───────── */}
      {alerts.withoutNextAction.length > 0 ? (
        <div className="mt-8">
          <SectionTitle>Requieren atención</SectionTitle>
          <Card className="overflow-hidden border-warn/30">
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-warn" aria-hidden />
                  {alerts.withoutNextAction.length}{" "}
                  {alerts.withoutNextAction.length === 1 ? "negocio activo" : "negocios activos"} sin proxima accion
                </span>
              }
              description="Un negocio sin siguiente paso agendado deja de avanzar. Agenda algo, aunque sea una llamada."
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link href="/negocios?filtro=sin-accion">Ver todos</Link>
                </Button>
              }
            />
            <ul className="divide-y divide-line-soft">
              {alerts.withoutNextAction.slice(0, 5).map((opp) => (
                <li key={opp.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/negocios/${opp.id}`} className="clip-1 text-[14px] font-medium text-ink hover:text-brand">
                      {opp.name}
                    </Link>
                    <p className="clip-1 text-[12px] text-muted">
                      {opp.companyName ?? opp.contactName ?? "Sin cliente"} ·{" "}
                      {opp.responsibleName ?? "Sin responsable"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="tnum text-[13px] font-medium text-ink">
                      {formatMoneyShort(opp.amount, opp.currency)}
                    </span>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/negocios/${opp.id}`}>Abrir</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      {/* ───────── PIPELINE Y DINERO ───────── */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <SectionTitle
            action={
              <Button variant="quiet" size="sm" asChild>
                <Link href="/negocios">
                  Abrir el pipeline
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            }
          >
            Pipeline activo
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyStat
              amount={formatMoney(pipeline.totalCop)}
              label="Pipeline total"
              help={plural(pipeline.activeCount, "negocio activo", "negocios activos")}
              href="/negocios"
              tone="marca"
            />
            <MoneyStat
              amount={formatMoney(pipeline.weightedCop)}
              label="Pipeline ponderado"
              help="Valor por probabilidad de cierre"
              href="/reportes"
            />
            <div className="sm:col-span-2">
              <MoneyStat
                amount={formatMoney(pipeline.closingThisMonthCop)}
                label={`Cierres esperados en ${monthLabel()}`}
                help={`${plural(pipeline.closingThisMonth, "negocio")} con fecha de cierre este mes`}
                href="/negocios"
              />
            </div>
          </div>
        </div>

        <div>
          <SectionTitle
            action={
              <Button variant="quiet" size="sm" asChild>
                <Link href="/finanzas">
                  Abrir Finanzas
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            }
          >
            Dinero
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyStat
              amount={formatMoney(money.pendingCollectionCop)}
              label="Por cobrar"
              help={counters.overduePayments > 0 ? plural(counters.overduePayments, "pago vencido", "pagos vencidos") : "Nada vencido"}
              href="/finanzas?kpi=por-cobrar"
              tone={counters.overduePayments > 0 ? "critico" : "neutro"}
            />
            <MoneyStat
              amount={formatMoney(money.paidThisMonthCop)}
              label={`Pagado en ${monthLabel()}`}
              help="Dinero recibido este mes"
              href="/finanzas?kpi=pagado-mes"
              tone="bueno"
            />
            <div className="sm:col-span-2">
              <Card className="px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink">Facturas pendientes de emitir</p>
                    <p className="text-[12px] text-muted">El cliente ya aceptó y pidió factura electrónica.</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={money.pendingInvoices > 0 ? "ambar" : "verde"} dot>
                      {money.pendingInvoices}
                    </Badge>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/finanzas?kpi=facturas-pendientes">Ver</Link>
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* ───────── SILENCIO PROLONGADO ───────── */}
      {alerts.stale.length > 0 ? (
        <div className="mt-8">
          <SectionTitle>Clientes que se están enfriando</SectionTitle>
          <Card className="overflow-hidden">
            <CardHeader
              title="Negocios activos sin contacto reciente"
              description="Tres, siete, catorce y treinta días de silencio son las señales que importan."
            />
            <ul className="divide-y divide-line-soft">
              {alerts.stale.slice(0, 6).map((opp) => (
                <li key={opp.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/negocios/${opp.id}`} className="clip-1 text-[14px] font-medium text-ink hover:text-brand">
                      {opp.name}
                    </Link>
                    <p className="clip-1 text-[12px] text-muted">
                      {opp.companyName ?? opp.contactName ?? "Sin cliente"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge tone={opp.silentDays >= 14 ? "rojo" : "ambar"} dot>
                      {plural(opp.silentDays, "día sin contacto", "días sin contacto")}
                    </Badge>
                    <span className="tnum hidden text-[13px] font-medium text-ink sm:block">
                      {formatMoneyShort(opp.amount, opp.currency)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
