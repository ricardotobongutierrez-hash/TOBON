import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { businessSettings, financeSettings } from "@/lib/settings";
import { Card, CardHeader } from "@/components/ui/card";
import { FinanceForm } from "./finance-form";
import { BusinessForm } from "./business-form";
import { DemoDataPanel } from "./demo-panel";
import { demoCount } from "@/server/actions/settings";

export const metadata: Metadata = { title: "Configuración financiera" };

export default async function FinanceSettingsPage() {
  await requireRole("admin");
  const [finance, business, demo] = await Promise.all([financeSettings(), businessSettings(), demoCount()]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Configuración financiera"
          description="Afecta los totales de Finanzas y los consecutivos de facturas y propuestas."
        />
        <div className="px-4 py-4 sm:px-5">
          <FinanceForm settings={finance} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Datos del negocio" description="Aparecen en pantallas y documentos." />
        <div className="px-4 py-4 sm:px-5">
          <BusinessForm settings={business} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Datos de demostración"
          description="Los registros de prueba que vinieron con la instalación."
        />
        <div className="px-4 py-4 sm:px-5">
          <DemoDataPanel count={demo} />
        </div>
      </Card>
    </div>
  );
}
