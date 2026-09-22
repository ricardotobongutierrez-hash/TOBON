/** Cliente de base de datos para los scripts de consola (migrar, semillas, reset). */
import "dotenv/config";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema";

// Igual que en src/db/client.ts: se declara con el tipo de node-postgres porque
// PGlite expone la misma API de Drizzle y un union obligaria a castear siempre.
type ScriptDrizzle = NodePgDatabase<typeof schema>;

export type ScriptDb = Awaited<ReturnType<typeof openDb>>["db"];

export async function openDb() {
  if (process.env.DATABASE_URL) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: /sslmode=require|supabase|neon|railway/.test(process.env.DATABASE_URL)
        ? { rejectUnauthorized: false }
        : undefined,
    });
    const db: ScriptDrizzle = drizzle(pool, { schema });
    return {
      db,
      mode: "postgres" as const,
      raw: async (sql: string) => {
        await pool.query(sql);
      },
      close: async () => {
        await pool.end();
      },
    };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dir = process.env.PGLITE_DIR ?? ".pgdata";
  // Misma limpieza de candado abandonado que hace la aplicacion. Ver src/db/client.ts.
  const { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const ownLock = join(dir, ".jit-lock");
  if (existsSync(ownLock)) {
    const previous = Number(readFileSync(ownLock, "utf8").trim());
    let running = false;
    try {
      process.kill(previous, 0);
      running = true;
    } catch {
      running = false;
    }
    if (running && previous !== process.pid) {
      throw new Error(
        `Otro proceso (pid ${previous}) esta usando la base local en ${dir}. Detenlo antes de correr este script.`,
      );
    }
    rmSync(join(dir, "postmaster.pid"), { force: true });
    rmSync(ownLock, { force: true });
  } else if (existsSync(join(dir, "postmaster.pid"))) {
    rmSync(join(dir, "postmaster.pid"), { force: true });
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(ownLock, String(process.pid));
  const client = await PGlite.create({ dataDir: dir });
  const db = drizzle(client, { schema }) as unknown as ScriptDrizzle;
  return {
    db,
    mode: "pglite" as const,
    raw: async (sql: string) => {
      await client.exec(sql);
    },
    close: async () => {
      await client.close();
      rmSync(ownLock, { force: true });
    },
  };
}
