import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Proxy de Next (antes "middleware"). Corta el paso antes de renderizar: sin cookie de sesion valida se va a
 * /ingresar. Aqui solo se verifica la firma, no se consulta la base de datos,
 * porque el middleware corre en el borde. La comprobacion real (usuario activo,
 * no borrado) la sigue haciendo currentUser() del lado del servidor.
 */
const COOKIE = "jit_sesion";

const PUBLIC = ["/ingresar", "/primer-ingreso"];

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  return new TextEncoder().encode(
    value && value.length >= 24 ? value : "jit-crm-desarrollo-secreto-local-no-produccion",
  );
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE)?.value;

  let valid = false;
  if (token) {
    try {
      await jwtVerify(token, secret());
      valid = true;
    } catch {
      valid = false;
    }
  }

  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!valid && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    url.search = "";
    const response = NextResponse.redirect(url);
    // Cookie invalida o expirada: se limpia para no reintentar con basura.
    if (token) response.cookies.delete(COOKIE);
    return response;
  }

  if (valid && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Se excluyen los archivos estaticos y la descarga de adjuntos, que valida sola.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|marca/|api/).*)"],
};
