import "server-only";
import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { pipelineStages } from "@/db/schema";
import { DEFAULT_STAGES } from "@/db/enums";
import type { PipelineStage } from "@/db/schema";

/** Las etapas se leen de la base porque se editan en Ajustes → Pipeline. */
export async function getStages(): Promise<PipelineStage[]> {
  const db = await getDb();
  const rows = await db.select().from(pipelineStages).orderBy(asc(pipelineStages.sort));
  if (rows.length > 0) return rows;
  // Antes de correr las semillas se usan las etapas por defecto.
  return DEFAULT_STAGES.map((s, i) => ({
    id: `default-${i}`,
    slug: s.slug,
    name: s.name,
    kind: s.kind,
    probability: s.probability,
    sort: s.sort,
    active: true,
    createdAt: new Date(),
  }));
}

export async function stageMap(): Promise<Map<string, PipelineStage>> {
  const stages = await getStages();
  return new Map(stages.map((s) => [s.slug, s]));
}

export async function activeStageSlugs(): Promise<string[]> {
  return (await getStages()).filter((s) => s.kind === "activa").map((s) => s.slug);
}

export async function stageKindOf(slug: string): Promise<"activa" | "ganado" | "perdido" | "nutricion"> {
  return (await stageMap()).get(slug)?.kind ?? "activa";
}

export function stageName(stages: PipelineStage[], slug: string): string {
  return stages.find((s) => s.slug === slug)?.name ?? slug;
}
