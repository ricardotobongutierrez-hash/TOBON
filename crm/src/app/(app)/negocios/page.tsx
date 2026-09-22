import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, Download, FileText, Handshake, KanbanSquare, List } from "lucide-react";
import { SEGMENTS, SEGMENT_LABEL } from "@/db/enums";
import { requireUser } from "@/lib/auth";
import { listOpportunities, listProposals } from "@/server/queries/lists";
import { loadPickers, loadRefs } from "@/server/queries/refs";
import { followUpSettings, financeSettings } from "@/lib/settings";
import { formatMoney, toNumber } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { MoneyStat } from "@/components/ui/stat";
import { PipelineBoard } from "./pipeline-board";
import { DealsTable } from "./deals-table";
import { ProposalsTable } from "./proposals-table";
import { NewDealButton } from "./new-deal-button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Negocios" };

type Tab = "tablero" | "lista" | "propuestas";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireUser();
  const sp = await searchParams;
  const tab: Tab = sp.pestana === "lista" ? "lista" : sp.pestana === "propuestas" ? "propuestas" : "tablero";

  const [refs, pickers, followUp, finance] = await Promise.all([
    loadRefs(),
    loadPickers(),
    followUpSettings(),
    financeSettings(),
  ]);

  const rows = await listOpportunities({
    q: sp.q,
    stage: sp.etapa,
    segment: sp.tipo,
    responsibleId: sp.responsable,
    productId: sp.producto,
    sourceId: sp.fuente,
    campaignId: sp.campana,
    missingNextAction: sp.filtro === "sin-accion",
  });

  const proposals = tab === "propuestas" ? await listProposals() : [];

  const activeSlugs = new Set(refs.stages.filter((s) => s.kind === "activa").map((s) => s.slug));
  const cop = (amount: string, currency: string) =>
    toNumber(amount) * (currency === "USD" ? finance.usdRate : 1);
  const active = rows.filter((r) => activeSlugs.has(r.stage));
  const total = active.reduce((acc, r) => acc + cop(r.amount, r.currency), 0);
  const weighted = active.reduce((acc, r) => acc + cop(r.amount, r.currency) * (r.probability / 100), 0);
  const noNext = active.filter((r) => !r.nextAction);

  const tabs: { key: Tab; label: string; icon: typeof List; count?: number }[] = [
    { key: "tablero", label: "Tablero", icon: KanbanSquare },
    { key: "lista", label: "Lista", icon: List, count: rows.length },
    { key: "propuestas", label: "Propuestas", icon: FileText },
  ];

  function tabHref(key: Tab) {
    const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    if (key === "tablero") next.delete("pestana");
    else next.set("pestana", key);
    return `/negocios${next.toString() ? `?${next}` : ""}`;
  }

  const exportHref = `/api/exportar/negocios?${new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v) as [string, string][],
  )}`;

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title="Negocios"
        description="El pipeline completo. Ningún negocio activo debería quedarse sin próxima acción."
        action={
          <>
            <Button variant="outline" asChild>
              <a href={exportHref}>
                <Download aria-hidden />
                <span className="hidden sm:inline">Exportar</span>
              </a>
            </Button>
            <NewDealButton refs={refs} pickers={pickers} />
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <MoneyStat
          amount={formatMoney(total)}
          label="Pipeline activo"
          help={`${active.length} negocios abiertos`}
          tone="marca"
        />
        <MoneyStat amount={formatMoney(weighted)} label="Pipeline ponderado" help="Valor por probabilidad" />
        <Card className="flex flex-col justify-center px-4 py-4">
          <p className="eyebrow">Sin próxima acción</p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className={cn("tnum text-[24px] font-semibold", noNext.length > 0 ? "text-warn" : "text-ok")}>
              {noNext.length}
            </span>
            <span className="text-[13px] text-muted">de {active.length} activos</span>
          </div>
          {noNext.length > 0 ? (
            <Link
              href={sp.filtro === "sin-accion" ? "/negocios" : "/negocios?filtro=sin-accion"}
              className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-brand hover:text-brand-dark"
            >
              {sp.filtro === "sin-accion" ? "Ver todos los negocios" : "Ver solo esos"}
            </Link>
          ) : (
            <p className="mt-1 text-[12px] text-ok">Todo el pipeline tiene siguiente paso.</p>
          )}
        </Card>
      </div>

      {/* Pestanas */}
      <div className="no-print mb-4 flex gap-1 border-b border-line-soft" role="tablist">
        {tabs.map((item) => (
          <Link
            key={item.key}
            href={tabHref(item.key)}
            role="tab"
            aria-selected={tab === item.key}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-[14px] font-medium transition-colors",
              tab === item.key
                ? "border-brand text-brand-dark"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
            {item.count !== undefined ? <span className="tnum text-[12px] text-muted">({item.count})</span> : null}
          </Link>
        ))}
      </div>

      {tab !== "propuestas" ? (
        <FilterBar
          searchPlaceholder="Negocio, empresa o contacto"
          filters={[
            { name: "etapa", label: "Etapa", options: refs.stages.map((s) => ({ value: s.slug, label: s.name })) },
            { name: "tipo", label: "Tipo", options: SEGMENTS.map((s) => ({ value: s, label: SEGMENT_LABEL[s] })) },
            {
              name: "responsable",
              label: "Responsable",
              options: refs.team.map((u) => ({ value: u.id, label: u.name })),
            },
            { name: "producto", label: "Producto", options: refs.products.map((p) => ({ value: p.id, label: p.name })) },
            { name: "fuente", label: "De dónde salió", options: refs.sources.map((s) => ({ value: s.id, label: s.name })) },
          ]}
        />
      ) : null}

      {sp.filtro === "sin-accion" ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-warn/30 bg-warn-soft px-3 py-2.5">
          <AlertTriangle className="size-4 shrink-0 text-warn" aria-hidden />
          <p className="min-w-0 flex-1 text-[13px] text-ink">
            Mostrando solo los negocios activos sin próxima acción agendada.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/negocios">Quitar el filtro</Link>
          </Button>
        </div>
      ) : null}

      {tab === "tablero" ? (
        rows.length === 0 ? (
          <Card>
            <Empty
              icon={Handshake}
              title="No hay negocios todavía"
              message="Crea el primer negocio para empezar a gestionar tu pipeline."
              action={<NewDealButton refs={refs} pickers={pickers} />}
            />
          </Card>
        ) : (
          <PipelineBoard stages={refs.stages} rows={rows} highValueCop={followUp.highValueCop} />
        )
      ) : null}

      {tab === "lista" ? (
        <Card className="overflow-hidden">
          {rows.length === 0 ? (
            <Empty
              icon={Handshake}
              title="Ningún negocio coincide"
              message="Prueba con menos filtros."
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link href="/negocios?pestana=lista">Limpiar filtros</Link>
                </Button>
              }
            />
          ) : (
            <DealsTable rows={rows} stages={refs.stages} />
          )}
        </Card>
      ) : null}

      {tab === "propuestas" ? (
        <Card className="overflow-hidden">
          {proposals.length === 0 ? (
            <Empty
              icon={FileText}
              tone="bueno"
              title="No hay propuestas registradas"
              message="Las propuestas se crean desde el negocio al que pertenecen."
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link href="/negocios">Ver el pipeline</Link>
                </Button>
              }
            />
          ) : (
            <ProposalsTable rows={proposals} />
          )}
        </Card>
      ) : null}
    </div>
  );
}
