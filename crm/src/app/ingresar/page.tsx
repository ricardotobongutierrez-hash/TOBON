import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { logoAssets } from "@/lib/brand";
import { hasUsers } from "@/server/actions/auth";
import { Wordmark } from "@/components/brand/wordmark";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  // Base recien instalada: primero se crea el administrador.
  if (!(await hasUsers())) redirect("/primer-ingreso");

  return (
    <main className="flex min-h-dvh flex-col bg-white lg:flex-row">
      {/* Panel de marca. En movil se reduce a una franja para no robar altura. */}
      <div className="relative flex shrink-0 flex-col justify-between bg-ink px-6 py-8 text-white lg:w-[44%] lg:px-12 lg:py-14">
        <Wordmark assets={logoAssets()} variant="claro" size="lg" />
        <div className="mt-8 hidden max-w-md lg:block">
          <p className="brand-wordmark text-[30px] leading-[1.25] text-white">
            El sistema comercial de la firma, en una sola pantalla.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            Contactos, negocios, propuestas, facturas y cobros. Con el siguiente paso siempre
            visible, para que ningún cliente se quede sin respuesta.
          </p>
        </div>
        <p className="mt-8 hidden text-[12px] text-white/45 lg:block">
          Uso interno. Toda la información comercial que ves aquí es confidencial.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <h1 className="text-[22px] font-semibold text-ink">Ingresa a tu cuenta</h1>
          <p className="mt-1.5 text-[14px] text-muted">
            Usa el correo con el que te crearon la cuenta.
          </p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
