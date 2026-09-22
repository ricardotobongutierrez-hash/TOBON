"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { changePassword } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, FieldGrid, Input } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);

  useEffect(() => {
    if (state?.ok) toast.success("Contraseña actualizada");
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <FormError message={state && !state.ok ? state.error : null} />

      <Field label="Contraseña actual" htmlFor="current" required>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>

      <FieldGrid>
        <Field label="Nueva contraseña" htmlFor="password" required>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field label="Repite la nueva" htmlFor="confirm" required>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
      </FieldGrid>

      <div className="flex justify-end">
        <Button type="submit" variant="outline" loading={pending}>
          Cambiar contraseña
        </Button>
      </div>
    </form>
  );
}
