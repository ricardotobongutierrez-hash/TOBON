"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { createFirstAdmin } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function SetupForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createFirstAdmin, null);

  useEffect(() => {
    if (state?.ok) {
      router.replace("/");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="mt-6 space-y-4">
      {state && !state.ok ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-danger/25 bg-danger-soft px-3 py-2.5 text-[13px] text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="leading-relaxed">{state.error}</p>
        </div>
      ) : null}

      <Field label="Nombre completo" htmlFor="name" required>
        <Input id="name" name="name" autoComplete="name" required autoFocus placeholder="José Ignacio Tobón" />
      </Field>
      <Field label="Correo" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="director@joseitobon.com" />
      </Field>
      <Field label="Contraseña" htmlFor="password" required hint="Mínimo 8 caracteres.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Repite la contraseña" htmlFor="confirm" required>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>

      <Button type="submit" size="lg" block loading={pending}>
        Crear cuenta y entrar
      </Button>
    </form>
  );
}
