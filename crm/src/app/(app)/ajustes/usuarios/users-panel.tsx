"use client";

import { useState } from "react";
import { KeyRound, Pencil, Plus } from "lucide-react";
import { ROLES, ROLE_LABEL } from "@/db/enums";
import { createUser, resetUserPassword, updateUser } from "@/server/actions/settings";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, Modal } from "@/components/ui/drawer";
import { Checkbox, Field, FieldGrid, Input, Select } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useRun, useSubmit } from "@/lib/use-submit";
import { formatDate } from "@/lib/dates";
import type { User } from "@/db/schema";

export function UsersPanel({ rows, meId }: { rows: User[]; meId: string }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const { run, pending: running } = useRun();

  const create = useSubmit({
    action: createUser,
    success: "Usuario creado",
    onDone: () => setCreating(false),
  });

  const update = useSubmit({
    action: (fd) => updateUser(editing!.id, fd),
    success: "Usuario actualizado",
    onDone: () => setEditing(null),
  });

  return (
    <>
      <div className="flex justify-end border-b border-line-soft px-4 py-3 sm:px-5">
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          Nuevo usuario
        </Button>
      </div>

      <ul className="divide-y divide-line-soft">
        {rows.map((user) => (
          <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={user.name} photoUrl={user.photoUrl} size="md" />
              <div className="min-w-0">
                <p className="clip-1 text-[14px] font-medium text-ink">
                  {user.name}
                  {user.id === meId ? <span className="ml-1.5 text-[12px] font-normal text-muted">(tu)</span> : null}
                </p>
                <p className="break-anywhere text-[12px] text-muted">{user.email}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge tone={user.role === "admin" ? "azul" : "gris"} size="sm">
                    {ROLE_LABEL[user.role]}
                  </Badge>
                  <Badge tone={user.active ? "verde" : "gris"} size="sm" dot>
                    {user.active ? "Activo" : "Inactivo"}
                  </Badge>
                  {user.mustChangePassword ? (
                    <Badge tone="ambar" size="sm">
                      Debe cambiar su contraseña
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-[12px] text-muted-light">
                  {user.lastLoginAt ? `Ultimo ingreso: ${formatDate(user.lastLoginAt)}` : "Nunca ha ingresado"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setEditing(user)}>
                <Pencil aria-hidden />
                Editar
              </Button>
              <Button
                variant="quiet"
                size="sm"
                onClick={() => {
                  setNewPassword("");
                  setResetting(user);
                }}
              >
                <KeyRound aria-hidden />
                <span className="hidden sm:inline">Restablecer clave</span>
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Drawer
        open={creating}
        onOpenChange={setCreating}
        title="Nuevo usuario"
        description="La persona tendrá que cambiar la contraseña en su primer ingreso."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="nuevo-usuario" loading={create.pending}>
              Crear usuario
            </Button>
          </>
        }
      >
        <form id="nuevo-usuario" onSubmit={create.submit} className="space-y-4">
          <FormError message={create.error} />
          <Field label="Nombre completo" htmlFor="name" required>
            <Input id="name" name="name" required autoFocus />
          </Field>
          <Field label="Correo" htmlFor="email" required>
            <Input id="email" name="email" type="email" required placeholder="nombre@joseitobon.com" />
          </Field>
          <FieldGrid>
            <Field label="Rol" htmlFor="role">
              <Select id="role" name="role" defaultValue="equipo">
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Contraseña inicial" htmlFor="password" required hint="Mínimo 8 caracteres.">
              <Input id="password" name="password" type="text" required minLength={8} />
            </Field>
          </FieldGrid>
          <p className="rounded-md border border-line-soft bg-canvas px-3 py-2.5 text-[12px] leading-relaxed text-muted">
            El administrador puede acceder a todo y configurar el sistema. El equipo puede ver y trabajar la
            información comercial, pero no cambiar la configuración.
          </p>
        </form>
      </Drawer>

      <Drawer
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
        title="Editar usuario"
        description={editing?.email}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="editar-usuario" loading={update.pending}>
              Guardar cambios
            </Button>
          </>
        }
      >
        {editing ? (
          <form id="editar-usuario" onSubmit={update.submit} className="space-y-4">
            <FormError message={update.error} />
            <Field label="Nombre completo" htmlFor="edit-name" required>
              <Input id="edit-name" name="name" defaultValue={editing.name} required />
            </Field>
            <Field label="Rol" htmlFor="edit-role">
              <Select id="edit-role" name="role" defaultValue={editing.role}>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
              </Select>
            </Field>
            <Checkbox
              label="Cuenta activa"
              hint="Si la desactivas, la persona no puede ingresar pero su historial se conserva."
              name="active"
              defaultChecked={editing.active}
            />
          </form>
        ) : null}
      </Drawer>

      <Modal
        open={resetting !== null}
        onOpenChange={(v) => !v && setResetting(null)}
        title="Restablecer contraseña"
        description={`Se le asigna una contraseña nueva a ${resetting?.name ?? ""}, que tendrá que cambiarla al ingresar.`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setResetting(null)}>
              Cancelar
            </Button>
            <Button
              loading={running}
              onClick={async () => {
                if (!resetting) return;
                const done = await run(
                  () => resetUserPassword(resetting.id, newPassword),
                  "Contraseña restablecida",
                );
                if (done) setResetting(null);
              }}
            >
              Restablecer
            </Button>
          </>
        }
      >
        <Field label="Contraseña nueva" htmlFor="nueva-clave" required hint="Mínimo 8 caracteres. Compártesela por un canal seguro.">
          <Input
            id="nueva-clave"
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
          />
        </Field>
      </Modal>
    </>
  );
}
