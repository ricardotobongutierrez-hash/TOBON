import type { Metadata } from "next";
import { asc, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { products } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { Card, CardHeader } from "@/components/ui/card";
import { ProductsPanel } from "./products-panel";

export const metadata: Metadata = { title: "Productos y servicios" };

export default async function ProductsPage() {
  await requireRole("admin");
  const db = await getDb();
  const rows = await db
    .select()
    .from(products)
    .where(isNull(products.deletedAt))
    .orderBy(asc(products.sort), asc(products.name));

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Productos y servicios"
        description="El tarifario vigente. Nada esta fijo en el código: todo se edita aquí."
      />
      <ProductsPanel rows={rows} />
    </Card>
  );
}
