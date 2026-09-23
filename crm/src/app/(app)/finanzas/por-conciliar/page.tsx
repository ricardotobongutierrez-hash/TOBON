import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, CheckCircle2, Download } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { pagosPorConciliar } from "@/server/queries/reconcile";
import { formatMoney, plural } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { formatPhone } from "@/lib/normalize";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, Td, Th, Thead, Tr } from "@/components/ui/table";

export const metadata: Metadata = { title: "Pagos por conciliar" };

const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function fechaCohorte(iso: string | null, aproximada: boolean): string {
  if (!iso) return "Sin fecha";
  if (!aproximada) return formatDate(iso);
  const [a, m] = iso.split("-").map(Number) as [number, number];
  return `${MES[m - 1]} de ${a}, sin día exacto`;
}

export default async function PorConciliarPage() {
  await requireUser();
  const { grupos, total, cantidad } = await pagosPorConciliar();

  return (
    <div className="mx-auto max-w-[1300px]">
      <Link
        href="/finanzas"
        className="tap-target mb-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-brand"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Finanzas
      </Link>
      <PageHeader
        title="Pagos por conciliar"
        description="Negocios ganados en los que la persona asistió o se inscribió, pero nadie ha cruzado el pago contra una factura FAN o un extracto de Bold. No son deuda: son pagos sin verificar."
        action={
          cantidad > 0 ? (
            <Button asChild variant="outline">
              <a href="/api/exportar/por-conciliar">
                <Download aria-hidden />
                Descargar para Excel
              </a>
            </Button>
          ) : null
        }
      />

      {cantidad === 0 ? (
        <Card>
          <Empty
            icon={CheckCircle2}
            tone="bueno"
            title="No hay pagos por conciliar"
            message="Cada negocio ganado tiene su pago registrado o su cobro pendiente. Cuando se importe una lista de asistentes sin marca de pago, aparece aquí."
          />
        </Card>
      ) : (
        <>
          <Card className="mb-5">
            <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-3 sm:px-5">
              <div>
                <p className="eyebrow">Por conciliar</p>
                <p className="tnum mt-1 text-[22px] font-semibold text-ink">{formatMoney(total)}</p>
              </div>
              <div>
                <p className="eyebrow">Negocios</p>
                <p className="tnum mt-1 text-[22px] font-semibold text-ink">{cantidad}</p>
              </div>
              <div>
                <p className="eyebrow">Cohortes</p>
                <p className="tnum mt-1 text-[22px] font-semibold text-ink">{grupos.length}</p>
              </div>
            </div>
            <p className="border-t border-line-soft px-4 py-3 text-[13px] leading-relaxed text-muted sm:px-5">
              Cómo se concilia: abre el negocio y registra el pago con el número de factura FAN o la
              referencia de Bold. Desde ese momento sale de esta lista y cuenta como pagado. Si la
              persona no pagó, cambia el negocio a Perdido o registra el cobro pendiente.
            </p>
          </Card>

          <div className="space-y-5">
            {grupos.map((g) => (
              <Card key={g.cohortId ?? "sin-cohorte"}>
                <CardHeader
                  title={g.cohortName}
                  description={`${fechaCohorte(g.startsOn, g.dateApproximate)} · ${plural(g.filas.length, "persona")} · ${formatMoney(g.total)}`}
                />

                <div className="hidden lg:block">
                  <DataTable>
                    <Thead>
                      <tr>
                        <Th>Persona</Th>
                        <Th>Empresa</Th>
                        <Th>Correo</Th>
                        <Th>Teléfono</Th>
                        <Th align="right">Valor sin IVA</Th>
                        <Th>Origen en el Excel</Th>
                      </tr>
                    </Thead>
                    <tbody>
                      {g.filas.map((f) => (
                        <Tr key={f.id}>
                          <Td className="max-w-60">
                            <Link href={`/negocios/${f.id}`} className="clip-1 font-medium text-ink hover:text-brand">
                              {f.contactName ?? "Cupo sin nombre"}
                            </Link>
                          </Td>
                          <Td className="max-w-44">
                            {f.companyId ? (
                              <Link href={`/empresas/${f.companyId}`} className="clip-1 text-muted hover:text-brand">
                                {f.companyName}
                              </Link>
                            ) : (
                              <span className="text-muted-light">Persona natural</span>
                            )}
                          </Td>
                          <Td className="max-w-56">
                            <span className="clip-1 text-muted">{f.email ?? "Sin correo"}</span>
                          </Td>
                          <Td className="whitespace-nowrap text-muted">{f.phone ? formatPhone(f.phone) : "Sin teléfono"}</Td>
                          <Td align="right" className="tnum whitespace-nowrap">
                            {formatMoney(f.amount, f.currency)}
                          </Td>
                          <Td className="whitespace-nowrap text-[13px] text-muted">
                            {f.hoja ? `${f.hoja}, fila ${f.fila}` : "Sin origen"}
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </DataTable>
                </div>

                <ul className="divide-y divide-line-soft lg:hidden">
                  {g.filas.map((f) => (
                    <li key={f.id}>
                      <Link href={`/negocios/${f.id}`} className="block px-4 py-3 hover:bg-canvas">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="clip-1 font-medium text-ink">{f.contactName ?? "Cupo sin nombre"}</p>
                            <p className="clip-1 text-[13px] text-muted">
                              {f.companyName ?? "Persona natural"}
                              {f.email ? ` · ${f.email}` : ""}
                            </p>
                            {f.hoja ? (
                              <p className="clip-1 text-[12px] text-muted-light">
                                {f.hoja}, fila {f.fila}
                              </p>
                            ) : null}
                          </div>
                          <p className="tnum shrink-0 text-[14px] font-medium text-ink">
                            {formatMoney(f.amount, f.currency)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
