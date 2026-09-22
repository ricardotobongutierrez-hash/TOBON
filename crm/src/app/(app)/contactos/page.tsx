import Link from "next/link";
import type { Metadata } from "next";
import { Download, UserPlus, Users } from "lucide-react";
import { CONTACT_STATUSES, CONTACT_STATUS_LABEL, SEGMENTS, SEGMENT_LABEL } from "@/db/enums";
import { requireUser } from "@/lib/auth";
import { listContacts } from "@/server/queries/lists";
import { loadRefs } from "@/server/queries/refs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { ContactsTable } from "./contacts-table";
import { NewContactButton } from "./new-contact-button";
import { loadPickers } from "@/server/queries/refs";

export const metadata: Metadata = { title: "Contactos" };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireUser();
  const sp = await searchParams;
  const [refs, pickers] = await Promise.all([loadRefs(), loadPickers()]);

  const { rows, total, page, perPage } = await listContacts({
    q: sp.q,
    segment: sp.tipo,
    status: sp.estado,
    responsibleId: sp.responsable,
    sourceId: sp.fuente,
    campaignId: sp.campana,
    productId: sp.producto,
    sort: sp.orden,
    page: Number(sp.pagina ?? 1),
    perPage: Number(sp.porPagina ?? 25),
  });

  const hasFilters = Boolean(sp.q || sp.tipo || sp.estado || sp.responsable || sp.fuente || sp.campana || sp.producto);
  const exportHref = `/api/exportar/contactos?${new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v) as [string, string][],
  )}`;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Contactos"
        description="Las personas. Cada una con su origen, su estado y lo que sigue."
        action={
          <>
            <Button variant="outline" asChild>
              <a href={exportHref}>
                <Download aria-hidden />
                <span className="hidden sm:inline">Exportar</span>
              </a>
            </Button>
            <NewContactButton refs={refs} pickers={pickers} />
          </>
        }
      />

      <FilterBar
        searchPlaceholder="Nombre, correo, teléfono o empresa"
        filters={[
          { name: "tipo", label: "Tipo", options: SEGMENTS.map((s) => ({ value: s, label: SEGMENT_LABEL[s] })) },
          {
            name: "estado",
            label: "Estado",
            options: CONTACT_STATUSES.map((s) => ({ value: s, label: CONTACT_STATUS_LABEL[s] })),
          },
          {
            name: "responsable",
            label: "Responsable",
            options: refs.team.map((u) => ({ value: u.id, label: u.name })),
          },
          { name: "fuente", label: "De dónde salió", options: refs.sources.map((s) => ({ value: s.id, label: s.name })) },
          { name: "campana", label: "Campaña", options: refs.campaigns.map((c) => ({ value: c.id, label: c.name })) },
          {
            name: "orden",
            label: "Ordenar por",
            options: [
              { value: "reciente", label: "Más recientes" },
              { value: "nombre", label: "Nombre" },
              { value: "puntaje", label: "Puntaje" },
              { value: "interaccion", label: "Última interacción" },
            ],
          },
        ]}
      />

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          hasFilters ? (
            <Empty
              icon={Users}
              title="Ningún contacto coincide con estos filtros"
              message="Prueba con menos filtros o revisa la escritura del nombre."
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link href="/contactos">Limpiar filtros</Link>
                </Button>
              }
            />
          ) : (
            <Empty
              icon={UserPlus}
              title="Todavía no hay contactos"
              message="Crea el primero o importa tu lista desde un archivo de Excel o CSV."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <NewContactButton refs={refs} pickers={pickers} />
                  <Button variant="outline" asChild>
                    <Link href="/ajustes/importar">Importar desde archivo</Link>
                  </Button>
                </div>
              }
            />
          )
        ) : (
          <>
            <ContactsTable rows={rows} />
            <Pagination page={page} perPage={perPage} total={total} noun="contactos" />
          </>
        )}
      </Card>
    </div>
  );
}
