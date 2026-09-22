"use client";

import { ROLE_LABEL } from "@/db/enums";
import { updateProfile } from "@/server/actions/settings";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FieldGrid, Input } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useSubmit } from "@/lib/use-submit";
import type { User } from "@/db/schema";

export function AccountForm({ user }: { user: User }) {
  const { submit, pending, error } = useSubmit({
    action: updateProfile,
    success: "Datos actualizados",
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormError message={error} />

      <div className="flex items-center gap-4">
        <Avatar name={user.name} photoUrl={user.photoUrl} size="lg" />
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-ink">{ROLE_LABEL[user.role]}</p>
          <p className="break-anywhere text-[13px] text-muted">{user.email}</p>
          <p className="mt-0.5 text-[12px] text-muted-light">
            El correo lo cambia un administrador desde Usuarios.
          </p>
        </div>
      </div>

      <FieldGrid>
        <Field label="Nombre completo" htmlFor="name" required>
          <Input id="name" name="name" defaultValue={user.name} required />
        </Field>
        <Field label="Teléfono" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" defaultValue={user.phone ?? ""} />
        </Field>
      </FieldGrid>

      <Field label="Foto" htmlFor="photoUrl" hint="Pega la dirección de una imagen. Si la dejas vacia se usan tus iniciales.">
        <Input id="photoUrl" name="photoUrl" defaultValue={user.photoUrl ?? ""} placeholder="https://…" />
      </Field>

      <fieldset className="rounded-md border border-line-soft bg-canvas p-4">
        <legend className="px-1 text-[13px] font-medium text-ink">Que quieres que te avisen</legend>
        <div className="mt-2 space-y-2.5">
          <Checkbox
            label="Resumen diario"
            hint="Lo que hay que hacer hoy, una vez al día."
            name="resumenDiario"
            defaultChecked={user.notifyPrefs.resumenDiario}
          />
          <Checkbox
            label="Seguimientos vencidos"
            hint="Cuando se pasa la fecha de algo tuyo."
            name="vencidos"
            defaultChecked={user.notifyPrefs.vencidos}
          />
          <Checkbox
            label="Pagos"
            hint="Cuando un pago se vence o entra."
            name="pagos"
            defaultChecked={user.notifyPrefs.pagos}
          />
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          El envío de correos de aviso todavía no está conectado: hace falta configurar el proveedor de
          correo saliente. Estas preferencias ya quedan guardadas y se respetan cuando se active.
        </p>
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
