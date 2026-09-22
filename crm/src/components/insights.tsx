import Link from "next/link";
import { AlertTriangle, ArrowRight, Info, Lightbulb, Sparkles } from "lucide-react";
import { AI_AVAILABLE, commercialInsights, summarizeInsights } from "@/lib/ai";
import { Card, CardHeader } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

/**
 * Hallazgos del CRM. Cada uno trae la cifra que lo respalda y un enlace al
 * registro: sin eso no se muestra. Si hay clave de Claude configurada, arriba
 * aparece un resumen redactado sobre estos mismos hechos.
 */
export async function Insights() {
  const insights = await commercialInsights();
  const summary = await summarizeInsights(insights);

  const styles = {
    critico: { border: "border-l-danger", icon: AlertTriangle, iconColor: "text-danger" },
    atencion: { border: "border-l-warn", icon: AlertTriangle, iconColor: "text-warn" },
    informativo: { border: "border-l-brand", icon: Info, iconColor: "text-brand" },
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Lightbulb className="size-4 shrink-0 text-brand" aria-hidden />
            Qué conviene atender
          </span>
        }
        description="Calculado con los datos del CRM. Cada punto trae la cifra que lo respalda."
      />

      {summary ? (
        <div className="border-b border-line-soft bg-brand-light/40 px-4 py-3.5 sm:px-5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-dark">
            <Sparkles className="size-3.5" aria-hidden />
            Lectura del día
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink">{summary}</p>
        </div>
      ) : null}

      {insights.length === 0 ? (
        <Empty
          tone="bueno"
          title="No hay nada que corregir"
          message="No se detectan negocios descuidados, propuestas estancadas ni cobros vencidos."
          className="py-8"
        />
      ) : (
        <ul className="divide-y divide-line-soft">
          {insights.map((insight) => {
            const style = styles[insight.severity];
            return (
              <li key={insight.key} className={cn("border-l-2 px-4 py-3.5 sm:px-5", style.border)}>
                <div className="flex items-start gap-2.5">
                  <style.icon className={cn("mt-0.5 size-4 shrink-0", style.iconColor)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="break-anywhere text-[14px] font-medium leading-snug text-ink">
                      {insight.title}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">{insight.detail}</p>
                    <p className="tnum mt-1.5 text-[12px] font-medium text-ink/70">{insight.evidence}</p>
                    <Link
                      href={insight.href}
                      className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:text-brand-dark"
                    >
                      Ver el detalle
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!AI_AVAILABLE ? (
        <p className="border-t border-line-soft bg-canvas px-4 py-2.5 text-[12px] leading-relaxed text-muted sm:px-5">
          El resumen redactado está pendiente de configuración: hace falta ANTHROPIC_API_KEY. Los hallazgos
          de arriba se calculan sin necesidad de eso.
        </p>
      ) : null}
    </Card>
  );
}
