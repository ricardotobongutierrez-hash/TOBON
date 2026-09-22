/**
 * Borra todo y vuelve a crear el esquema. Pide confirmacion explicita porque no
 * se puede deshacer.
 *
 *   npx tsx scripts/reset.ts --si
 */
import { openDb } from "./_db";

async function main() {
  if (!process.argv.includes("--si")) {
    console.error("Esto borra TODOS los datos del CRM. Si estas seguro, corre:");
    console.error("  npx tsx scripts/reset.ts --si");
    process.exit(1);
  }
  const { raw, close, mode } = await openDb();
  console.log(`Borrando el esquema en ${mode}...`);
  await raw("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await close();
  console.log("Listo. Ahora corre: npm run db:migrate && npm run db:seed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
