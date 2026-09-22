"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileUp, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  parseImportFile,
  previewImport,
  runImport,
  type ImportResult,
  type ParsedFile,
  type PreviewRow,
} from "@/server/actions/import";
import { FIELD_LABEL, IMPORT_FIELDS, type ImportField } from "@/lib/import-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Select } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { DataTable, Td, Th, Thead, Tr } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { n: 1, label: "Subir el archivo" },
  { n: 2, label: "Emparejar columnas" },
  { n: 3, label: "Revisar" },
  { n: 4, label: "Resultado" },
];

export function ImportWizard() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(1);
  const [entity, setEntity] = useState<"contactos" | "empresas">("contactos");
  const [filename, setFilename] = useState("");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<ImportField[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [updateExisting, setUpdateExisting] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await parseImportFile(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setFilename(file.name);
      setParsed(res.data);
      setMapping(res.data.mapping);
      setStep(2);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function goPreview() {
    if (!parsed) return;
    const required = entity === "contactos" ? "nombre" : "empresa";
    if (!mapping.includes(required as ImportField) && !(entity === "empresas" && mapping.includes("nombre"))) {
      setError(
        entity === "contactos"
          ? "Falta emparejar la columna del nombre del contacto."
          : "Falta emparejar la columna del nombre de la empresa.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await previewImport(entity, parsed.rows, mapping);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPreview(res.data.preview);
      setCounts(res.data.counts);
      setStep(3);
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await runImport(entity, parsed.rows, mapping, { filename, updateExisting });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res.data);
      setStep(4);
      toast.success(`${res.data.imported} creados, ${res.data.updated} actualizados`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep(1);
    setParsed(null);
    setPreview([]);
    setResult(null);
    setError(null);
    setFilename("");
  }

  return (
    <div>
      {/* Pasos */}
      <ol className="mb-5 flex flex-wrap gap-x-2 gap-y-1">
        {STEPS.map((item) => (
          <li key={item.n} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                step === item.n
                  ? "bg-brand text-white"
                  : step > item.n
                    ? "bg-ok-soft text-ok"
                    : "bg-off-soft text-muted",
              )}
            >
              {step > item.n ? "✓" : item.n}
            </span>
            <span
              className={cn("text-[13px]", step === item.n ? "font-medium text-ink" : "text-muted")}
            >
              {item.label}
            </span>
            {item.n < STEPS.length ? <span className="mx-1 text-line" aria-hidden>·</span> : null}
          </li>
        ))}
      </ol>

      {error ? (
        <div className="mb-4">
          <FormError message={error} />
        </div>
      ) : null}

      {/* Paso 1 */}
      {step === 1 ? (
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink">Qué vas a importar</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { value: "contactos", label: "Contactos", hint: "Personas. Si traen empresa, se crea o se reusa." },
                  { value: "empresas", label: "Empresas", hint: "Solo organizaciones." },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setEntity(option.value)}
                  aria-pressed={entity === option.value}
                  className={cn(
                    "rounded-md border px-3 py-2.5 text-left transition-colors",
                    entity === option.value
                      ? "border-brand bg-brand-light"
                      : "border-line bg-white hover:border-muted-light",
                  )}
                >
                  <span className="block text-[14px] font-medium text-ink">{option.label}</span>
                  <span className="block text-[12px] text-muted">{option.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.xlsx,.xls"
            className="sr-only"
            onChange={onFile}
          />
          <Button onClick={() => fileRef.current?.click()} loading={busy} size="lg">
            <FileUp aria-hidden />
            Elegir archivo
          </Button>

          <div className="rounded-md border border-line-soft bg-canvas px-4 py-3.5 text-[13px] leading-relaxed text-muted">
            <p className="font-medium text-ink">Cómo preparar el archivo</p>
            <p className="mt-1">
              La primera fila tiene que ser la de encabezados. El sistema reconoce solo nombres como
              NOMBRE, TELEFONO, WHATSAPP, CORREO, EMPRESA, CARGO, CIUDAD, PAÍS, FUENTE, CAMPAÑA,
              PRODUCTO y NOTAS, en español o en inglés. Lo que no reconozca se empareja a mano en el
              paso siguiente.
            </p>
            <p className="mt-2">
              Los telefonos y los correos se normalizan solos, y los países se escriben completos. Hasta
              5.000 filas por archivo.
            </p>
          </div>
        </div>
      ) : null}

      {/* Paso 2 */}
      {step === 2 && parsed ? (
        <div className="space-y-4">
          <p className="text-[13px] text-muted">
            <span className="font-medium text-ink">{filename}</span> · {parsed.totalRows} filas ·{" "}
            {parsed.headers.length} columnas. Revisa que cada columna vaya al campo correcto.
          </p>

          <ul className="divide-y divide-line-soft rounded-md border border-line-soft">
            {parsed.headers.map((header, index) => (
              <li key={`${header}-${index}`} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="clip-1 text-[13px] font-medium text-ink">{header || `Columna ${index + 1}`}</p>
                  <p className="clip-1 text-[12px] text-muted">
                    Ejemplo: {parsed.rows[0]?.[index]?.slice(0, 40) || "(vacio)"}
                  </p>
                </div>
                <label className="relative shrink-0">
                  <span className="sr-only">Campo para la columna {header}</span>
                  <Select
                    value={mapping[index] ?? "ignorar"}
                    onChange={(e) => {
                      const next = [...mapping];
                      next[index] = e.target.value as ImportField;
                      setMapping(next);
                    }}
                    className={cn(
                      "w-auto min-w-[12rem] text-[13px]",
                      mapping[index] === "ignorar" && "text-muted",
                    )}
                  >
                    {IMPORT_FIELDS.map((field) => (
                      <option key={field} value={field}>
                        {FIELD_LABEL[field]}
                      </option>
                    ))}
                  </Select>
                </label>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={reset}>
              Empezar de nuevo
            </Button>
            <Button onClick={goPreview} loading={busy}>
              Ver la vista previa
            </Button>
          </div>
        </div>
      ) : null}

      {/* Paso 3 */}
      {step === 3 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Se van a crear", value: counts.nuevos ?? 0, tone: "verde" as const },
              { label: "Ya existen", value: counts.duplicados ?? 0, tone: "ambar" as const },
              { label: "Con error", value: counts.errores ?? 0, tone: "rojo" as const },
            ].map((card) => (
              <div key={card.label} className="rounded-md border border-line-soft bg-white px-3 py-2.5">
                <p className="eyebrow clip-1">{card.label}</p>
                <p className="tnum mt-1 text-[20px] font-semibold text-ink">{card.value}</p>
              </div>
            ))}
          </div>

          <Checkbox
            label="Completar los datos de los que ya existen"
            hint="Solo se llenan los campos vacios. Nunca se reemplaza un dato que ya tenía valor."
            checked={updateExisting}
            onChange={(e) => setUpdateExisting(e.target.checked)}
          />

          <div className="overflow-hidden rounded-md border border-line-soft">
            <DataTable>
              <Thead>
                <tr>
                  <Th>Fila</Th>
                  <Th>Qué va a pasar</Th>
                  <Th>Nombre</Th>
                  <Th>Correo</Th>
                  <Th>Teléfono</Th>
                  <Th>Empresa</Th>
                </tr>
              </Thead>
              <tbody>
                {preview.slice(0, 50).map((row) => (
                  <Tr key={row.index}>
                    <Td>
                      <span className="tnum text-[13px] text-muted">{row.index + 2}</span>
                    </Td>
                    <Td className="max-w-64">
                      <Badge
                        tone={row.status === "nuevo" ? "verde" : row.status === "duplicado" ? "ambar" : "rojo"}
                        size="sm"
                        dot
                      >
                        {row.status === "nuevo" ? "Nuevo" : row.status === "duplicado" ? "Ya existe" : "Error"}
                      </Badge>
                      <span className="clip-1 mt-0.5 text-[12px] text-muted">{row.detail}</span>
                    </Td>
                    <Td className="max-w-44">
                      <span className="clip-1 text-[13px] text-ink">{row.values.nombre ?? "—"}</span>
                    </Td>
                    <Td className="max-w-48">
                      <span className="clip-1 text-[13px] text-muted">{row.values.correo ?? "—"}</span>
                    </Td>
                    <Td className="max-w-36">
                      <span className="clip-1 text-[13px] text-muted">{row.values.telefono ?? "—"}</span>
                    </Td>
                    <Td className="max-w-44">
                      <span className="clip-1 text-[13px] text-muted">{row.values.empresa ?? "—"}</span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
            {preview.length > 50 ? (
              <p className="border-t border-line-soft px-3 py-2 text-[12px] text-muted">
                Mostrando las primeras 50 de {preview.length} filas.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              Volver a emparejar
            </Button>
            <Button onClick={doImport} loading={busy}>
              <Upload aria-hidden />
              Importar {counts.nuevos ?? 0} registros
            </Button>
          </div>
        </div>
      ) : null}

      {/* Paso 4 */}
      {step === 4 && result ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-md border border-ok/25 bg-ok-soft px-4 py-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
            <p className="text-[13px] text-ink">Importación terminada.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Creados", value: result.imported },
              { label: "Actualizados", value: result.updated },
              { label: "Duplicados", value: result.duplicates },
              { label: "Con error", value: result.errors },
            ].map((card) => (
              <div key={card.label} className="rounded-md border border-line-soft bg-white px-3 py-2.5">
                <p className="eyebrow clip-1">{card.label}</p>
                <p className="tnum mt-1 text-[20px] font-semibold text-ink">{card.value}</p>
              </div>
            ))}
          </div>

          {result.errors > 0 ? (
            <div className="rounded-md border border-danger/25 bg-danger-soft px-4 py-3">
              <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
                <AlertTriangle className="size-4 shrink-0 text-danger" aria-hidden />
                Filas que no se pudieron importar
              </p>
              <ul className="mt-2 space-y-0.5">
                {result.log
                  .filter((entry) => entry.status === "error")
                  .slice(0, 20)
                  .map((entry, index) => (
                    <li key={index} className="break-anywhere text-[12px] text-ink/80">
                      Fila {entry.row}: {entry.detail}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={reset}>
              Importar otro archivo
            </Button>
            <Button asChild>
              <a href={entity === "contactos" ? "/contactos" : "/empresas"}>
                Ver {entity === "contactos" ? "los contactos" : "las empresas"}
              </a>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
