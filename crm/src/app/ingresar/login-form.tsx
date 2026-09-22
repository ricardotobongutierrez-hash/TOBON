"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { login } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function LoginForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(login, null);

  useEffect(() => {
    if (state?.ok) {
      router.replace("/");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="mt-7 space-y-4">
      {state && !state.ok ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-danger/25 bg-danger-soft px-3 py-2.5 text-[13px] text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="leading-relaxed">{state.error}</p>
        </div>
      ) : null}

      <Field label="Correo" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          placeholder="nombre@joseitobon.com"
        />
      </Field>

      <Field label="Contraseña" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </Field>

      <Button type="submit" size="lg" block loading={pending}>
        Entrar
      </Button>

      <p className="pt-2 text-center text-[12px] leading-relaxed text-muted">
        Si olvidaste tu contraseña, pidele al administrador que te la restablezca desde
        Ajustes, Usuarios.
      </p>
    </form>
  );
}
