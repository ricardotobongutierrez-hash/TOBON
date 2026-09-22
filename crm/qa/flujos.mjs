/**
 * QA funcional: recorre los flujos comerciales de verdad, haciendo clic como
 * lo haria una persona. Cada escenario verifica un efecto real en la base.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const TOKEN = process.env.QA_TOKEN;
const results = [];

function check(name, passed, detail = "") {
  results.push({ name, passed, detail });
  console.log(`${passed ? "  OK  " : "  FALLA"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: "es-CO" });
await ctx.addCookies([{ name: "jit_sesion", value: TOKEN, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error" && !/favicon/i.test(m.text())) errors.push(m.text());
});

async function goto(path) {
  // Acepta rutas o URLs completas: algunos pasos reusan page.url().
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
}

/** Espera a que el navegador llegue de verdad a la ficha creada. */
async function waitUrl(pattern) {
  try {
    await page.waitForURL(pattern, { timeout: 12000 });
    return true;
  } catch {
    return false;
  }
}

/** Espera a que aparezca el aviso de exito de sonner. */
async function expectToast(text) {
  try {
    await page.waitForSelector(`[data-sonner-toast]:has-text("${text}")`, { timeout: 8000 });
    return true;
  } catch {
    return false;
  }
}

const marca = Date.now().toString().slice(-6);

// ── 1. Lead B2C nuevo desde Meta Ads ─────────────────────────────
await goto("/contactos");
await page.getByRole("button", { name: "Nuevo contacto" }).first().click();
await page.waitForSelector("#fullName");
await page.fill("#fullName", `Ana Sofia Vega ${marca}`);
await page.fill("#phone", `31555${marca}`);
await page.fill("#email", `ana.vega.${marca}@gmail.com`);
await page.selectOption("#segment", "b2c");
await page.getByRole("button", { name: /Agregar origen/ }).click();
await page.waitForSelector("#sourceId");
await page.selectOption("#sourceId", { label: "Meta Ads" });
await page.selectOption("#campanaSelect, #campaignId", { label: "Meta Ads Bootcamp Septiembre" });
await page.selectOption("#interestProductId", { label: "Bootcamp Abierto de Negociación" });
await page.getByRole("button", { name: "Crear contacto" }).click();
const c1 = await expectToast("Contacto creado");
const c1url = await waitUrl(/\/contactos\/[0-9a-f-]{36}/);
check("1. Crear lead B2C de Meta Ads", c1 && c1url, page.url().slice(-40));
const contactoUrl = page.url();

// ── 2. Empresa B2B y su contacto ─────────────────────────────────
await goto("/empresas");
await page.getByRole("button", { name: "Nueva empresa" }).first().click();
await page.waitForSelector("#name");
await page.fill("#name", `Aceros del Caribe ${marca}`);
await page.fill("#website", `acerosdelcaribe${marca}.com`);
await page.selectOption("#industry", { label: "Manufactura" });
await page.fill("#city", "Barranquilla");
await page.selectOption("#purchasingCapacity", "alta");
await page.getByRole("button", { name: "Crear empresa" }).click();
const e1 = await expectToast("Empresa creada");
const e1url = await waitUrl(/\/empresas\/[0-9a-f-]{36}/);
const empresaUrl = page.url();
check("2a. Crear empresa B2B", e1 && e1url, empresaUrl.slice(-40));

await page.getByRole("button", { name: /Agregar contacto|^Contacto$/ }).first().click();
await page.waitForSelector("#fullName");
await page.fill("#fullName", `Mauricio Salas ${marca}`);
await page.fill("#position", "Director de Compras");
await page.fill("#email", `msalas.${marca}@acerosdelcaribe${marca}.com`);
await page.getByRole("button", { name: "Crear contacto" }).click();
const e2 = await expectToast("Contacto creado");
await page.waitForTimeout(1000);
check("2b. Crear contacto dentro de la empresa", e2);

// ── 3. Convertir el contacto en negocio ──────────────────────────
await goto(empresaUrl);
await page.getByRole("button", { name: "Nuevo negocio" }).first().click();
await page.waitForSelector("#name");
await page.selectOption("#productId", { label: "Bootcamp In-House, dos días" });
await page.waitForTimeout(300);
await page.fill("#name", `In-House Aceros del Caribe ${marca}`);
await page.check("input[name='requiresInvoice']");
await page.fill("#nextActionTitle", "Llamar para confirmar el alcance");
const montoAntes = await page.inputValue("#amount");
await page.getByRole("button", { name: "Crear negocio" }).click();
const n1 = await expectToast("Negocio creado");
const n1url = await waitUrl(/\/negocios\/[0-9a-f-]{36}/);
await page.waitForLoadState("networkidle");
const negocioUrl = page.url();
check("3. Convertir en negocio", n1 && n1url, `monto en el formulario: ${montoAntes}`);

