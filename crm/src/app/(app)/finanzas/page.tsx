import Link from "next/link";
import type { Metadata } from "next";
import { CircleDollarSign } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { financeOverview } from "@/server/queries/finance";
import { loadPickers, loadRefs } from "@/server/queries/refs";
import { formatMoney, plural } from "@/lib/money";
import { Card, CardHeader } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { BucketGrid } from "./bucket-grid";
import { monthLabel } from "@/lib/dates";

export const metadata: Metadata = { title: "Finanzas" };

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ kpi?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const { buckets, usdRate } = await financeOverview();

  return (
    <div className="mx-auto max-w-[1300px]">
      <PageHeader
        title="Finanzas"
        description="Visibilidad operativa del dinero. Cada cifra se puede abrir para ver de que clientes sale."
      />

      {buckets.every((b) => b.lines.length === 0) ? (
        <Card>
          <Empty
            icon={CircleDollarSign}
            tone="bueno"
            title="Todavía no hay movimientos de dinero"
            message="Cuando registres una factura o un pago, aquí aparece el estado de la cobranza."
          />
        </Card>
      ) : (
        <>
          <BucketGrid buckets={buckets} initialOpen={sp.kpi} />

          <Card className="mt-5">
            <CardHeader
              title="Cómo se calculan estas cifras"
              description="Sirve para revisar el cobro, no reemplaza la contabilidad."
            />
            <div className="space-y-2 px-4 py-4 text-[13px] leading-relaxed text-muted sm:px-5">
              <p>
                <span className="font-medium text-ink">Por cobrar</span> suma los pagos registrados que
                todavía no se han recibido, vencidos y no vencidos.
              </p>
              <p>
                <span className="font-medium text-ink">Pagado en {monthLabel()}</span> cuenta solo lo que
                entró con fecha de pago dentro del mes en curso.
              </p>
              <p>
                <span className="font-medium text-ink">El IVA del 19 %</span> se incluye en las facturas
                que lo llevan, y solo aplica a quien necesita factura electrónica.
              </p>
              <p>
                Los montos en dolares se muestran convertidos a pesos con la tasa de referencia de{" "}
                <span className="tnum font-medium text-ink">{formatMoney(usdRate)}</span> por dólar, que se
                edita en <Link href="/ajustes/finanzas" className="font-medium text-brand hover:text-brand-dark">Ajustes, Configuración financiera</Link>.
              </p>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
