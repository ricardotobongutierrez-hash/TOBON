import type { Metadata } from "next";
import { SEGMENTS, SEGMENT_LABEL } from "@/db/enums";
import { requireUser } from "@/lib/auth";
import { buildReport } from "@/server/queries/reports";
import { loadRefs } from "@/server/queries/refs";
import { formatMoney, formatNumber, formatPercent, plural } from "@/lib/money";
import { ahora, formatDate, formatDateInput, startOfMonth } from "@/lib/dates";
import { Card, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Bars } from "./bars";
import { DateRange } from "./date-range";
import { PrintButton } from "./print-button";
import { Insights } from "@/components/insights";

export const metadata: Metadata = { title: "Reportes" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireUser();
  const sp = await searchParams;
  const refs = await loadRefs();

  // Por defecto, el mes en curso: es el periodo que se revisa todas las semanas.
  const from = sp.desde ?? formatDateInput(startOfMonth(ahora()));
  const to = sp.hasta ?? formatDateInput(ahora());

  const report = await buildReport({
    from,
    to,
    responsibleId: sp.responsable,
    productId: sp.producto,
    segment: sp.tipo,
    sourceId: sp.fuente,
    campaignId: sp.campana,
    stage: sp.etapa,
  });

  const { totals, breakdowns } = report;

  const kpis: { label: string; value: string; help?: string }[] = [
    { label: "Leads nuevos", value: formatNumber(totals.newLeads), help: "Contactos creados en el periodo" },
    { label: "Leads calificados", value: formatNumber(totals.qualifiedLeads) },
    { label: "Negocios activos", value: formatNumber(totals.activeDeals) },
    { label: "Valor del pipeline", value: formatMoney(totals.pipelineValue) },
    { label: "Pipeline ponderado", value: formatMoney(totals.weighted), help: "Valor por probabilidad" },
    { label: "Ganado", value: formatMoney(totals.wonValue), help: plural(totals.wonCount, "negocio") },
    { label: "Tasa de conversión", value: formatPercent(totals.conversionRate, 1), help: "Ganados frente a decididos" },
    { label: "Valor promedio ganado", value: formatMoney(totals.averageDeal) },
    {
      label: "Tiempo promedio de cierre",
      value: totals.averageCloseDays > 0 ? plural(totals.averageCloseDays, "dia") : "Sin datos",
    },
    {
      label: "Conversión de propuestas",
      value: formatPercent(totals.proposalConversion, 1),
      help: `${totals.proposalsAccepted} de ${totals.proposalsSent} enviadas`,
    },
    { label: "Cobrado", value: formatMoney(totals.collected), help: "Pagos recibidos en el periodo" },
    { label: "Por cobrar", value: formatMoney(totals.pendingCollection), help: "Saldo pendiente total" },
  ];

  return (
    <div className="mx-auto max-w-[1300px]">
      <PageHeader
        title="Reportes"
        description={`Del ${formatDate(from)} al ${formatDate(to)}. Todas las cifras respetan los filtros de abajo.`}
        action={<PrintButton />}
      />

      <DateRange from={from} to={to} />

      <FilterBar
        searchPlaceholder="Buscar"
        filters={[
          {
            name: "responsable",
            label: "Responsable",
            options: refs.team.map((u) => ({ value: u.id, label: u.name })),
          },
          { name: "producto", label: "Producto", options: refs.products.map((p) => ({ value: p.id, label: p.name })) },
          { name: "tipo", label: "B2B o B2C", options: SEGMENTS.map((s) => ({ value: s, label: SEGMENT_LABEL[s] })) },
          { name: "fuente", label: "De dónde salió", options: refs.sources.map((s) => ({ value: s.id, label: s.name })) },
          { name: "campana", label: "Campaña", options: refs.campaigns.map((c) => ({ value: c.id, label: c.name })) },
          { name: "etapa", label: "Etapa", options: refs.stages.map((s) => ({ value: s.slug, label: s.name })) },
        ]}
      />

      <div className="mb-6">
        <SectionTitle>Inteligencia comercial</SectionTitle>
        <Insights />
      </div>

      <SectionTitle>Resumen</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="px-4 py-3.5">
            <p className="eyebrow clip-1">{kpi.label}</p>
            <p className="tnum mt-1.5 break-anywhere text-[19px] font-semibold leading-tight text-ink">
              {kpi.value}
            </p>
            {kpi.help ? <p className="mt-0.5 text-[12px] leading-snug text-muted">{kpi.help}</p> : null}
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title="Pipeline por etapa" description="Donde está parado el dinero abierto." />
          <Bars rows={breakdowns.byStage} />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Ingresos por producto" description="Solo negocios ganados." />
          <Bars rows={breakdowns.revenueByProduct} emptyTitle="Todavía no hay negocios ganados" />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Ingresos por fuente" description="De donde viene el dinero que se cerro." />
          <Bars rows={breakdowns.revenueBySource} emptyTitle="Todavía no hay negocios ganados" />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Ingresos por campaña" description="Solo negocios ganados con campaña asignada." />
          <Bars rows={breakdowns.revenueByCampaign} emptyTitle="Ningún negocio ganado tiene campaña" />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Leads por campaña" description="Cuántos contactos trajo cada campaña." />
          <Bars rows={breakdowns.leadsByCampaign} mode="conteo" emptyTitle="Sin leads en el periodo" />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Leads por fuente" />
          <Bars rows={breakdowns.leadsBySource} mode="conteo" emptyTitle="Sin leads en el periodo" />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Pipeline por responsable" description="Valor abierto de cada persona." />
          <Bars rows={breakdowns.pipelineByResponsible} emptyTitle="Sin negocios activos" />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Motivos de pérdida"
            description="Lo que más se repite es lo que hay que trabajar."
          />
          <Bars
            rows={breakdowns.lostReasons}
            mode="conteo"
            emptyTitle="Ningún negocio perdido en el periodo"
            emptyMessage="Cuando se registre un negocio perdido con su motivo, aparece aquí."
          />
        </Card>
      </div>

      <div className="mt-6">
        <SectionTitle>B2B frente a B2C</SectionTitle>
        <Card>
          <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
            {[
              { label: "Empresas (B2B)", count: totals.b2bCount, value: totals.b2bValue },
              { label: "Personas (B2C)", count: totals.b2cCount, value: totals.b2cValue },
            ].map((row) => {
              const total = totals.b2bValue + totals.b2cValue;
              const share = total > 0 ? (row.value / total) * 100 : 0;
              return (
                <div key={row.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[13px] font-medium text-ink">{row.label}</p>
                    <p className="tnum text-[13px] text-muted">{formatPercent(share, 0)}</p>
                  </div>
                  <p className="tnum mt-1 break-anywhere text-[20px] font-semibold text-ink">
                    {formatMoney(row.value)}
                  </p>
                  <p className="text-[12px] text-muted">{plural(row.count, "negocio")}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-off-soft">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, share)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