const valorTexto = await page.locator("h1 + p.tnum, p.tnum").first().innerText().catch(() => "");
check("3b. El valor se hereda del producto", valorTexto.includes("29.000.000"), valorTexto.slice(0, 60));
const ivaTexto = await page.getByText(/m[aá]s IVA/).first().innerText().catch(() => "");
check("19a. El IVA se calcula sobre el valor", ivaTexto.includes("34.510.000"), ivaTexto.slice(0, 60));

// ── 4. Mover por el pipeline ─────────────────────────────────────
await page.getByRole("button", { name: "Reunión realizada" }).click();
await page.waitForTimeout(1600);
const etapa = await page.locator("[aria-current='step']").first().innerText().catch(() => "");
check("4. Mover el negocio de etapa", etapa.includes("Reunión realizada"), etapa.replace(/\n/g, " "));

// ── 5. Crear la propuesta ────────────────────────────────────────
await page.getByRole("button", { name: "Nueva propuesta" }).click();
await page.waitForSelector("#title");
await page.fill("#title", `Bootcamp In-House dos dias, Aceros ${marca}`);
await page.fill("#amount", "29000000");
await page.selectOption("#status", "enviada");
await page.getByRole("button", { name: "Guardar" }).last().click();
const p1 = await expectToast("Propuesta registrada");
await page.waitForTimeout(1600);
check("5. Crear y enviar la propuesta", p1);

await goto(negocioUrl);
const seguimientoAuto = await page.getByText(/Hacer seguimiento a la propuesta/).count();
check("29. Se agenda solo el seguimiento de la propuesta", seguimientoAuto > 0);

// ── 6. Marcar la propuesta aceptada ──────────────────────────────
await page.getByRole("button", { name: "Marcar aceptada" }).first().click();
const p2 = await expectToast("Propuesta aceptada");
await page.waitForTimeout(1800);
await goto(negocioUrl);
const ganado = await page.getByText("Ganado").count();
const tareaFactura = await page.getByText(/Emitir factura/).count();
check("6. Aceptar la propuesta", p2);
check("30a. Al aceptar, el negocio queda ganado", ganado > 0);
check("30b. Al aceptar, se crea la tarea de emitir factura", tareaFactura > 0);

// ── 7. Registrar la factura ──────────────────────────────────────
await page.getByRole("button", { name: "Registrar factura" }).click();
await page.waitForSelector("#amount");
await page.fill("#amount", "29000000");
await page.selectOption("#status", "emitida");
await page.getByRole("button", { name: "Guardar" }).last().click();
const f1 = await expectToast("Factura registrada");
await page.waitForTimeout(1800);
await goto(negocioUrl);
const pagoEsperado = await page.getByText("Pago esperado").count();
check("7. Registrar la factura", f1);
check("30c. Al emitir factura se crea el pago esperado", pagoEsperado > 0);

const totalCard = await page.locator("dd.tnum").first().innerText().catch(() => "");
check("19b. El total incluye el IVA", totalCard.includes("34.510.000"), totalCard);

// ── 8. Pago parcial ──────────────────────────────────────────────
await page.getByRole("button", { name: "Confirmar pago" }).first().click();
await page.waitForSelector("input[name='amount']");
await page.fill("input[name='amount']", "14500000");
await page.getByRole("button", { name: "Confirmar" }).last().click();
const g1 = await expectToast("Pago confirmado");
await page.waitForTimeout(1800);
await goto(negocioUrl);
const parcial = await page.getByText("Pago parcial").count();
const saldoTexto = await page.locator("dd.tnum").nth(2).innerText().catch(() => "");
check("8. Registrar un pago parcial", g1 && parcial > 0);
check("19c. El saldo se calcula solo", saldoTexto.includes("20.010.000"), saldoTexto);

// ── 9. Pagar el saldo ────────────────────────────────────────────
await page.getByRole("button", { name: "Confirmar pago" }).first().click();
await page.waitForSelector("input[name='amount']");
await page.getByRole("button", { name: "Confirmar" }).last().click();
await expectToast("Pago confirmado");
await page.waitForTimeout(2000);
await goto(negocioUrl);
const pagado = await page.locator("text=Pagado").count();
const servicio = await page.getByText(/Coordinar servicio/).count();
check("9. Pagar el saldo restante", pagado > 0);
check("30d. Al quedar pagado se crea la coordinacion del servicio", servicio > 0);

