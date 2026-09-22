import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import type { User } from "@/db/schema";
import type { Role } from "@/db/enums";

/**
 * Sesion por cookie firmada. No se guardan contrasenas en claro y la cookie es
 * httpOnly, asi que el navegador no puede leerla desde JavaScript.
 *
 * Si mas adelante se migra a Supabase Auth, solo cambia este archivo: el resto
 * de la aplicacion consume currentUser().
 */
const COOKIE = "jit_sesion";
const DAYS = 14;

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 24) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET no está configurado o es demasiado corto (mínimo 24 caracteres).");
    }
    // En desarrollo se permite arrancar sin secreto, con un valor fijo y avisando.
    return new TextEncoder().encode("jit-crm-desarrollo-secreto-local-no-produccion");
  }
  return new TextEncoder().encode(value);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DAYS}d`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export type SessionUser = Pick<
  User,
  "id" | "name" | "email" | "role" | "photoUrl" | "active" | "notifyPrefs" | "mustChangePassword"
>;

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.sub !== "string") return null;
    userId = payload.sub;
  } catch {
    return null;
  }

  const db = await getDb();
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      photoUrl: users.photoUrl,
      active: users.active,
      notifyPrefs: users.notifyPrefs,
      mustChangePassword: users.mustChangePassword,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  if (!user || !user.active) return null;
  return user;
}

/** Para server actions y paginas: falla si no hay sesion. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Error("NO_AUTORIZADO");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new Error("SIN_PERMISO");
  return user;
}

export function isAdmin(user: { role: Role } | null): boolean {
  return user?.role === "admin";
}
