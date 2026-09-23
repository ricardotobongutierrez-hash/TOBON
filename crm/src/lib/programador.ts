import { runMaintenance } from "@/lib/automation";

const CADA_HORA = 60 * 60 * 1000;
const AL_ARRANCAR = 60 * 1000;

let programado = false;

async function barrer() {
  try {
    const r = await runMaintenance();
    const hubo = r.overduePayments + r.overdueInvoices + r.proposalsExpired + r.tasksCreated;
    if (hubo > 0) console.log("[mantenimiento]", r);
  } catch (err) {
    // Un barrido fallido no tumba el servidor: el siguiente lo reintenta.
    console.error("[mantenimiento]", err);
  }
}

/** Un minuto después de arrancar y luego cada hora. El barrido es idempotente. */
export function programarMantenimiento() {
  if (programado) return;
  programado = true;
  setTimeout(barrer, AL_ARRANCAR).unref();
  setInterval(barrer, CADA_HORA).unref();
}
