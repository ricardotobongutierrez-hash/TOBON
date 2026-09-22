/**
 * Imprime una cookie de sesion valida para un usuario, para probar la aplicacion
 * desde la consola o un navegador automatizado. Solo para desarrollo.
 *
 *   npx tsx scripts/dev-token.ts ricardo.tobon@joseitobon.com
 */
import { eq } from "drizzle-orm";
import { SignJWT } from "jose";
import { openDb } from "./_db";
import { users } from "../src/db/schema";

async function main() {
  const email = process.argv[2] ?? "ricardo.tobon@joseitobon.com";
  const { db, close } = await openDb();
  const [user] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.email, email)).limit(1);
  await close();
  if (!user) {
    console.error(`No existe un usuario con el correo ${email}`);
    process.exit(1);
  }
  const raw = process.env.AUTH_SECRET;
  const secret = new TextEncoder().encode(
    raw && raw.length >= 24 ? raw : "jit-crm-desarrollo-secreto-local-no-produccion",
  );
  const token = await new SignJWT({ sub: user.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secret);
  process.stdout.write(token);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
