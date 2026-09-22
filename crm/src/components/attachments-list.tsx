"use client";

import { useRef, useState } from "react";
import { Download, FileText, ImageIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { deleteAttachment, uploadAttachment } from "@/server/actions/files";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { Empty } from "@/components/ui/empty";
import { useRun } from "@/lib/use-submit";
import { formatDate } from "@/lib/dates";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export type AttachmentRow = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  label: string | null;
  createdAt: Date;
};

export function AttachmentsList({
  entityType,
  entityId,
  files,
}: {
  entityType: string;
  entityId: string;
  files: AttachmentRow[];
}) {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [toDelete, setToDelete] = useState<AttachmentRow | null>(null);
  const { run } = useRun();

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const result = await uploadAttachment(entityType, entityId, fd);
      if (result.ok) {
        toast.success(`${result.data.filename} quedo adjunto`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div>
      <input ref={ref} type="file" className="sr-only" onChange={onPick} />
      {files.length === 0 ? (
        <Empty
          icon={Paperclip}
          title="No hay documentos"
          message="Sube la propuesta, la orden de compra o el comprobante de pago."
          action={
            <Button variant="outline" size="sm" onClick={() => ref.current?.click()} loading={uploading}>
              <Upload aria-hidden />
              Subir archivo
            </Button>
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-line-soft">
            {files.map((file) => {
              const Icon = file.mimeType.startsWith("image/") ? ImageIcon : FileText;
              return (
                <li key={file.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <a
                      href={`/api/archivos/${file.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="clip-1 text-[14px] font-medium text-ink hover:text-brand"
                    >
                      {file.filename}
                    </a>
                    <p className="tnum text-[12px] text-muted">
                      {Math.max(1, Math.round(file.size / 1024))} KB · {formatDate(file.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="quiet" size="icon" asChild>
                      <a href={`/api/archivos/${file.id}?descargar=1`} title={`Descargar ${file.filename}`}>
                        <Download aria-hidden />
                        <span className="sr-only">Descargar</span>
                      </a>
                    </Button>
                    <Button
                      variant="quiet"
                      size="icon"
                      onClick={() => setToDelete(file)}
                      title={`Eliminar ${file.filename}`}
                    >
                      <Trash2 aria-hidden />
                      <span className="sr-only">Eliminar</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-line-soft px-4 py-3 sm:px-5">
            <Button variant="outline" size="sm" onClick={() => ref.current?.click()} loading={uploading}>
              <Upload aria-hidden />
              Subir otro archivo
            </Button>
          </div>
        </>
      )}

      <Confirm
        open={toDelete !== null}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Eliminar este archivo"
        description={`Se va a eliminar ${toDelete?.filename ?? ""}. Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        onConfirm={async () => {
          if (toDelete) await run(() => deleteAttachment(toDelete.id), "Archivo eliminado");
        }}
      />
    </div>
  );
}
