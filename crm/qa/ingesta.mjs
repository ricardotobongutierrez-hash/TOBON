/**
 * Prueba la puerta del agente de WhatsApp: autenticacion, deduplicacion y,
 * sobre todo, que un mensaje vago no abra un negocio de quince millones.
 */
const BASE = process.env.QA_BASE ?? "http://localhost:3100";
const SECRET = process.env.CRM_INGEST_SECRET ?? "clave-de-prueba-del-agente-1234567890";
const results = [];

function check(name, passed, detail = "") {
  results.push({ name, passed, detail });
  console.log(`${passed ? "  OK  " : "  FALLA"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function enviar(evento, headers = { "x-jit-clave": SECRET }) {
  const res = await fetch(`${BASE}/api/ingesta/whatsapp`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(evento),
  });
  return { status: res.status, body: res.status === 200 ? await res.json() : null };
}

const marca = Date.now().toString().slice(-7);

check("Rechaza sin clave", (await enviar({ telefono: "3001112233" }, {})).status === 401);
check("Rechaza clave incorrecta", (await enviar({ telefono: "3001112233" }, { "x-jit-clave": "mala" })).status === 401);
check("Rechaza sin telefono", (await enviar({ nombre: "Sin numero" })).status === 400);

// Un mensaje vago sobre "bootcamp" es el Abierto, no el In-House corporativo.
const vago = await enviar({
  telefono: `320111${marca.slice(-4)}`,
  idExterno: `qa-vago-${marca}`,
  nombre: "Persona Curiosa",
  mensaje: "Hola, cuanto vale el bootcamp?",
  producto: "bootcamp",
});
check("Acepta el evento vago", vago.status === 200);
check(
  "Un bootcamp a secas no escala como alto valor",
  vago.body?.escalado === false,
  `puntaje ${vago.body?.puntaje}, escalado ${vago.body?.escalado}`,
);

// Un mensaje corporativo explicito si debe abrir el In-House y escalar.
const corporativo = await enviar({
  telefono: `310222${marca.slice(-4)}`,
  idExterno: `qa-corp-${marca}`,
  nombre: "Gerente Corporativo",
  correo: `compras@empresa${marca}.com`,
  empresa: `Empresa Grande ${marca}`,
  cargo: "Director de Compras",
  mensaje: "Queremos un bootcamp in-house de dos dias para el equipo.",
  producto: "bootcamp in-house de dos dias",
  urgencia: "alta",
});
check("Acepta el evento corporativo", corporativo.status === 200);
check("Abre negocio y empresa", Boolean(corporativo.body?.opportunityId && corporativo.body?.companyId));
check(
  "El lead corporativo se escala",
  corporativo.body?.escalado === true,
  `puntaje ${corporativo.body?.puntaje}`,
);

// La reentrega del mismo mensaje no duplica.
const repetido = await enviar({
  telefono: `310222${marca.slice(-4)}`,
  idExterno: `qa-corp-${marca}`,
  mensaje: "Queremos un bootcamp in-house de dos dias para el equipo.",
});
check("No duplica una reentrega", repetido.body?.duplicadoIgnorado === true && repetido.body?.contactCreado === false);

// Firma HMAC.
const cuerpo = JSON.stringify({ telefono: `315333${marca.slice(-4)}`, nombre: "Firma Valida" });
const { createHmac } = await import("node:crypto");
const firma = createHmac("sha256", SECRET).update(cuerpo).digest("hex");
const conFirma = await fetch(`${BASE}/api/ingesta/whatsapp`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-jit-firma": firma },
  body: cuerpo,
});
check("Acepta firma HMAC valida", conFirma.status === 200);
const firmaMala = await fetch(`${BASE}/api/ingesta/whatsapp`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-jit-firma": "0".repeat(64) },
  body: cuerpo,
});
check("Rechaza firma HMAC invalida", firmaMala.status === 401);

const fallos = results.filter((r) => !r.passed);
console.log(`\n=== ${results.length - fallos.length}/${results.length} correctos ===`);
process.exit(fallos.length > 0 ? 1 : 0);
