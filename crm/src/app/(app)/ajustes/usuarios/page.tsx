import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { Card, CardHeader } from "@/components/ui/card";
import { UsersPanel } from "./users-panel";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage() {
  const me = await requireRole("admin");
  const db = await getDb();
  const rows = await db.select().from(users).orderBy(asc(users.name));

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Usuarios"
        description="Quien puede entrar al CRM. Los permisos se mantienen simples: administrador o equipo."
      />
      <UsersPanel rows={rows} meId={me.id} />
    </Card>
  );
}
