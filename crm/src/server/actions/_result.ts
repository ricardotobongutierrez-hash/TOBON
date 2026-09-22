/** Resultado uniforme de las acciones del servidor, en el idioma de la interfaz. */
export type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; field?: string };

export function ok(): Result;
export function ok<T>(data: T): Result<T>;
export function ok<T>(data?: T) {
  return { ok: true, data } as Result<T>;
}

export function fail(error: string, field?: string): Result<never> {
  return { ok: false, error, field };
}

/** Traduce un error tecnico a algo que un ejecutivo pueda leer. */
export function explain(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message === "NO_AUTORIZADO") return "Tu sesión expiró. Vuelve a ingresar.";
  if (message === "SIN_PERMISO") return "Tu perfil no tiene permiso para hacer esto.";
  if (message.includes("duplicate key") || message.includes("unique")) {
    return "Ya existe un registro con ese dato. Revisa si es un duplicado.";
  }
  if (message.includes("foreign key")) {
    return "No se puede completar porque el registro está ligado a otros datos.";
  }
  console.error("[CRM]", err);
  return "No se pudo guardar. Intenta de nuevo y si sigue igual avisale a Ricardo.";
}
