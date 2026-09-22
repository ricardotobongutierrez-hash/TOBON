"use client";

import { useRef, useState } from "react";
import { FileUp, Paperclip, X } from "lucide-react";
import { Field } from "./field";
import { Button } from "./button";

/** Selector de archivo con el nombre visible y forma de quitarlo. */
export function FileInput({
  label,
  name,
  hint,
  required,
  accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.csv,.txt",
}: {
  label: string;
  name: string;
  hint?: string;
  required?: boolean;
  accept?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  return (
    <Field label={label} hint={hint} required={required}>
      <input
        ref={ref}
        type="file"
        name={name}
        accept={accept}
        required={required}
        className="sr-only"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-center gap-2 rounded-md border border-line bg-canvas px-3 py-2">
          <Paperclip className="size-4 shrink-0 text-muted" aria-hidden />
          <span className="clip-1 min-w-0 flex-1 text-[13px] text-ink">{file.name}</span>
          <span className="tnum shrink-0 text-[12px] text-muted">{Math.round(file.size / 1024)} KB</span>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              if (ref.current) ref.current.value = "";
            }}
            className="shrink-0 rounded-sm p-1 text-muted hover:bg-off-soft hover:text-danger"
            aria-label="Quitar archivo"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => ref.current?.click()} block className="justify-start">
          <FileUp aria-hidden />
          Elegir archivo
        </Button>
      )}
    </Field>
  );
}
