import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { importBatches, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { Card, CardHeader } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = { title: "Importar datos" };

export default async function ImportPage() {
  await requireUser();
  const db = await getDb();
  const history = await db
    .select({ b: importBatches, userName: users.name })
    .from(importBatches)
    .leftJoin(users, eq(importBatches.userId, users.id))
    .orderBy(desc(importBatches.createdAt))
    .limit(10);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Importar contactos o empresas"
          description="Desde un archivo de Excel o CSV. El proceso muestra una vista previa antes de guardar nada."
        />
        <div className="px-4 py-4 sm:px-5">
          <ImportWizard />
        </div>
      </Card>

      {history.length > 0 ? (
        <Card className="overflow-hidden">
          <CardHeader title="Importaciones anteriores" />
          <ul className="divide-y divide-line-soft">
            {history.map((row) => (
              <li key={row.b.id} className="px-4 py-3 sm:px-5">
                <p className="break-anywhere text-[13px] font-medium text-ink">{row.b.filename}</p>
                <p className="mt-0.5 text-[12px] text-muted">
                  {row.b.entity} · {formatDateTime(row.b.createdAt)} · {row.userName ?? "Sistema"}
                </p>
                <p className="tnum mt-1 text-[12px] text-muted">
                  {row.b.imported} creados · {row.b.updated} actualizados · {row.b.duplicates} duplicados ·{" "}
                  {row.b.errors} con error
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
