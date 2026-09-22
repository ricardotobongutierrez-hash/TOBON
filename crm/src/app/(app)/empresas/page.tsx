import Link from "next/link";
import type { Metadata } from "next";
import { Building2, Download, Plus } from "lucide-react";
import { PURCHASING_CAPACITY, PURCHASING_CAPACITY_LABEL } from "@/db/enums";
import { requireUser } from "@/lib/auth";
import { listCompanies } from "@/server/queries/lists";
import { loadRefs } from "@/server/queries/refs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { CompaniesTable } from "./companies-table";
import { NewCompanyButton } from "./new-company-button";

export const metadata: Metadata = { title: "Empresas" };

const SECTORS = [
  "Logística y transporte",
  "Manufactura",
  "Servicios financieros",
  "Salud y farmacéutica",
  "Tecnología",
  "Retail y consumo",
  "Energía y minas",
  "Construcción e infraestructura",
  "Agroindustria",
  "Educación",
  "Sector público",
  "Servicios profesionales",
  "Telecomunicaciones",
  "Otro",
];

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireUser();
  const sp = await searchParams;
  const refs = await loadRefs();

  const { rows, total, page, perPage } = await listCompanies({
    q: sp.q,
    industry: sp.sector,
    country: sp.pais,
    responsibleId: sp.responsable,
    capacity: sp.capacidad,
    sort: sp.orden,
    page: Number(sp.pagina ?? 1),
    perPage: 25,
  });

  const hasFilters = Boolean(sp.q || sp.sector || sp.pais || sp.responsable || sp.capacidad);
  const exportHref = `/api/exportar/empresas?${new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v) as [string, string][],
  )}`;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Empresas"
        description="Las organizaciones. Cada ficha reune contactos, negocios, propuestas y cobros."
        action={
          <>
            <Button variant="outline" asChild>
              <a href={exportHref}>
                <Download aria-hidden />
                <span className="hidden sm:inline">Exportar</span>
              </a>
            </Button>
            <NewCompanyButton refs={refs} />
          </>
        }
      />

      <FilterBar
        searchPlaceholder="Nombre, sitio web o sector"
        filters={[
          { name: "sector", label: "Sector", options: SECTORS.map((s) => ({ value: s, label: s })) },
          {
            name: "capacidad",
            label: "Capacidad de compra",
            options: PURCHASING_CAPACITY.map((c) => ({ value: c, label: PURCHASING_CAPACITY_LABEL[c] })),
          },
          {
            name: "responsable",
            label: "Responsable",
            options: refs.team.map((u) => ({ value: u.id, label: u.name })),
          },
          {
            name: "orden",
            label: "Ordenar por",
            options: [
              { value: "nombre", label: "Nombre" },
              { value: "reciente", label: "Más recientes" },
            ],
          },
        ]}
      />

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          hasFilters ? (
            <Empty
              icon={Building2}
              title="Ninguna empresa coincide con estos filtros"
              message="Prueba con menos filtros o revisa la escritura del nombre."
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link href="/empresas">Limpiar filtros</Link>
                </Button>
              }
            />
          ) : (
            <Empty
              icon={Plus}
              title="Todavía no hay empresas"
              message="Crea la primera empresa para empezar a construir el historial de la relación."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <NewCompanyButton refs={refs} />
                  <Button variant="outline" asChild>
                    <Link href="/ajustes/importar">Importar desde archivo</Link>
                  </Button>
                </div>
              }
            />
          )
        ) : (
          <>
            <CompaniesTable rows={rows} />
            <Pagination page={page} perPage={perPage} total={total} noun="empresas" />
          </>
        )}
      </Card>
    </div>
  );
}
