import type { Metadata } from "next";
import { asc, eq, isNull, sql, and } from "drizzle-orm";
import { getDb } from "@/db/client";
import { opportunities, pipelineStages } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { Card, CardHeader } from "@/components/ui/card";
import { PipelinePanel } from "./pipeline-panel";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelineSettingsPage() {
  await requireRole("admin");
  const db = await getDb();
  const stages = await db.select().from(pipelineStages).orderBy(asc(pipelineStages.sort));

  const counts = await db
    .select({ stage: opportunities.stage, n: sql<number>`count(*)::int` })
    .from(opportunities)
    .where(isNull(opportunities.deletedAt))
    .groupBy(opportunities.stage);
  const countMap = Object.fromEntries(counts.map((c) => [c.stage, c.n]));

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Etapas del pipeline"
        description="El orden y los nombres son del negocio, no del software. El número define en que posición aparece la columna."
      />
      <PipelinePanel stages={stages} counts={countMap} />
    </Card>
  );
}
