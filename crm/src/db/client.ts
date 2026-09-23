import "server-only";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

/**
 * Un solo cliente para dos escenarios:
 *
 *  - Produccion: DATABASE_URL apunta a Postgres (Supabase, Neon, Railway...).
 *  - Local: sin DATABASE_URL se usa PGlite, un Postgres embebido en .pgdata.
 *
 * Es el mismo Postgres en los dos casos, asi que el SQL de las migraciones y las
 * consultas de Drizzle no cambian. Sirve para arrancar sin credenciales.
 */
// Se declara con el tipo de node-postgres a proposito. PGlite expone la misma
// API de Drizzle, y un tipo union obligaria a castear en cada consulta.
export type Db = NodePgDatabase<typeof schema>;

export const DB_MODE: "postgres" | "pglite" = process.env.DATABASE_URL ? "postgres" : "pglite";

export const PGLITE_DIR = process.env.PGLITE_DIR ?? ".pgdata";


// Next recarga los modulos en desarrollo: sin este cache se abriria una conexion
// nueva (y en PGlite un lock nuevo) en cada cambio de archivo.
const globalForDb = globalThis as unknown as { __jitDb?: Db; __jitPool?: unknown };

/**
 * En serverless cada instancia abre su propio pool, asi que diez conexiones por
 * instancia agotan el limite de la base en cuanto hay trafico. Tres alcanzan.
 */
const DEFAULT_POOL_MAX = process.env.VERCEL ? 3 : 10;

async function build(): Promise<Db> {
  if (process.env.DATABASE_URL) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_MAX ?? DEFAULT_POOL_MAX),
      ssl: /sslmode=require|supabase|neon|railway/.test(process.env.DATABASE_URL)
        ? { rejectUnauthorized: false }
        : undefined,
    });
    globalForDb.__jitPool = pool;
    return drizzle(pool, { schema });
  }

  // La base embebida escribe en disco, y en produccion (Vercel, un contenedor
  // sin volumen) el disco es efimero o de solo lectura. Antes de fallar con un
  // "Aborted()" sin pistas, se dice que falta la variable.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Falta DATABASE_URL. En produccion el CRM necesita un PostgreSQL administrado: " +
        "la base embebida guarda en disco y ahi el disco no sobrevive al despliegue.",
    );
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = await openPglite(PGlite);
  return drizzle(client, { schema }) as unknown as Db;
}

/**
 * PGlite deja un postmaster.pid en el directorio de datos. Si el proceso anterior
 * murio de golpe (Ctrl+C duro, contenedor reiniciado), el archivo queda y la
 * siguiente apertura falla con un "Aborted()" que no dice nada.
 *
 * Aqui se distingue un candado vivo de uno abandonado: el CRM guarda su propio
 * archivo con el pid del proceso de Node. Si ese proceso ya no existe, el
 * candado se limpia y se reintenta. Si sigue vivo, el error lo dice con palabras.
 */
async function openPglite(PGlite: typeof import("@electric-sql/pglite").PGlite) {
  const { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } = await import("node:fs");
  const { join } = await import("node:path");

  const ownLock = join(PGLITE_DIR, ".jit-lock");
  const pgLock = join(PGLITE_DIR, "postmaster.pid");

  if (existsSync(ownLock)) {
    const previous = Number(readFileSync(ownLock, "utf8").trim());
    if (Number.isInteger(previous) && previous > 0 && previous !== process.pid && alive(previous)) {
      throw new Error(
        `Otro proceso (pid ${previous}) esta usando la base local en ${PGLITE_DIR}. ` +
          "Detenlo antes de arrancar, o define DATABASE_URL para usar un Postgres compartido.",
      );
    }
    // El proceso anterior ya no existe: el candado quedo abandonado.
    rmSync(pgLock, { force: true });
    rmSync(ownLock, { force: true });
  } else if (existsSync(pgLock)) {
    // Candado de una corrida anterior sin registro propio: tambien abandonado.
    rmSync(pgLock, { force: true });
  }

  mkdirSync(PGLITE_DIR, { recursive: true });
  writeFileSync(ownLock, String(process.pid));
  return PGlite.create({ dataDir: PGLITE_DIR });
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM significa que el proceso existe pero es de otro usuario.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

let pending: Promise<Db> | null = null;

export async function getDb(): Promise<Db> {
  if (globalForDb.__jitDb) return globalForDb.__jitDb;
  if (!pending) {
    pending = build().then((db) => {
      globalForDb.__jitDb = db;
      return db;
    });
  }
  return pending;
}

export { schema };
