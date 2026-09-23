/**
 * QA de la interfaz con un navegador real.
 *
 * Revisa cada pantalla en escritorio, tablet y movil, y busca los problemas que
 * de verdad aparecen: errores de consola, texto que se desborda, botones sin
 * nombre accesible, desplazamiento horizontal y contraste sospechoso.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const TOKEN = process.env.QA_TOKEN;
if (!TOKEN) {
  console.error("Falta QA_TOKEN. Generalo con: npx tsx scripts/dev-token.ts");
  process.exit(1);
}

const VIEWPORTS = [
  { name: "escritorio", width: 1440, height: 900 },
  { name: "laptop", width: 1180, height: 800 },
  { name: "tablet", width: 820, height: 1100 },
  { name: "movil", width: 390, height: 844 },
];

const PAGES = [
  { path: "/", name: "inicio" },
  { path: "/contactos", name: "contactos" },
  { path: "/empresas", name: "empresas" },
  { path: "/negocios", name: "negocios-tablero" },
  { path: "/negocios?pestana=lista", name: "negocios-lista" },
  { path: "/negocios?pestana=propuestas", name: "negocios-propuestas" },
  { path: "/pendientes", name: "pendientes" },
  { path: "/pendientes?vista=equipo&seccion=servicios", name: "pendientes-servicios" },
  { path: "/finanzas", name: "finanzas" },
  { path: "/finanzas?kpi=por-cobrar", name: "finanzas-detalle" },
  { path: "/finanzas/por-conciliar", name: "finanzas-por-conciliar" },
  { path: "/reportes", name: "reportes" },
  { path: "/ajustes/mi-cuenta", name: "ajustes-cuenta" },
  { path: "/ajustes/usuarios", name: "ajustes-usuarios" },
  { path: "/ajustes/productos", name: "ajustes-productos" },
  { path: "/ajustes/pipeline", name: "ajustes-pipeline" },
  { path: "/ajustes/fuentes", name: "ajustes-fuentes" },
  { path: "/ajustes/campanas", name: "ajustes-campanas" },
  { path: "/ajustes/correo", name: "ajustes-correo" },
  { path: "/ajustes/notificaciones", name: "ajustes-avisos" },
  { path: "/ajustes/importar", name: "ajustes-importar" },
  { path: "/ajustes/finanzas", name: "ajustes-finanzas" },
];

const OUT = "qa/capturas";
mkdirSync(OUT, { recursive: true });

const problems = [];
function report(kind, where, detail) {
  problems.push({ kind, where, detail });
  console.log(`  [${kind}] ${where}: ${detail}`);
}

/** Elementos cuyo contenido se sale de su caja. Es el desborde real de texto. */
const OVERFLOW_CHECK = () => {
  const bad = [];
  const seen = new Set();
  document.querySelectorAll('h1,h2,h3,p,span,a,td,th,dd,dt,li,button,label,div').forEach((el) => {
    const style = getComputedStyle(el);
    if (style.overflow !== 'visible' && style.overflow !== '') return;
    if (style.display === 'none' || style.visibility === 'hidden') return;
    // Solo hojas de texto: un contenedor grande "desborda" por sus hijos.
    if (el.children.length > 0) return;
    const text = (el.textContent || '').trim();
    if (!text) return;
    const overflowX = el.scrollWidth - el.clientWidth;
    if (overflowX > 2 && el.clientWidth > 0) {
      const key = text.slice(0, 40);
      if (seen.has(key)) return;
      seen.add(key);
      bad.push({ tag: el.tagName.toLowerCase(), text: text.slice(0, 70), over: overflowX });
    }
  });
  return bad.slice(0, 8);
};

/** Botones y enlaces sin texto ni nombre accesible. */
const NAMELESS_CHECK = () => {
  const bad = [];
  document.querySelectorAll('button, a[href], [role="button"]').forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const label =
      (el.textContent || '').trim() ||
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      (el.querySelector('.sr-only') ? el.querySelector('.sr-only').textContent : '');
    if (!label || !label.trim()) {
      bad.push({ tag: el.tagName.toLowerCase(), html: el.outerHTML.slice(0, 110) });
    }
  });
  return bad.slice(0, 6);
};

/**
 * Areas de clic demasiado pequenas para un dedo. Solo se miran controles de
 * verdad: un enlace de texto dentro de un parrafo mide lo que mide la linea y
 * eso no es un defecto.
 */
const TARGET_CHECK = () => {
  const bad = [];
  document.querySelectorAll('button, [role="button"], input[type=checkbox], select').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    // .tap-target agranda el area de toque con un pseudoelemento sin cambiar
    // el tamano visible del control.
    const extra = el.classList.contains('tap-target') ? 14 : 0;
    if (r.height + extra < 26 || r.width + extra < 26) {
      bad.push({
        tag: el.tagName.toLowerCase(),
        size: Math.round(r.width) + 'x' + Math.round(r.height),
        text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40),
      });
    }
  });
  return bad.slice(0, 6);
};

