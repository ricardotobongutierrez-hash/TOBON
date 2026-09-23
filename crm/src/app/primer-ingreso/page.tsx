import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { logoAssets } from "@/lib/brand";
import { hasUsers } from "@/server/actions/auth";
import { Wordmark } from "@/components/brand/wordmark";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Primer ingreso" };

/**
 * Nunca estatica. Esta pantalla pregunta a la base si ya hay usuarios, y esa
 * respuesta cambia justo despues del primer despliegue. Prerenderizada, Next la
 * congelaria en el momento de compilar y encima exigiria la base durante el
 * build, que es cuando menos deberia hacer falta.
 */
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // Si ya hay usuarios esta pantalla no debe existir.
  if (await hasUsers()) redirect("/ingresar");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Wordmark assets={logoAssets()} size="lg" />
        </div>
        <div className="rounded-lg border border-line-soft bg-white p-6 shadow-[var(--shadow-raised)] sm:p-8">
          <h1 className="text-[20px] font-semibold text-ink">Crea el primer usuario</h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
            Esta cuenta queda como administradora: puede crear a los demas usuarios y
            configurar el sistema.
          </p>
          <SetupForm />
        </div>
      </div>
    </main>
  );
}
