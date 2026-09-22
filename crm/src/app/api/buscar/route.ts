import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { globalSearch } from "@/server/queries/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const hits = await globalSearch(q);
    return NextResponse.json({ hits });
  } catch (err) {
    console.error("[buscar]", err);
    return NextResponse.json({ hits: [], error: "La busqueda fallo" }, { status: 500 });
  }
}