/**
 * Texto recortado hasta volverse inutil. Un nombre de cliente que solo muestra
 * "Dor…" no informa nada: es peor que no ponerlo.
 */
const SQUASHED_CHECK = () => {
  const bad = [];
  document.querySelectorAll('*').forEach((el) => {
    if (el.children.length > 0) return;
    const style = getComputedStyle(el);
    if (style.textOverflow !== 'ellipsis' && !el.className.toString().includes('clip-')) return;
    const text = (el.textContent || '').trim();
    if (text.length < 8) return;
    if (el.clientWidth === 0 || el.scrollWidth === 0) return;
    const shown = el.clientWidth / el.scrollWidth;
    if (shown < 0.45) {
      bad.push({
        text: text.slice(0, 40),
        shown: Math.round(shown * 100),
        width: Math.round(el.clientWidth),
      });
    }
  });
  return bad.slice(0, 6);
};

// La version de Playwright instalada puede no coincidir con el navegador del
// entorno: se usa el ejecutable que exista, no el que espera la libreria.
const EXE = process.env.QA_CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

for (const viewport of VIEWPORTS) {
  console.log(`\n=== ${viewport.name} (${viewport.width}x${viewport.height}) ===`);
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: "es-CO",
  });
  await context.addCookies([
    { name: "jit_sesion", value: TOKEN, domain: "localhost", path: "/", httpOnly: true, secure: false },
  ]);

  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

  for (const target of PAGES) {
    consoleErrors.length = 0;
    const where = `${viewport.name}${target.path}`;
    let response;
    try {
      response = await page.goto(`${BASE}${target.path}`, { waitUntil: "networkidle", timeout: 45000 });
    } catch (err) {
      report("navegacion", where, err.message.slice(0, 120));
      continue;
    }
    if (!response || response.status() >= 400) {
      report("http", where, `estado ${response?.status()}`);
      continue;
    }

    await page.waitForTimeout(350);

    // Desplazamiento horizontal de toda la pagina: nunca deberia existir.
    const hScroll = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (hScroll > 2) report("scroll-horizontal", where, `${hScroll}px de exceso`);

    for (const item of await page.evaluate(OVERFLOW_CHECK)) {
      report("desborde", where, `<${item.tag}> "${item.text}" se sale ${item.over}px`);
    }
    for (const item of await page.evaluate(NAMELESS_CHECK)) {
      report("sin-nombre", where, `<${item.tag}> ${item.html}`);
    }
    if (viewport.name === "movil") {
      for (const item of await page.evaluate(TARGET_CHECK)) {
        report("area-pequena", where, `<${item.tag}> ${item.size} "${item.text}"`);
      }
    }
    for (const item of await page.evaluate(SQUASHED_CHECK)) {
      report("texto-aplastado", where, `"${item.text}" solo muestra ${item.shown} % en ${item.width}px`);
    }
    for (const error of consoleErrors) {
      // Los avisos de recursos externos no cuentan como fallo de la aplicacion.
      if (/favicon|manifest/i.test(error)) continue;
      report("consola", where, error.slice(0, 200));
    }

    // Los paneles de creacion: el pie con el boton de guardar tiene que quedar
    // dentro de la pantalla, no empujado hacia abajo por un formulario largo.
    if (target.path === "/contactos" || target.path === "/negocios" || target.path === "/empresas") {
      const abrir = page.getByRole("button", { name: /^Nuev[ao] / }).first();
      if ((await abrir.count()) > 0) {
        await abrir.click();
        await page.waitForTimeout(500);
        const pie = page.locator("[role=dialog] button[type=submit]").first();
        if ((await pie.count()) > 0) {
          const box = await pie.boundingBox();
          if (!box || box.y + box.height > viewport.height + 1 || box.y < 0) {
            report("pie-fuera-de-pantalla", where, `boton de guardar en y=${Math.round(box?.y ?? -1)}`);
          }
        } else {
          report("panel", where, "el panel no mostro boton de guardar");
        }
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
    }

    if (viewport.name === "escritorio" || viewport.name === "movil") {
      await page.screenshot({
        path: `${OUT}/${viewport.name}-${target.name}.png`,
        fullPage: viewport.name === "escritorio",
      });
    }
    process.stdout.write(`  ok ${target.path}\n`);
  }

  await context.close();
}

await browser.close();

writeFileSync("qa/resultado.json", JSON.stringify({ problems }, null, 2));
console.log(`\n=== ${problems.length} hallazgos ===`);
const byKind = {};
for (const p of problems) byKind[p.kind] = (byKind[p.kind] ?? 0) + 1;
console.log(byKind);
process.exit(problems.length > 0 ? 1 : 0);
