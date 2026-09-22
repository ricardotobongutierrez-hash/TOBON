/**
 * Aplica los archivos SQL de drizzle/ en orden y registra los aplicados.
 * Se usa el mismo runner para Postgres y PGlite: el SQL generado es el mismo.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { openDb } from "./_db";

const DIR = join(process.cwd(), "drizzle");

async function main() {
  const { raw, close, mode } = await openDb();
  console.log(`Base de datos: ${mode}`);

  await raw(`CREATE TABLE IF NOT EXISTS __migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  );`);

  const files = readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.error("No hay migraciones en drizzle/. Corre primero: npm run db:generate");
    await close();
    process.exit(1);
  }

  for (const file of files) {
    const already = await selectOne(raw, file);
    if (already) {
      console.log(`  ya aplicada  ${file}`);
      continue;
    }
    const sql = readFileSync(join(DIR, file), "utf8");
    // drizzle-kit separa las sentencias con este marcador.
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await raw(statement);
    }
    await raw(`INSERT INTO __migrations (name) VALUES ('${file}');`);
    console.log(`  aplicada     ${file}  (${statements.length} sentencias)`);
  }

  await close();
  console.log("Migraciones al día.");
}

// El runner solo expone raw(), asi que la verificacion se hace con una tabla temporal.
async function selectOne(raw: (sql: string) => Promise<void>, file: string): Promise<boolean> {
  try {
    await raw(
      `DO $$ BEGIN IF EXISTS (SELECT 1 FROM __migrations WHERE name = '${file}') THEN RAISE EXCEPTION 'JIT_ALREADY_APPLIED'; END IF; END $$;`,
    );
    return false;
  } catch (err) {
    if (err instanceof Error && err.message.includes("JIT_ALREADY_APPLIED")) return true;
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
