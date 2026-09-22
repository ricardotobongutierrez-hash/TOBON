/** Encuentra que elemento exactamente provoca el desplazamiento horizontal. */
import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const TOKEN = process.env.QA_TOKEN;
const TARGETS = (process.env.QA_PATHS ?? "/ajustes/mi-cuenta,/negocios,/pendientes").split(",");
const WIDTH = Number(process.env.QA_WIDTH ?? 390);

const browser = await chromium.launch({
  executablePath: process.env.QA_CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
const context = await browser.newContext({ viewport: { width: WIDTH, height: 844 }, locale: "es-CO" });
await context.addCookies([
  { name: "jit_sesion", value: TOKEN, domain: "localhost", path: "/", httpOnly: true, secure: false },
]);
const page = await context.newPage();

for (const path of TARGETS) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const result = await page.evaluate((viewportWidth) => {
    const offenders = [];
    document.querySelectorAll("*").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      // Elementos cuyo borde derecho pasa del ancho de la ventana.
      // Si algun ancestro recorta en horizontal, el desborde es interno y
      // legitimo (un tablero o una fila desplazable), no un defecto de la pagina.
      let clipped = false;
      let anc = el.parentElement;
      while (anc) {
        const ov = getComputedStyle(anc).overflowX;
        if (ov === "auto" || ov === "scroll" || ov === "hidden") {
          clipped = true;
          break;
        }
        anc = anc.parentElement;
      }
      if (!clipped && r.right > viewportWidth + 2) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || "").toString().slice(0, 120),
          right: Math.round(r.right),
          width: Math.round(r.width),
          depth: (() => {
            let d = 0;
            let n = el;
            while (n.parentElement) {
              d += 1;
              n = n.parentElement;
            }
            return d;
          })(),
        });
      }
    });
    // Se ordena por profundidad: el mas superficial es la causa.
    offenders.sort((a, b) => a.depth - b.depth || b.right - a.right);
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      offenders: offenders.slice(0, 10),
    };
  }, WIDTH);

  console.log(`\n### ${path}  (scroll ${result.scrollWidth} vs ${result.clientWidth})`);
  for (const o of result.offenders) {
    console.log(`  d${o.depth} <${o.tag}> w=${o.width} right=${o.right}  ${o.cls}`);
  }
}

await browser.close();
