"use server";

import { redirect } from "next/navigation";
import { and, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import {
  createSession,
  destroySession,
  hashPassword,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

const loginSchema = z.object({
  email: z.string().trim().min(1, "Escribe tu correo").email("Ese correo no parece valido"),
  password: z.string().min(1, "Escribe tu contraseña"),
});

/**
 * Freno a la fuerza bruta: a los cinco intentos fallidos la cuenta queda en
 * pausa quince minutos. Con tres usuarios y un formulario abierto a internet es
 * lo minimo; un ingreso correcto borra la cuenta de intentos.
 */
const MAX_INTENTOS = 5;
const PAUSA_MINUTOS = 15;

export async function login(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
  }

  const db = await getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, parsed.data.email.toLowerCase()), isNull(users.deletedAt)))
    .limit(1);

  // El mensaje es el mismo si el correo no existe o si la clave esta mal: no se
  // le dice a un extrano cuales correos estan registrados.
  const genericError = "Correo o contraseña incorrectos";
  if (!user) return { ok: false, error: genericError };
  if (!user.active) return { ok: false, error: "Esta cuenta esta desactivada. Habla con el administrador." };

  const ahora = new Date();
  if (user.lockedUntil && user.lockedUntil > ahora) {
    const minutos = Math.max(1, Math.ceil((user.lockedUntil.getTime() - ahora.getTime()) / 60000));
    return {
      ok: false,
      error: `Demasiados intentos fallidos. Vuelve a intentar en ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`,
    };
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    // El contador arranca de cero si la pausa anterior ya vencio.
    const fallidos = (user.lockedUntil && user.lockedUntil <= ahora ? 0 : user.failedLogins) + 1;
    const bloquear = fallidos >= MAX_INTENTOS;
    await db
      .update(users)
      .set({
        failedLogins: bloquear ? 0 : fallidos,
        lockedUntil: bloquear ? new Date(ahora.getTime() + PAUSA_MINUTOS * 60000) : null,
      })
      .where(eq(users.id, user.id));
    if (bloquear) {
      return {
        ok: false,
        error: `Demasiados intentos fallidos. La cuenta queda en pausa ${PAUSA_MINUTOS} minutos.`,
      };
    }
    return { ok: false, error: genericError };
  }

  await db
    .update(users)
    .set({ lastLoginAt: ahora, failedLogins: 0, lockedUntil: null })
    .where(eq(users.id, user.id));
  await createSession(user.id);
  return { ok: true };
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/ingresar");
}

/** ¿Ya existe algun usuario? Define si se muestra el primer ingreso. */
export async function hasUsers(): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select({ n: count() }).from(users);
  return (row?.n ?? 0) > 0;
}

const setupSchema = z
  .object({
    name: z.string().trim().min(3, "Escribe tu nombre completo"),
    email: z.string().trim().email("Ese correo no parece valido"),
    password: z.string().min(8, "La contraseña necesita al menos 8 caracteres"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las dos contraseñas no coinciden",
    path: ["confirm"],
  });

/** Crea el primer administrador. Solo funciona si la base esta vacia de usuarios. */
export async function createFirstAdmin(_prev: unknown, formData: FormData): Promise<ActionResult> {
  if (await hasUsers()) {
    return { ok: false, error: "Ya hay usuarios creados. Ingresa con tu cuenta." };
  }
  const parsed = setupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
  }

  const db = await getDb();
  const [user] = await db
    .insert(users)
    .values({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      passwordHash: await hashPassword(parsed.data.password),
      role: "admin",
    })
    .returning();

  await logAudit({
    userId: user!.id,
    userName: user!.name,
    action: "crear",
    entityType: "usuario",
    entityId: user!.id,
    summary: "Se creó el primer administrador del sistema",
  });

  await createSession(user!.id);
  return { ok: true };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Escribe tu contraseña actual"),
    password: z.string().min(8, "La nueva contraseña necesita al menos 8 caracteres"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las dos contraseñas no coinciden",
    path: ["confirm"],
  });

export async function changePassword(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
  }

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, me.id)).limit(1);
  if (!user) return { ok: false, error: "No se encontro la cuenta" };
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) {
    return { ok: false, error: "La contraseña actual no coincide" };
  }

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(parsed.data.password),
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, me.id));

  await logAudit({
    userId: me.id,
    userName: me.name,
    action: "actualizar",
    entityType: "usuario",
    entityId: me.id,
    summary: "Cambio su contraseña",
  });

  return { ok: true };
}
