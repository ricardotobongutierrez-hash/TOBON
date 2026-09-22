import type { Metadata } from "next";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { contacts, leadSources } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { Card, CardHeader } from "@/components/ui/card";
import { SourcesPanel } from "./sources-panel";

export const metadata: Metadata = { title: "Fuentes" };

export default async function SourcesPage() {
  await requireRole("admin");
  const db = await getDb();
  const rows = await db.select().from(leadSources).orderBy(asc(leadSources.sort), asc(leadSources.name));
  const counts = await db
    .select({ sourceId: contacts.sourceId, n: sql<number>`count(*)::int` })
    .from(contacts)
    .groupBy(contacts.sourceId);
  const countMap = Object.fromEntries(counts.filter((c) => c.sourceId).map((c) => [c.sourceId!, c.n]));

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="De donde salen los leads"
        description="Estas fuentes alimentan la atribución y los reportes."
      />
      <SourcesPanel rows={rows} counts={countMap} />
    </Card>
  );
}
