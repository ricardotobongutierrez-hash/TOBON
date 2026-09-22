import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { attachments } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { getObject } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Los documentos no se sirven desde una URL publica. Pasan por aqui, que exige
 * sesion antes de devolver el contenido.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const db = await getDb();
  const [file] = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, id), isNull(attachments.deletedAt)))
    .limit(1);

  if (!file) return NextResponse.json({ error: "El archivo no existe" }, { status: 404 });

  try {
    const data = await getObject(file.storageKey);
    // Los PDF e imagenes se pueden ver en el navegador; lo demas se descarga.
    const inlineOk = file.mimeType === "application/pdf" || file.mimeType.startsWith("image/");
    const forceDownload = new URL(request.url).searchParams.get("descargar") === "1";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(data.length),
        "Content-Disposition": `${inlineOk && !forceDownload ? "inline" : "attachment"}; filename="${encodeURIComponent(file.filename)}"`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[archivos]", err);
    return NextResponse.json({ error: "No se pudo leer el archivo" }, { status: 500 });
  }
}
