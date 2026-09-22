"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Result } from "@/server/actions/_result";

/**
 * Envio de formularios con un solo comportamiento en toda la aplicacion: se
 * deshabilita el boton, se muestra el error dentro del formulario, y al guardar
 * bien aparece un aviso corto y la pantalla se refresca.
 */
export function useSubmit<T>(options: {
  action: (formData: FormData) => Promise<Result<T>>;
  success: string;
  onDone?: (data: T | undefined) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setPending(true);
    setError(null);
    setField(null);
    try {
      const result = await options.action(formData);
      if (result.ok) {
        toast.success(options.success);
        options.onDone?.(("data" in result ? result.data : undefined) as T | undefined);
        router.refresh();
      } else {
        setError(result.error);
        setField(result.field ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setPending(false);
    }
  }

  return { submit, pending, error, field, setError };
}

/** Para acciones de un clic: mover una etapa, marcar hecho, cambiar un estado. */
export function useRun() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run<T>(fn: () => Promise<Result<T>>, success?: string) {
    setPending(true);
    try {
      const result = await fn();
      if (result.ok) {
        if (success) toast.success(success);
        router.refresh();
        return true;
      }
      toast.error(result.error);
      return false;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo completar");
      return false;
    } finally {
      setPending(false);
    }
  }

  return { run, pending };
}
