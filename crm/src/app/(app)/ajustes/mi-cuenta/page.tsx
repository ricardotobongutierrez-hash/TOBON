import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { Card, CardHeader } from "@/components/ui/card";
import { AccountForm } from "./account-form";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function AccountPage() {
  const me = await requireUser();
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, me.id)).limit(1);

  return (
    <div className="space-y-5">
      {user?.mustChangePassword ? (
        <div className="rounded-lg border border-warn/30 bg-warn-soft px-4 py-3.5">
          <p className="text-[14px] font-medium text-ink">Cambia tu contraseña</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink/80">
            Estas usando la contraseña que te asignaron. Cambiala abajo por una que solo tu conozcas.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader title="Mis datos" description="Cómo te ve el resto del equipo." />
        <div className="px-4 py-4 sm:px-5">
          <AccountForm user={user!} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Contraseña" description="Mínimo 8 caracteres." />
        <div className="px-4 py-4 sm:px-5">
          <PasswordForm />
        </div>
      </Card>
    </div>
  );
}