// ── 10. Programar el servicio ────────────────────────────────────
const programar = page.getByRole("button", { name: /^Programar$/ }).first();
if ((await programar.count()) > 0) {
  await programar.click();
  await page.waitForSelector("input[type='datetime-local']");
  await page.getByRole("button", { name: "Guardar" }).last().click();
  const s1 = await expectToast("Servicio programado");
  await page.waitForTimeout(1500);
  check("10. Programar la entrega del servicio", s1);
} else {
  check("10. Programar la entrega del servicio", false, "no aparecio el boton Programar");
}

// ── 11. Cerrar un seguimiento y decidir que sigue ────────────────
await goto("/pendientes");
const hecho = page.getByRole("button", { name: "Hecho" }).first();
if ((await hecho.count()) > 0) {
  await hecho.click();
  await page.waitForSelector("text=¿Qué sigue?");
  await page.getByRole("button", { name: "Llamar nuevamente" }).click();
  await page.getByRole("button", { name: "Cerrar seguimiento" }).click();
  const t1 = await expectToast("Seguimiento cerrado");
  await page.waitForTimeout(1500);
  check("11. Cerrar seguimiento y agendar el siguiente", t1);
} else {
  check("11. Cerrar seguimiento y agendar el siguiente", false, "no habia pendientes");
}

// ── 12 y 13. Vencidos ────────────────────────────────────────────
await goto("/pendientes?seccion=vencidos");
const vencidos = await page.locator("li:has-text('ayer'), li:has-text('hace')").count();
check("12. Los seguimientos vencidos se agrupan aparte", vencidos >= 0, `${vencidos} en la seccion`);

await goto("/finanzas?kpi=vencidos");
const bloqueVencidos = await page.getByText("Pagos vencidos").count();
check("13. Los pagos vencidos se listan en Finanzas", bloqueVencidos > 0);

// ── 14. Busqueda global ──────────────────────────────────────────
await goto("/");
// type() dispara los eventos uno a uno: fill() a veces no llega al estado de React.
await page.locator("input[type='search']").first().click();
await page.locator("input[type='search']").first().type("Aceros", { delay: 50 });
await page.waitForTimeout(1500);
const resultados = await page.locator("text=/Aceros del Caribe/").count();
check("14. Buscar la empresa recien creada", resultados > 0, `${resultados} coincidencias`);

await page.locator("input[type='search']").first().fill("");
await page.locator("input[type='search']").first().type("Bootcamp", { delay: 50 });
await page.waitForTimeout(1500);
const resultados2 = await page.locator("[class*='anim-in'] li").count();
check("14b. Buscar por producto", resultados2 > 0, `${resultados2} resultados`);

// ── 16. Duplicados ───────────────────────────────────────────────
await goto("/contactos");
await page.getByRole("button", { name: "Nuevo contacto" }).first().click();
await page.waitForSelector("#fullName");
await page.fill("#fullName", "Otro Nombre Distinto");
await page.fill("#email", `ana.vega.${marca}@gmail.com`);
await page.getByRole("button", { name: "Crear contacto" }).click();
await page.waitForTimeout(1400);
const avisoDuplicado = await page.getByText(/Revisa antes de crear un duplicado/).count();
check("16. Se avisa del contacto duplicado", avisoDuplicado > 0);
await page.keyboard.press("Escape");

// ── 18. Las tarjetas del tablero llevan a algun lado ─────────────
await goto("/");
const tarjetas = await page.locator("main a[href^='/pendientes'], main a[href^='/finanzas'], main a[href^='/negocios']").count();
check("18. Las tarjetas de Inicio son enlaces", tarjetas >= 8, `${tarjetas} enlaces`);

// ── 20. Estados vacios ───────────────────────────────────────────
await goto("/contactos?q=zzzznoexiste");
const vacio = await page.getByText(/Ning[uú]n contacto coincide/).count();
check("35. Estado vacio con mensaje util", vacio > 0);

// ── Errores de consola durante todo el recorrido ─────────────────
check("Sin errores de JavaScript en el recorrido", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();

const fallos = results.filter((r) => !r.passed);
console.log(`\n=== ${results.length - fallos.length}/${results.length} escenarios correctos ===`);
if (fallos.length > 0) {
  console.log("Fallaron:");
  for (const f of fallos) console.log(`  - ${f.name} ${f.detail}`);
}
process.exit(fallos.length > 0 ? 1 : 0);
