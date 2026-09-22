import type { Metadata } from "next";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { campaigns, contacts, leadSources } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { Card, CardHeader } from "@/components/ui/card";
import { CampaignsPanel } from "./campaigns-panel";

export const metadata: Metadata = { title: "Campañas" };

export default async function CampaignsPage() {
  await requireRole("admin");
  const db = await getDb();
  const rows = await db
    .select({
      c: campaigns,
      sourceName: leadSources.name,
      leads: sql<number>`(
        select count(*)::int from ${contacts} where ${contacts.campaignId} = ${campaigns.id}
      )`,
    })
    .from(campaigns)
    .leftJoin(leadSources, eq(campaigns.sourceId, leadSources.id))
    .orderBy(asc(campaigns.name));

  const sources = await db
    .select({ id: leadSources.id, name: leadSources.name })
    .from(leadSources)
    .orderBy(asc(leadSources.name));

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Campañas"
        description="Para saber que trajo cada anuncio. Se usan en contactos y en negocios."
      />
      <CampaignsPanel
        rows={rows.map((r) => ({ ...r.c, sourceName: r.sourceName, leads: r.leads }))}
        sources={sources}
      />
    </Card>
  );
}
