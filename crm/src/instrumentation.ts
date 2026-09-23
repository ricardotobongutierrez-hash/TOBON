/**
 * Arranque del servidor.
 *
 * En un servidor que queda prendido (Railway, Render, un contenedor propio) el
 * barrido de mantenimiento se programa aquí mismo, cada hora, sin depender de
 * un cron externo: marca vencidos aunque nadie haya entrado y, de paso, mantiene
 * despierta la base de Supabase, que en el plan gratis se pausa tras una semana
 * sin uso.
 *
 * En Vercel no aplica: cada función vive segundos y el reloj no sobreviviría.
 * Allá lo hace el cron de vercel.json contra /api/mantenimiento.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // La firma trabaja en hora de Colombia. Los servidores en la nube corren en
  // UTC: sin esto una tarea de las 5 p. m. se ve a las 10 p. m., el "hoy" cambia
  // a las 7 p. m. y el saludo dice "buenas noches" a media tarde.
  process.env.TZ = process.env.APP_TIMEZONE || "America/Bogota";

  if (process.env.NODE_ENV !== "production" || process.env.VERCEL) return;
  if (!process.env.DATABASE_URL) return;

  const { programarMantenimiento } = await import("./lib/programador");
  programarMantenimiento();
}
