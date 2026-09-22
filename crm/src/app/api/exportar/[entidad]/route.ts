import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listCompanies, listContacts, listOpportunities } from "@/server/queries/lists";
import { formatDateInput } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Exporta la lista tal como esta filtrada en pantalla, en CSV con punto y coma.
 * Excel en espanol abre el punto y coma sin pedir nada; con coma parte mal las
 * cifras que llevan separador decimal.
 */
function csv(rows: Record<string, unknown>[], headers: [string, string][]): string {
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const text = value instanceof Date ? formatDateInput(value) : String(value);
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [headers.map(([, label]) => escape(label)).join(";")];
  for (const row of rows) {
    lines.push(headers.map(([key]) => escape(row[key])).join(";"));
  }
  // El BOM le dice a Excel que el archivo esta en UTF-8.
  return `﻿${lines.join("\r\n")}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ entidad: string }> },
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { entidad } = await params;
  const sp = new URL(request.url).searchParams;

  let body: string;
  let filename: string;

  if (entidad === "contactos") {
    const { rows } = await listContacts({
      q: sp.get("q") ?? undefined,
      segment: sp.get("tipo") ?? undefined,
      status: sp.get("estado") ?? undefined,
      responsibleId: sp.get("responsable") ?? undefined,
      sourceId: sp.get("fuente") ?? undefined,
      campaignId: sp.get("campana") ?? undefined,
      perPage: 5000,
      page: 1,
    });
    body = csv(rows, [
      ["fullName", "Nombre"],
      ["email", "Correo"],
      ["phone", "Teléfono"],
      ["companyName", "Empresa"],
      ["position", "Cargo"],
      ["city", "Ciudad"],
      ["country", "País"],
      ["segment", "Tipo"],
      ["status", "Estado"],
      ["leadScore", "Puntaje"],
      ["sourceName", "De dónde salió"],
      ["campaignName", "Campaña"],
      ["productName", "Interesado en"],
      ["responsibleName", "Responsable"],
      ["nextAction", "Próxima acción"],
      ["nextActionDate", "Fecha de la próxima acción"],
      ["lastInteractionAt", "Última interacción"],
      ["createdAt", "Creado"],
    ]);
    filename = `contactos-${formatDateInput(new Date())}.csv`;
  } else if (entidad === "empresas") {
    const { rows } = await listCompanies({
      q: sp.get("q") ?? undefined,
      industry: sp.get("sector") ?? undefined,
      country: sp.get("pais") ?? undefined,
      responsibleId: sp.get("responsable") ?? undefined,
      perPage: 5000,
      page: 1,
    });
    body = csv(rows, [
      ["name", "Empresa"],
      ["website", "Sitio web"],
      ["industry", "Sector"],
      ["city", "Ciudad"],
      ["country", "País"],
      ["size", "Tamaño"],
      ["purchasingCapacity", "Capacidad de compra"],
      ["contactCount", "Contactos"],
      ["openDeals", "Negocios abiertos"],
      ["openValue", "Valor abierto"],
      ["responsibleName", "Responsable"],
      ["createdAt", "Creada"],
    ]);
    filename = `empresas-${formatDateInput(new Date())}.csv`;
  } else if (entidad === "negocios") {
    const rows = await listOpportunities({
      q: sp.get("q") ?? undefined,
      stage: sp.get("etapa") ?? undefined,
      responsibleId: sp.get("responsable") ?? undefined,
      segment: sp.get("tipo") ?? undefined,
    });
    body = csv(rows, [
      ["name", "Negocio"],
      ["companyName", "Empresa"],
      ["contactName", "Contacto"],
      ["productName", "Producto"],
      ["amount", "Valor"],
      ["currency", "Moneda"],
      ["stage", "Etapa"],
      ["probability", "Probabilidad"],
      ["expectedCloseOn", "Cierre estimado"],
      ["proposalStatus", "Propuesta"],
      ["billingStatus", "Facturación"],
      ["paymentStatus", "Pago"],
      ["deliveryStatus", "Entrega"],
      ["responsibleName", "Responsable"],
      ["sourceName", "De dónde salió"],
      ["campaignName", "Campaña"],
      ["nextAction", "Próxima acción"],
      ["nextActionDate", "Fecha de la próxima acción"],
      ["lostReason", "Motivo de pérdida"],
    ]);
    filename = `negocios-${formatDateInput(new Date())}.csv`;
  } else {
    return NextResponse.json({ error: "Esa exportación no existe" }, { status: 404 });
  }

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
