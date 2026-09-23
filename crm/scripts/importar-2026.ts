/**
 * Importa los datos comerciales de 2026: cohortes de bootcamps abiertos y del
 * Diplomado Online, sus participantes y el pipeline abierto.
 *
 *   npx tsx scripts/importar-2026.ts --dir <carpeta con los CSV> --dry-run
 *   npx tsx scripts/importar-2026.ts --dir <carpeta con los CSV>
 *
 * Reglas, en corto (el detalle vive junto a cada funcion):
 *
 *  - Idempotente. Cada negocio lleva una llave externa (cohorte + email, o
 *    cohorte + hoja + fila); correrlo dos veces no crea nada nuevo.
 *  - No borra ni sobrescribe. Si una empresa o un contacto ya existe, se reusa
 *    tal cual y se reporta.
 *  - Nunca fusiona personas solo por el nombre: esos casos salen en la lista de
 *    revision manual, que tambien se escribe en <dir>/revision-manual.csv.
 *  - No guarda cedulas ni cuentas: texto_original no se lee, y en los textos
 *    libres se borra todo numero largo que no sea una cifra de dinero o una fecha.
 *  - Todo va en una sola transaccion: si algo falla, no queda nada a medias.
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import Papa from "papaparse";
import { and, eq, inArray, isNull, like, sql } from "drizzle-orm";
import { openDb, type ScriptDb } from "./_db";
import * as s from "../src/db/schema";
import type { PaymentStatus, Segment, TaskKind } from "../src/db/enums";
import { companyKey, normalizeEmail, normalizeName, normalizePhone, titleCase } from "../src/lib/normalize";
import { numerosOmitidos, sinSensibles } from "./_sensibles";

const PREFIJO = "jit2026";
const RICARDO = "ricardo.tobon@joseitobon.com";

// ───────────────────────── Argumentos ─────────────────────────

function argumentos() {
  const args = process.argv.slice(2);
  const valor = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const dir = valor("--dir") ?? process.env.IMPORT_DIR;
  if (!dir) {
    console.error("Falta --dir con la carpeta de los CSV.");
    process.exit(1);
  }
  // --hoy existe para las pruebas; en uso normal es la fecha de Colombia.
  const hoy = valor("--hoy") ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  return { dir: resolve(dir), dryRun: args.includes("--dry-run"), hoy };
}

// ───────────────────────── Lectura de CSV ─────────────────────────

type Fila = Record<string, string>;

function claveColumna(h: string): string {
  return h
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function leerCsv(ruta: string): { filas: Fila[]; columnas: string[] } {
  if (!existsSync(ruta)) throw new Error(`No existe el archivo ${ruta}`);
  const texto = readFileSync(ruta, "utf8");
  const r = Papa.parse<Fila>(texto, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: claveColumna,
    // Excel en espanol exporta con punto y coma; Papa lo detecta solo.
  });
  if (r.errors.length) {
    const e = r.errors[0]!;
    throw new Error(`${ruta}: fila ${e.row}: ${e.message}`);
  }
  return { filas: r.data, columnas: r.meta.fields ?? [] };
}

/**
 * Busca una columna por sus nombres posibles. Los CSV vienen de un Excel
 * armado a mano, asi que se aceptan variantes razonables del mismo nombre.
 */
class Columnas {
  faltantes: string[] = [];
  constructor(
    private archivo: string,
    private columnas: string[],
  ) {}
  una(nombre: string, alias: string[], obligatoria = true): string | null {
    const encontrada = [nombre, ...alias].map(claveColumna).find((a) => this.columnas.includes(a));
    if (!encontrada && obligatoria) this.faltantes.push(nombre);
    return encontrada ?? null;
  }
  revisar() {
    if (this.faltantes.length) {
      throw new Error(
        `${this.archivo}: no encuentro las columnas ${this.faltantes.join(", ")}.\n` +
          `  Columnas del archivo: ${this.columnas.join(", ")}`,
      );
    }
  }
}

const val = (f: Fila, c: string | null) => (c ? (f[c] ?? "").trim() : "");

function dinero(raw: string): number | null {
  const limpio = raw.replace(/[^\d,.-]/g, "");
  if (!limpio) return null;
  let n: string;
  const coma = limpio.lastIndexOf(",");
  const punto = limpio.lastIndexOf(".");
  if (coma > punto) n = limpio.replace(/\./g, "").replace(",", ".");
  else if (punto > coma) {
    n = limpio.replace(/,/g, "");
    const cola = n.slice(n.lastIndexOf(".") + 1);
    if (cola.length === 3 || (n.match(/\./g) ?? []).length > 1) n = n.replace(/\./g, "");
  } else n = limpio;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

const MESES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};

/** 2026-05-27, 27/05/2026, 27-may-2026 o solo el mes (2026-02, feb 2026). */
function fecha(raw: string): { iso: string; aproximada: boolean } | null {
  const t = raw.trim().toLowerCase();
  const r = fechaExacta(t);
  if (!r) return null;
  // "2026-07 (2 y 29)" o "2026-03-25/27": se toma la fecha, pero ya no es exacta.
  return r.resto ? { iso: r.iso, aproximada: true } : { iso: r.iso, aproximada: r.aproximada };
}

function fechaExacta(t: string): { iso: string; aproximada: boolean; resto: boolean } | null {
  const conResto = (m: RegExpMatchArray, iso: string, aproximada: boolean) => ({
    iso,
    aproximada,
    resto: t.slice(m[0].length).trim().length > 0,
  });
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return conResto(m, `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`, false);
  m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return conResto(m, `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`, false);
  m = t.match(/^(\d{1,2})[\s/-]([a-z]{3})[a-z]*[\s/-](\d{4})/);
  if (m && MESES[m[2]!]) return conResto(m, `${m[3]}-${String(MESES[m[2]!]).padStart(2, "0")}-${m[1]!.padStart(2, "0")}`, false);
  m = t.match(/^(\d{4})-(\d{1,2})(?!\d|-\d)/);
  if (m) return conResto(m, `${m[1]}-${m[2]!.padStart(2, "0")}-01`, true);
  m = t.match(/^([a-z]{3})[a-z]*[\s/-](\d{4})/);
  if (m && MESES[m[1]!]) return conResto(m, `${m[2]}-${String(MESES[m[1]!]).padStart(2, "0")}-01`, true);
  return null;
}

const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "27 may 2026", o "feb 2026" cuando el origen solo trae el mes. */
function fechaCorta(iso: string, aproximada: boolean): string {
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  return aproximada ? `${MES_CORTO[m - 1]} ${a}` : `${d} ${MES_CORTO[m - 1]} ${a}`;
}

/** Mediodia de Bogota, para que ninguna zona horaria corra la fecha un dia. */
const alMediodia = (iso: string) => new Date(`${iso}T12:00:00-05:00`);
const alCierre = (iso: string) => new Date(`${iso}T17:00:00-05:00`);

// ───────────────────────── Empresas ─────────────────────────

const MARCAS_PERSONALES = new Set(["gmail", "hotmail", "outlook", "yahoo", "icloud", "live", "msn"]);

/** Dominio corporativo: ignora los correos personales, en cualquier pais. */
function dominioCorporativo(email: string | null): string | null {
  if (!email) return null;
  const dominio = email.split("@")[1]!;
  const raiz = dominio.split(".")[0]!;
  return MARCAS_PERSONALES.has(raiz) ? null : dominio;
}

const raizDominio = (d: string) => d.replace(/^www\./, "").split(".")[0]!.replace(/[^a-z0-9]/g, "");

/** Union-find: las empresas se juntan por nombre y por dominio. */
class Grupos {
  private padre = new Map<string, string>();
  agregar(n: string) {
    if (!this.padre.has(n)) this.padre.set(n, n);
  }
  raiz(n: string): string {
    let r = n;
    while (this.padre.get(r) !== r) r = this.padre.get(r)!;
    this.padre.set(n, r);
    return r;
  }
  unir(a: string, b: string) {
    this.agregar(a);
    this.agregar(b);
    const ra = this.raiz(a);
    const rb = this.raiz(b);
    if (ra === rb) return;
    // El dominio manda como representante: es la llave estable.
    if (ra.startsWith("d:") && !rb.startsWith("d:")) this.padre.set(rb, ra);
    else if (rb.startsWith("d:") && !ra.startsWith("d:")) this.padre.set(ra, rb);
    else if (ra < rb) this.padre.set(rb, ra);
    else this.padre.set(ra, rb);
  }
  nodos() {
    return [...this.padre.keys()];
  }
}

type EmpresaPlan = {
  grupo: string;
  nombre: string;
  dominio: string | null;
  claves: string[];
  existenteId: string | null;
  id: string | null;
};

// ───────────────────────── Tipos del plan ─────────────────────────

type ContactoPlan = {
  llave: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  cargo: string | null;
  ciudad: string | null;
  grupoEmpresa: string | null;
  estado: "cliente" | "nutricion" | "nuevo";
  productoInteres: string | null;
  existenteId: string | null;
  id: string | null;
  notaExtra?: string;
};

type NegocioPlan = {
  llave: string;
  nombre: string;
  contacto: string | null;
  grupoEmpresa: string | null;
  productoId: string | null;
  cohorteId: string | null;
  monto: number;
  moneda: "COP" | "USD";
  etapa: string;
  probabilidad: number;
  cerradoEn: string | null;
  estadoPago: PaymentStatus;
  pago: null | {
    estado: "pagado" | "pendiente";
    monto: number;
    fecha: string;
    metodo: string | null;
    referencia: string | null;
    notas: string | null;
  };
  factura: string | null;
  motivoPerdida: string | null;
  entrega: "completado" | "programado" | "cancelado" | "pendiente";
  propuesta: "sin-propuesta" | "enviada";
  meta: Record<string, string | number | boolean | null>;
  notas?: string | null;
  evento: string;
  eventoFecha: string;
  tarea: null | { titulo: string; tipo: TaskKind; llave: string };
  grupo: "participante" | "pipeline";
};

type TareaSuelta = {
  llave: string;
  titulo: string;
  tipo: TaskKind;
  contacto: string | null;
  grupoEmpresa: string | null;
  /** Llave del negocio al que se cuelga, si existe (nuevo o de una corrida anterior). */
  negocio: string | null;
};

type Revision = { motivo: string; detalle: string; origen: string };

// ───────────────────────── Reglas de estado ─────────────────────────

const PAGADOS: Record<string, string> = {
  PAGADO_FACTURA_EMPRESA: "Factura a empresa",
  PAGADO_DIRECTO: "Pago directo",
  PAGADO_EVIDENCIA_WA_GMAIL: "Evidencia en WhatsApp o Gmail",
  CONFIRMADO_EN_LISTA: "Confirmado en la lista",
};
const SOLO_CONTACTO = new Set(["EXCLUIDO_NO_ASISTE", "EXCLUIDO_PAGO_2025", "EXCLUIDO_RESERVA_INTERNA"]);
const ESTADOS_VALIDOS = new Set([
  ...Object.keys(PAGADOS),
  "SIN_MARCA_DE_PAGO",
  "INTERESADO_SIN_CONFIRMAR",
  "EXCLUIDO_INVITADO",
  ...SOLO_CONTACTO,
]);

const esSi = (v: string) => ["si", "sí", "s", "true", "1", "x", "yes"].includes(v.trim().toLowerCase());

// ───────────────────────── Programa ─────────────────────────

async function main() {
  const { dir, dryRun, hoy } = argumentos();
  console.log(`\n${dryRun ? "SIMULACION (--dry-run): no se escribe nada" : "IMPORTACION REAL"}`);
  console.log(`Carpeta: ${dir}\nHoy: ${hoy}\n`);

  const cohortesCsv = leerCsv(join(dir, "crm_cohortes_2026.csv"));
  const partCsv = leerCsv(join(dir, "crm_participantes_2026.csv"));
  const pipeCsv = leerCsv(join(dir, "crm_pipeline_abierto.csv"));

  // Columnas. Si falta una obligatoria se detiene antes de tocar la base.
  const cc = new Columnas("crm_cohortes_2026.csv", cohortesCsv.columnas);
  const C = {
    id: cc.una("id", ["cohorte_id", "cohorte"]),
    nombre: cc.una("nombre", ["cohorte_nombre", "nombre_cohorte", "descripcion"], false),
    producto: cc.una("producto", ["programa"]),
    ciudad: cc.una("ciudad", [], false),
    fecha: cc.una("fecha", ["fecha_cohorte", "fecha_inicio"]),
    precio: cc.una("precio_neto_cop", ["precio_lista_neto_cop", "precio_neto", "precio"]),
    confirmado: cc.una("ingreso_confirmado_cop", ["ingreso_confirmado", "confirmado_cop", "confirmado"]),
    techo: cc.una("ingreso_techo_cop", ["ingreso_techo", "techo_cop", "techo"]),
  };
  cc.revisar();
  // Los conteos son las columnas numericas que no son ni precio ni ingreso.
  const usadas = new Set(Object.values(C).filter(Boolean));
  const columnasConteo = cohortesCsv.columnas.filter(
    (c) => !usadas.has(c) && cohortesCsv.filas.every((f) => /^\d*$/.test((f[c] ?? "").trim())),
  );

  const pc = new Columnas("crm_participantes_2026.csv", partCsv.columnas);
  const P = {
    cohorte: pc.una("cohorte_id", ["cohorte", "id_cohorte"]),
    nombre: pc.una("nombre", ["nombre_completo", "participante", "persona"]),
    email: pc.una("email", ["correo", "email_normalizado"]),
    telefono: pc.una("telefono", ["celular", "whatsapp", "tel"], false),
    empresa: pc.una("empresa", ["compania", "organizacion"]),
    cargo: pc.una("cargo", ["puesto"], false),
    placeholder: pc.una("es_placeholder", ["placeholder"]),
    estado: pc.una("estado_pago", ["estado"]),
    factura: pc.una("factura", ["factura_fan", "fan"]),
    evidencia: pc.una("evidencia", ["evidencia_pago"]),
    precio: pc.una("precio_neto_cop", ["precio_neto_aplicado", "precio_neto", "precio"]),
    hoja: pc.una("hoja", ["hoja_excel", "hoja_origen"]),
    fila: pc.una("fila", ["fila_excel", "fila_origen"]),
  };
  pc.revisar();

  const qc = new Columnas("crm_pipeline_abierto.csv", pipeCsv.columnas);
  const Q = {
    id: qc.una("id", ["negocio_id"], false),
    tipo: qc.una("tipo", []),
    nombre: qc.una("nombre", ["empresa_o_persona", "negocio", "cliente", "titulo"]),
    empresa: qc.una("empresa", ["compania"], false),
    contacto: qc.una("contacto", ["persona", "contactos", "handles", "handle"], false),
    email: qc.una("email", ["correo"], false),
    telefono: qc.una("telefono", ["telefonos", "celular", "whatsapp"], false),
    producto: qc.una("producto", ["programa"], false),
    monto: qc.una("monto", ["valor_neto_estimado_cop", "monto_cop", "valor", "valor_cop"], false),
    moneda: qc.una("moneda", ["divisa"], false),
    accion: qc.una("siguiente_accion", ["proxima_accion", "accion"]),
    estado: qc.una("estado", ["situacion", "contexto"], false),
    fuente: qc.una("fuente", ["origen"], false),
    senal: qc.una("fecha_ultima_senal", ["ultima_senal", "fecha"], false),
  };
  qc.revisar();

  const { db, close, mode } = await openDb();
  console.log(`Base de datos: ${mode}\n`);

  try {
    const [ricardo] = await db.select().from(s.users).where(eq(s.users.email, RICARDO)).limit(1);
    if (!ricardo) throw new Error(`No existe el usuario ${RICARDO}. Corre las semillas primero.`);

    const productos = await db.select().from(s.products).where(isNull(s.products.deletedAt));
    const productoPor = (texto: string): { id: string; nombre: string } | null => {
      const t = claveColumna(texto);
      const buscar = (patron: RegExp) => productos.find((p) => patron.test(claveColumna(p.name)));
      let p = null;
      if (/diplomado/.test(t)) p = buscar(/^diplomado/);
      else if (/in_?house/.test(t)) p = buscar(/in_house.*un_dia/);
      else if (/bootcamp|abierto/.test(t)) p = buscar(/^bootcamp_abierto/);
      else if (/masterclass/.test(t)) p = buscar(/^masterclass/);
      return p ? { id: p.id, nombre: p.name } : null;
    };

    const revision: Revision[] = [];
    const avisos: string[] = [];

    // ───────── Cohortes ─────────
    type CohortePlan = {
      id: string;
      nombre: string;
      productoId: string | null;
      productoTexto: string;
      ciudad: string | null;
      fecha: string;
      aproximada: boolean;
      precio: number | null;
      confirmado: number;
      techo: number;
      conteos: Record<string, number>;
      notas: string | null;
    };
    const cohortes = new Map<string, CohortePlan>();
    const productosSinCalzar = new Set<string>();
    for (const [i, f] of cohortesCsv.filas.entries()) {
      const id = val(f, C.id);
      if (!id) throw new Error(`crm_cohortes_2026.csv fila ${i + 2}: sin id`);
      const fch = fecha(val(f, C.fecha));
      if (!fch) throw new Error(`crm_cohortes_2026.csv fila ${i + 2}: no entiendo la fecha "${val(f, C.fecha)}"`);
      const productoTexto = val(f, C.producto);
      const prod = productoPor(productoTexto);
      if (!prod) productosSinCalzar.add(productoTexto);
      const ciudadTexto = val(f, C.ciudad);
      const ciudad = ciudadTexto.replace(/\?+$/, "").trim() || null;
      const notas = [
        fch.aproximada ? `Fecha en el origen: "${val(f, C.fecha)}".` : null,
        /\?$/.test(ciudadTexto) ? "Ciudad por confirmar." : null,
      ].filter(Boolean);
      const conteos: Record<string, number> = {};
      for (const c of columnasConteo) {
        const n = dinero(f[c] ?? "");
        if (n !== null) conteos[c] = n;
      }
      cohortes.set(id, {
        id,
        // "Diplomado" + "Online" se lee mejor como "Diplomado Online" que separado por un punto.
        nombre:
          val(f, C.nombre) ||
          (ciudad && /^online$/i.test(ciudad)
            ? [`${titleCase(productoTexto)} Online`, fechaCorta(fch.iso, fch.aproximada)]
            : [titleCase(productoTexto), ciudad, fechaCorta(fch.iso, fch.aproximada)]
          )
            .filter(Boolean)
            .join(" · "),
        productoId: prod?.id ?? null,
        productoTexto,
        ciudad,
        fecha: fch.iso,
        aproximada: fch.aproximada,
        precio: dinero(val(f, C.precio)),
        confirmado: dinero(val(f, C.confirmado)) ?? 0,
        techo: dinero(val(f, C.techo)) ?? 0,
        conteos,
        notas: notas.join(" ") || null,
      });
    }

    // En 10 filas la columna empresa trae un telefono. En los cupos sin nombre la
    // empresa viene en la columna nombre ("Banco de Bogotá", "Clima DEA").
    const empresaDeFila = (f: Fila): string => {
      const e = val(f, P.empresa);
      if (pareceTelefono(e)) return esSi(val(f, P.placeholder)) ? val(f, P.nombre) : "";
      return e || (esSi(val(f, P.placeholder)) ? val(f, P.nombre) : "");
    };

    // ───────── Participantes: primera pasada, validacion y empresas ─────────
    const grupos = new Grupos();
    const nombreEmpresa = new Map<string, Map<string, number>>(); // nodo n: → nombres originales
    const anotarEmpresa = (empresa: string, dominio: string | null) => {
      const k = companyKey(empresa);
      if (k) {
        grupos.agregar(`n:${k}`);
        const m = nombreEmpresa.get(`n:${k}`) ?? new Map<string, number>();
        m.set(empresa, (m.get(empresa) ?? 0) + 1);
        nombreEmpresa.set(`n:${k}`, m);
      }
      if (dominio) grupos.agregar(`d:${dominio}`);
      if (k && dominio) grupos.unir(`n:${k}`, `d:${dominio}`);
    };

    const estadosDesconocidos = new Map<string, number>();
    for (const [i, f] of partCsv.filas.entries()) {
      const cid = val(f, P.cohorte);
      if (!cohortes.has(cid)) throw new Error(`crm_participantes_2026.csv fila ${i + 2}: cohorte "${cid}" no existe`);
      const estado = val(f, P.estado).toUpperCase();
      if (!ESTADOS_VALIDOS.has(estado)) estadosDesconocidos.set(estado, (estadosDesconocidos.get(estado) ?? 0) + 1);
      anotarEmpresa(empresaDeFila(f), dominioCorporativo(normalizeEmail(val(f, P.email))));
    }
    if (estadosDesconocidos.size) {
      throw new Error(
        `estado_pago que no conozco: ${[...estadosDesconocidos].map(([e, n]) => `"${e}" (${n})`).join(", ")}`,
      );
    }
    const filasPipeline = pipeCsv.filas.map((f) => leerFilaPipeline(f, Q));
    for (const r of filasPipeline) {
      if (r.empresa) anotarEmpresa(r.empresa, r.emails.map(dominioCorporativo).find(Boolean) ?? null);
    }

    // Un nombre de empresa sin dominio se liga a un dominio cuya raiz lo contiene
    // ("Green" y greencss.com). Solo si hay un unico candidato, y se reporta.
    const dominios = grupos.nodos().filter((n) => n.startsWith("d:"));
    const uniones: string[] = [];
    for (const n of grupos.nodos().filter((x) => x.startsWith("n:"))) {
      if (grupos.raiz(n).startsWith("d:")) continue;
      const k = n.slice(2);
      if (k.length < 4) continue;
      const candidatos = dominios.filter((d) => {
        const r = raizDominio(d.slice(2));
        return r.length >= 4 && (r.startsWith(k) || k.startsWith(r) || (r.length >= 6 && k.includes(r)));
      });
      const distintos = [...new Set(candidatos.map((d) => grupos.raiz(d)))];
      if (distintos.length === 1) {
        grupos.unir(n, candidatos[0]!);
        uniones.push(`${[...(nombreEmpresa.get(n)?.keys() ?? [k])][0]} = ${candidatos[0]!.slice(2)}`);
      } else if (distintos.length > 1) {
        revision.push({
          motivo: "Empresa ambigua",
          detalle: `"${[...(nombreEmpresa.get(n)?.keys() ?? [k])][0]}" podría ser ${candidatos.map((d) => d.slice(2)).join(" o ")}`,
          origen: "empresas",
        });
      }
    }

    // Empresas finales, una por grupo.
    const empresas = new Map<string, EmpresaPlan>();
    for (const nodo of grupos.nodos()) {
      const g = grupos.raiz(nodo);
      const e = empresas.get(g) ?? { grupo: g, nombre: "", dominio: null, claves: [], existenteId: null, id: null };
      if (nodo.startsWith("d:")) e.dominio ??= nodo.slice(2);
      else e.claves.push(nodo.slice(2));
      empresas.set(g, e);
    }
    for (const e of empresas.values()) {
      const conteo = new Map<string, number>();
      for (const k of e.claves) for (const [nom, n] of nombreEmpresa.get(`n:${k}`) ?? []) conteo.set(nom, (conteo.get(nom) ?? 0) + n);
      const masUsado = [...conteo].sort((a, b) => b[1] - a[1])[0]?.[0];
      e.nombre = masUsado ? masUsado.trim() : titleCase(raizDominio(e.dominio!));
    }
    const grupoDe = (empresa: string, email: string | null): string | null => {
      const d = dominioCorporativo(email);
      if (d) return grupos.raiz(`d:${d}`);
      const k = companyKey(empresa);
      return k ? grupos.raiz(`n:${k}`) : null;
    };

    // Empresas que ya existen en el CRM: se reusan sin tocarlas.
    const existentes = await db
      .select({ id: s.companies.id, name: s.companies.name, domain: s.companies.domain })
      .from(s.companies)
      .where(isNull(s.companies.deletedAt));
    for (const e of empresas.values()) {
      const porDominio = e.dominio ? existentes.find((x) => x.domain?.toLowerCase() === e.dominio) : undefined;
      const porNombre = existentes.find((x) => e.claves.includes(companyKey(x.name)));
      if (porDominio && porNombre && porDominio.id !== porNombre.id) {
        avisos.push(`Conflicto: "${e.nombre}" calza por dominio con "${porDominio.name}" y por nombre con "${porNombre.name}". Se usa la del dominio.`);
      }
      e.existenteId = porDominio?.id ?? porNombre?.id ?? null;
    }

    // ───────── Participantes: contactos y negocios ─────────
    const contactos = new Map<string, ContactoPlan>();
    const negocios: NegocioPlan[] = [];
    const llavesNegocio = new Set<string>();
    const duplicadosEnArchivo: string[] = [];

    const contactoPara = (
      nombre: string,
      email: string | null,
      telefono: string | null,
      grupo: string | null,
      origen: string,
      extra: Partial<ContactoPlan>,
    ): string => {
      let llave: string;
      if (email) llave = `${PREFIJO}:email:${email}`;
      else if (grupo) llave = `${PREFIJO}:nombre:${grupo}:${companyKey(nombre)}`;
      else llave = `${PREFIJO}:fila:${origen}`;
      const previo = contactos.get(llave);
      if (previo) {
        if (!previo.telefono && telefono) previo.telefono = telefono;
        if (extra.estado === "cliente") previo.estado = "cliente";
        return llave;
      }
      contactos.set(llave, {
        llave,
        nombre: normalizeName(nombre) || email || "Sin nombre",
        email,
        telefono,
        cargo: null,
        ciudad: null,
        grupoEmpresa: grupo,
        estado: "nuevo",
        productoInteres: null,
        existenteId: null,
        id: null,
        ...extra,
      });
      return llave;
    };

    for (const f of partCsv.filas) {
      const coh = cohortes.get(val(f, P.cohorte))!;
      const estado = val(f, P.estado).toUpperCase();
      const email = normalizeEmail(val(f, P.email));
      const empresaCol = val(f, P.empresa);
      const telefono = normalizePhone(val(f, P.telefono) || (pareceTelefono(empresaCol) ? empresaCol : ""));
      const nombre = val(f, P.nombre);
      const empresa = empresaDeFila(f);
      const grupo = grupoDe(empresa, email);
      const hoja = val(f, P.hoja);
      const fila = val(f, P.fila);
      const origen = `${coh.id}:${hoja}:${fila}`;
      const placeholder = esSi(val(f, P.placeholder));
      const factura = sinSensibles(val(f, P.factura)) || null;
      const evidencia = sinSensibles(val(f, P.evidencia)) || null;
      const precio = dinero(val(f, P.precio)) ?? coh.precio ?? 0;
      if (dinero(val(f, P.precio)) === null && !SOLO_CONTACTO.has(estado)) {
        avisos.push(`Sin precio en ${origen}: se usó el de la cohorte (${coh.precio ?? 0}).`);
      }

      const ganado = estado in PAGADOS || estado === "SIN_MARCA_DE_PAGO" || estado === "EXCLUIDO_INVITADO";
      const tieneDatos = !!(email || telefono);

      // Contacto: nunca para los cupos sin nombre; para los excluidos, solo si hay datos.
      let contacto: string | null = null;
      if (!placeholder && (!SOLO_CONTACTO.has(estado) || tieneDatos) && (nombre || email)) {
        contacto = contactoPara(nombre, email, telefono, grupo, origen, {
          cargo: val(f, P.cargo) || null,
          ciudad: coh.ciudad,
          estado: ganado || estado === "EXCLUIDO_PAGO_2025" ? "cliente" : "nutricion",
          productoInteres: coh.productoId,
        });
      }
      if (placeholder && !grupo) {
        revision.push({ motivo: "Cupo sin nombre y sin empresa", detalle: `"${nombre}"`, origen });
      }
      if (SOLO_CONTACTO.has(estado)) continue;

      const llave = email ? `${PREFIJO}:${coh.id}:${email}` : `${PREFIJO}:${coh.id}:${hoja}:${fila}`;
      if (llavesNegocio.has(llave)) {
        duplicadosEnArchivo.push(`${llave} (${nombre || email})`);
        continue;
      }
      llavesNegocio.add(llave);

      const persona = placeholder ? "Cupo sin nombre" : normalizeName(nombre) || email!;
      const empresaNombre = grupo ? empresas.get(grupo)!.nombre : null;
      const pagado = estado in PAGADOS;
      const invitado = estado === "EXCLUIDO_INVITADO";
      const perdido = estado === "INTERESADO_SIN_CONFIRMAR";

      negocios.push({
        llave,
        nombre: [
          coh.nombre,
          placeholder && empresaNombre ? `Cupo sin nombre, ${empresaNombre}` : persona,
          invitado ? "(Invitado)" : null,
        ]
          .filter(Boolean)
          .join(" · "),
        contacto,
        grupoEmpresa: grupo,
        productoId: coh.productoId,
        cohorteId: coh.id,
        monto: invitado ? 0 : precio,
        moneda: "COP",
        etapa: perdido ? "perdido" : "ganado",
        probabilidad: perdido ? 0 : 100,
        cerradoEn: coh.fecha,
        estadoPago: pagado ? "pagado" : estado === "SIN_MARCA_DE_PAGO" ? "por-conciliar" : "no-vencido",
        pago: pagado
          ? { estado: "pagado", monto: precio, fecha: coh.fecha, metodo: PAGADOS[estado]!, referencia: factura, notas: evidencia }
          : null,
        factura,
        motivoPerdida: perdido ? "No confirmó" : null,
        entrega: perdido ? "cancelado" : coh.fecha <= hoy ? "completado" : "programado",
        propuesta: "sin-propuesta",
        meta: {
          origen: "Tracking Bootcamps y Diplomado 2026",
          estado_pago: estado,
          hoja,
          fila,
          factura,
          evidencia,
          fecha_aproximada: coh.aproximada,
          etiqueta: invitado ? "Invitado" : null,
          cupo_sin_nombre: placeholder,
        },
        evento: perdido
          ? `Interesado en ${coh.nombre}, no confirmó`
          : invitado
            ? `Invitado a ${coh.nombre}`
            : `Inscrito en ${coh.nombre}`,
        eventoFecha: coh.fecha,
        tarea: null,
        grupo: "participante",
      });
    }

    // Revision: mismo nombre sin correo en contactos distintos.
    const porNombre = new Map<string, ContactoPlan[]>();
    for (const c of contactos.values()) {
      const k = companyKey(c.nombre);
      if (!k) continue;
      porNombre.set(k, [...(porNombre.get(k) ?? []), c]);
    }
    for (const lista of porNombre.values()) {
      if (lista.length < 2) continue;
      // Con correos distintos solo se avisa si el nombre es completo: "Lina Franco"
      // con el correo del trabajo y el personal puede ser la misma persona.
      const conCorreo = lista.every((c) => c.email);
      if (conCorreo && lista[0]!.nombre.trim().split(/\s+/).length < 2) continue;
      revision.push({
        motivo: conCorreo ? "Mismo nombre, correos distintos" : "Mismo nombre, sin fusionar",
        detalle: lista
          .map((c) => `${c.nombre} <${c.email ?? "sin correo"}>${c.grupoEmpresa ? ` (${empresas.get(c.grupoEmpresa)!.nombre})` : ""}`)
          .join(" | "),
        origen: "contactos",
      });
    }
    // Revision: correo que parece de otra persona de la misma empresa (en Matizzo
    // los correos quedaron cruzados entre filas del Excel).
    const tokens = (t: string) =>
      companyKey(t) && t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z]+/).filter((x) => x.length >= 4);
    const porEmpresaC = new Map<string, ContactoPlan[]>();
    for (const c of contactos.values()) if (c.grupoEmpresa && c.email) porEmpresaC.set(c.grupoEmpresa, [...(porEmpresaC.get(c.grupoEmpresa) ?? []), c]);
    for (const lista of porEmpresaC.values()) {
      for (const c of lista) {
        const deCorreo = tokens(c.email!.split("@")[0]!) || [];
        const propios = tokens(c.nombre) || [];
        if (!deCorreo.length || deCorreo.some((x) => propios.includes(x))) continue;
        const otro = lista.find((o) => o !== c && deCorreo.some((x) => (tokens(o.nombre) || []).includes(x)));
        if (otro) {
          revision.push({
            motivo: "Correo posiblemente cruzado",
            detalle: `${c.nombre} tiene ${c.email}, que parece de ${otro.nombre}`,
            origen: "contactos",
          });
        }
      }
    }

    // Revision: mismo telefono en contactos distintos.
    const porTelefono = new Map<string, ContactoPlan[]>();
    for (const c of contactos.values()) if (c.telefono) porTelefono.set(c.telefono, [...(porTelefono.get(c.telefono) ?? []), c]);
    for (const [tel, lista] of porTelefono) {
      if (lista.length < 2) continue;
      revision.push({
        motivo: "Mismo teléfono, sin fusionar",
        detalle: `${tel}: ${lista.map((c) => `${c.nombre} <${c.email ?? "sin correo"}>`).join(" | ")}`,
        origen: "contactos",
      });
    }

    // ───────── Pipeline abierto ─────────
    const tareasSueltas: TareaSuelta[] = [];
    const ligadosAParticipante: string[] = [];
    const recientes = (a: NegocioPlan, b: NegocioPlan) => (b.cerradoEn ?? "").localeCompare(a.cerradoEn ?? "");

    /**
     * Busca el negocio de participante que corresponde a una fila del pipeline:
     * por correo, por nombre de la persona o por empresa, siempre dentro de la
     * misma familia de producto (un cobro del Diplomado no se cuelga de un
     * bootcamp). Gana la cohorte mas reciente, y dentro de ella el que calza
     * por persona antes que el que calza solo por empresa.
     */
    const buscarParticipante = (r: FilaPipeline, grupo: string | null): NegocioPlan[] => {
      const fam = familia(r.producto);
      const nombres = r.personas.map((n) => companyKey(n)).filter((k) => k.length >= 4);
      const conFamilia = negocios.filter(
        (n) => n.grupo === "participante" && n.etapa === "ganado" && (!fam || familia(cohortes.get(n.cohorteId!)!.productoTexto) === fam),
      );
      const porPersona = conFamilia.filter((n) => {
        const c = n.contacto ? contactos.get(n.contacto) : undefined;
        if (!c) return false;
        if (c.email && r.emails.includes(c.email)) return true;
        const k = companyKey(c.nombre);
        return nombres.some((x) => k === x || (x.length >= 10 && k.startsWith(x)));
      });
      const porEmpresa = grupo ? conFamilia.filter((n) => n.grupoEmpresa === grupo) : [];
      const lista = (porPersona.length ? porPersona : porEmpresa).sort(recientes);
      if (!lista.length) return [];
      const cohorte = lista[0]!.cohorteId;
      return lista.filter((n) => n.cohorteId === cohorte);
    };

    for (const [i, r] of filasPipeline.entries()) {
      const f = pipeCsv.filas[i]!;
      const tipo = claveColumna(r.tipo).replace(/_/g, "");
      const base = `${PREFIJO}:pipeline:${val(f, Q.id) || i + 2}`;
      const origen = `pipeline ${val(f, Q.id) || `fila ${i + 2}`}`;
      const accion = sinSensibles(val(f, Q.accion)).slice(0, 240) || "Definir siguiente paso";
      const contexto = sinSensibles(val(f, Q.estado)) || null;
      const senal = fecha(val(f, Q.senal))?.iso ?? hoy;
      const email = r.emails[0] ?? null;
      const grupo = r.empresa ? grupoDe(r.empresa, email) : email ? grupoDe("", email) : null;
      const prod = productoPor(r.producto);
      const montoTexto = val(f, Q.monto);
      const moneda: "COP" | "USD" = /usd/i.test(`${val(f, Q.moneda)} ${montoTexto}`) ? "USD" : "COP";
      const monto = dinero(montoTexto) ?? 0;
      const meta = {
        origen: "Pipeline abierto 2026-09-23",
        id: val(f, Q.id) || null,
        tipo: r.tipo,
        fuente: val(f, Q.fuente) || null,
        fecha_ultima_senal: val(f, Q.senal) || null,
      };

      if (tipo === "leads" || tipo === "lead") {
        // Un negocio por persona: cada handle, telefono o nombre de la lista.
        const piezas = r.piezas;
        if (!piezas.length) {
          revision.push({ motivo: "Lead sin handle ni teléfono", detalle: r.nombre || accion, origen });
          continue;
        }
        for (const [j, pieza] of piezas.entries()) {
          const nota = pieza.match(/\(([^)]*)\)/)?.[1] ?? null;
          const limpio = pieza.replace(/\([^)]*\)/g, "").trim();
          const tel = /^@/.test(limpio) ? null : normalizePhone(limpio);
          const etiqueta = /^@/.test(limpio) ? limpio : tel ? `Lead WhatsApp +${tel}` : normalizeName(limpio);
          const llaveC = tel ? `${PREFIJO}:tel:${tel}` : `${PREFIJO}:handle:${limpio.toLowerCase()}`;
          if (!contactos.has(llaveC)) {
            contactos.set(llaveC, {
              llave: llaveC,
              nombre: etiqueta,
              email: null,
              telefono: tel,
              cargo: null,
              ciudad: null,
              grupoEmpresa: null,
              estado: "nuevo",
              productoInteres: prod?.id ?? null,
              existenteId: null,
              id: null,
            });
          }
          negocios.push({
            llave: `${base}:${j + 1}`,
            nombre: `${r.nombre || "Lead"} · ${etiqueta}${nota ? ` (${nota})` : ""}`,
            contacto: llaveC,
            grupoEmpresa: null,
            productoId: prod?.id ?? null,
            cohorteId: null,
            monto: piezas.length === 1 ? monto : 0,
            moneda,
            etapa: "nuevo-lead",
            probabilidad: 5,
            cerradoEn: null,
            estadoPago: "no-vencido",
            pago: null,
            factura: null,
            motivoPerdida: null,
            entrega: "pendiente",
            propuesta: "sin-propuesta",
            meta: { ...meta, pieza: j + 1 },
            notas: [contexto, nota].filter(Boolean).join(" · ") || null,
            evento: `Lead: ${r.nombre || "sin nombre"}`,
            eventoFecha: senal,
            tarea: { titulo: accion, tipo: "llamar", llave: `${base}:${j + 1}:tarea` },
            grupo: "pipeline",
          });
        }
        continue;
      }

      // Contacto de la fila, si hay con quien.
      const persona = r.personas[0] ?? (email ? nombreDesdeEmail(email) : null);
      const contacto = persona || email
        ? contactoPara(persona || email!, email, r.telefonos[0] ? normalizePhone(r.telefonos[0]) : null, grupo, origen, {
            productoInteres: prod?.id ?? null,
            estado: tipo === "cobro" ? "cliente" : "nuevo",
          })
        : null;
      if (contacto && r.handles.length) {
        const c = contactos.get(contacto)!;
        c.notaExtra = `Instagram: ${r.handles.join(", ")}`;
      }

      // Cobros y servicios de alguien que ya esta en una cohorte: el pendiente se
      // cuelga de su negocio y no se crea una segunda venta.
      if (tipo === "cobro" || tipo === "servicio") {
        const encontrados = buscarParticipante(r, grupo);
        if (encontrados.length) {
          const destino = encontrados[0]!;
          tareasSueltas.push({
            llave: `${base}:tarea`,
            titulo: accion,
            tipo: tipo === "cobro" ? "seguimiento-pago" : "coordinar-servicio",
            contacto: destino.contacto,
            grupoEmpresa: destino.grupoEmpresa,
            negocio: destino.llave,
          });
          ligadosAParticipante.push(`${val(f, Q.id)} ${r.nombre} → ${destino.nombre}`);
          const estadoOrigen = String(destino.meta.estado_pago);
          revision.push({
            motivo: tipo === "cobro" ? "Cobro colgado de su negocio de cohorte" : "Servicio colgado de su negocio de cohorte",
            detalle:
              `${r.nombre}: ${destino.nombre} (${estadoOrigen})` +
              (encontrados.length > 1 ? `; también calzan ${encontrados.slice(1).map((n) => n.nombre).join(" | ")}` : "") +
              (tipo === "cobro" && estadoOrigen in PAGADOS ? ". Ojo: en la lista ya figura pagado" : "") +
              (contexto ? `. Contexto: ${contexto}` : ""),
            origen,
          });
          continue;
        }
      }

      if (tipo === "servicio") {
        tareasSueltas.push({ llave: `${base}:tarea`, titulo: accion, tipo: "coordinar-servicio", contacto, grupoEmpresa: grupo, negocio: null });
        continue;
      }

      const etapa =
        tipo === "cobro"
          ? "ganado"
          : tipo === "inhouse"
            ? /prepar|armar/i.test(`${accion} ${contexto ?? ""}`) && !/enviad|cotizaci/i.test(contexto ?? "")
              ? "propuesta-por-preparar"
              : "propuesta-enviada"
            : tipo === "oportunidad"
              ? "calificado"
              : null;
      if (!etapa) throw new Error(`crm_pipeline_abierto.csv ${origen}: tipo "${r.tipo}" no lo conozco`);

      if (monto === 0) {
        revision.push({
          motivo: tipo === "cobro" ? "Cobro sin valor" : "Negocio sin valor",
          detalle: `${r.nombre}${r.producto ? ` (${r.producto})` : ""}: quedó en COP 0, ponle el valor cuando lo tengas`,
          origen,
        });
      }
      if (tipo === "inhouse" && /en curso|ejecuci/i.test(contexto ?? "")) {
        revision.push({ motivo: "¿Ya está ganado?", detalle: `${r.nombre}: el origen dice "${contexto}"`, origen });
      }

      negocios.push({
        llave: base,
        nombre: [r.nombre, r.producto].filter(Boolean).join(" · "),
        contacto,
        grupoEmpresa: grupo,
        productoId: prod?.id ?? null,
        cohorteId: null,
        monto,
        moneda,
        etapa,
        probabilidad: etapa === "ganado" ? 100 : etapa === "calificado" ? 20 : etapa === "propuesta-enviada" ? 55 : 45,
        cerradoEn: etapa === "ganado" ? hoy : null,
        estadoPago: tipo === "cobro" && monto > 0 ? "pendiente" : "no-vencido",
        pago: tipo === "cobro" && monto > 0 ? { estado: "pendiente", monto, fecha: hoy, metodo: null, referencia: null, notas: null } : null,
        factura: null,
        motivoPerdida: null,
        entrega: "pendiente",
        propuesta: etapa === "propuesta-enviada" ? "enviada" : "sin-propuesta",
        meta,
        notas: contexto,
        evento: tipo === "cobro" ? `Cobro pendiente: ${r.nombre}` : `Negocio abierto: ${r.nombre}`,
        eventoFecha: senal,
        tarea: {
          titulo: accion,
          tipo: tipo === "cobro" ? "seguimiento-pago" : tipo === "inhouse" ? (etapa === "propuesta-enviada" ? "esperar-respuesta" : "enviar-propuesta") : "llamar",
          llave: `${base}:tarea`,
        },
        grupo: "pipeline",
      });
    }

    // ───────── Lo que ya existe en el CRM ─────────
    const llavesC = [...contactos.keys()];
    const yaContactos = llavesC.length
      ? await db.select({ id: s.contacts.id, key: s.contacts.externalKey }).from(s.contacts).where(inArray(s.contacts.externalKey, llavesC))
      : [];
    const emailsPlan = [...contactos.values()].map((c) => c.email).filter((e): e is string => !!e);
    const yaPorEmail = emailsPlan.length
      ? await db
          .select({ id: s.contacts.id, email: s.contacts.emailNormalized, name: s.contacts.fullName })
          .from(s.contacts)
          .where(and(inArray(s.contacts.emailNormalized, emailsPlan), isNull(s.contacts.deletedAt)))
      : [];
    const contactosReusados: string[] = [];
    for (const c of contactos.values()) {
      const porLlave = yaContactos.find((x) => x.key === c.llave);
      const porEmail = c.email ? yaPorEmail.find((x) => x.email === c.email) : undefined;
      c.existenteId = porLlave?.id ?? porEmail?.id ?? null;
      if (!porLlave && porEmail) contactosReusados.push(`${c.nombre} <${c.email}> ya estaba como "${porEmail.name}"`);
    }
    const yaNegocios = new Set(
      (
        await db
          .select({ key: s.opportunities.externalKey })
          .from(s.opportunities)
          .where(like(s.opportunities.externalKey, `${PREFIJO}:%`))
      ).map((r) => r.key),
    );
    const nuevos = negocios.filter((n) => !yaNegocios.has(n.llave));
    const yaCohortes = new Set((await db.select({ id: s.cohorts.id }).from(s.cohorts)).map((r) => r.id));

    // ───────── Resumen ─────────
    const fmt = (n: number) => `COP ${Math.round(n).toLocaleString("es-CO")}`;
    const empresasUsadas = new Set<string>();
    for (const c of contactos.values()) if (c.grupoEmpresa) empresasUsadas.add(c.grupoEmpresa);
    for (const n of negocios) if (n.grupoEmpresa) empresasUsadas.add(n.grupoEmpresa);
    for (const t of tareasSueltas) if (t.grupoEmpresa) empresasUsadas.add(t.grupoEmpresa);
    const empresasFinales = [...empresasUsadas].map((g) => empresas.get(g)!);

    console.log("── Cohortes");
    console.log(`  ${cohortes.size} en el archivo, ${[...cohortes.keys()].filter((k) => !yaCohortes.has(k)).length} nuevas`);
    const aproximadas = [...cohortes.values()].filter((c) => c.aproximada);
    if (aproximadas.length) console.log(`  Fecha aproximada (solo mes): ${aproximadas.map((c) => c.id).join(", ")}`);
    if (productosSinCalzar.size) console.log(`  Sin producto en el catálogo: ${[...productosSinCalzar].join(", ")}`);

    console.log("\n── Empresas");
    console.log(`  ${empresasFinales.length} en total: ${empresasFinales.filter((e) => !e.existenteId).length} nuevas, ${empresasFinales.filter((e) => e.existenteId).length} ya existían`);
    if (uniones.length) console.log(`  Unidas por dominio: ${uniones.join("; ")}`);

    console.log("\n── Contactos");
    const cs = [...contactos.values()];
    console.log(`  ${cs.length} en total: ${cs.filter((c) => !c.existenteId).length} nuevos, ${cs.filter((c) => c.existenteId).length} ya existían`);
    for (const r of contactosReusados.slice(0, 10)) console.log(`  Reusado: ${r}`);

    console.log("\n── Negocios");
    console.log(`  ${negocios.length} en total: ${nuevos.length} nuevos, ${negocios.length - nuevos.length} ya importados antes`);
    const porEtapa = new Map<string, { n: number; monto: number }>();
    const porPago = new Map<string, { n: number; monto: number }>();
    for (const n of negocios) {
      const cop = n.moneda === "COP" ? n.monto : 0;
      const e = porEtapa.get(n.etapa) ?? { n: 0, monto: 0 };
      porEtapa.set(n.etapa, { n: e.n + 1, monto: e.monto + cop });
      if (n.etapa === "ganado") {
        const p = porPago.get(n.estadoPago) ?? { n: 0, monto: 0 };
        porPago.set(n.estadoPago, { n: p.n + 1, monto: p.monto + cop });
      }
    }
    console.log("  Por etapa:");
    for (const [k, v] of porEtapa) console.log(`    ${k.padEnd(24)} ${String(v.n).padStart(4)}   ${fmt(v.monto)}`);
    console.log("  Ganados por estado de pago:");
    for (const [k, v] of porPago) console.log(`    ${k.padEnd(24)} ${String(v.n).padStart(4)}   ${fmt(v.monto)}`);
    const usd = negocios.filter((n) => n.moneda === "USD");
    if (usd.length) console.log(`  En dólares (fuera de las sumas en pesos): ${usd.map((n) => `${n.nombre} USD ${n.monto}`).join("; ")}`);

    // Cuadre contra el archivo de cohortes: solo los negocios de participantes.
    const part = negocios.filter((n) => n.grupo === "participante" && n.etapa === "ganado");
    const pagado = part.filter((n) => n.meta.estado_pago && String(n.meta.estado_pago) in PAGADOS).reduce((a, n) => a + n.monto, 0);
    const techo = part.filter((n) => n.meta.estado_pago !== "EXCLUIDO_INVITADO").reduce((a, n) => a + n.monto, 0);
    const esperadoPagado = [...cohortes.values()].reduce((a, c) => a + c.confirmado, 0);
    const esperadoTecho = [...cohortes.values()].reduce((a, c) => a + c.techo, 0);
    const ok = (a: number, b: number) => (Math.abs(a - b) < 1 ? "cuadra" : `NO CUADRA, diferencia ${fmt(a - b)}`);
    console.log("\n── Cuadre con crm_cohortes_2026.csv (participantes)");
    console.log(`  PAID:                  ${fmt(pagado)}   esperado ${fmt(esperadoPagado)}   ${ok(pagado, esperadoPagado)}`);
    console.log(`  PAID + por conciliar:  ${fmt(techo)}   esperado ${fmt(esperadoTecho)}   ${ok(techo, esperadoTecho)}`);
    for (const c of cohortes.values()) {
      const deC = part.filter((n) => n.cohorteId === c.id);
      const p = deC.filter((n) => String(n.meta.estado_pago) in PAGADOS).reduce((a, n) => a + n.monto, 0);
      const t = deC.filter((n) => n.meta.estado_pago !== "EXCLUIDO_INVITADO").reduce((a, n) => a + n.monto, 0);
      if (Math.abs(p - c.confirmado) >= 1 || Math.abs(t - c.techo) >= 1) {
        console.log(`  ${c.id}: confirmado ${fmt(p)} contra ${fmt(c.confirmado)}; techo ${fmt(t)} contra ${fmt(c.techo)}`);
      }
    }

    // Una factura FAN puede cubrir varios cupos de una empresa (Atera: 4 cupos,
    // una factura). En empresas o personas distintas, casi seguro es un error.
    const porFactura = new Map<string, Set<string>>();
    for (const n of negocios) {
      if (!n.factura) continue;
      const quien = n.grupoEmpresa ?? n.contacto ?? n.llave;
      porFactura.set(n.factura, (porFactura.get(n.factura) ?? new Set()).add(quien));
    }
    for (const [fan, quienes] of porFactura) {
      if (quienes.size < 2) continue;
      const nombres = [...quienes].map((q) => empresas.get(q)?.nombre ?? contactos.get(q)?.nombre ?? q);
      revision.push({ motivo: "Factura en varios clientes", detalle: `${fan}: ${nombres.join(" | ")}`, origen: "facturas" });
    }

    console.log("\n── Pendientes");
    console.log(`  ${negocios.filter((n) => n.tarea).length + tareasSueltas.filter((t) => t.negocio).length} ligados a negocios, ${tareasSueltas.filter((t) => !t.negocio).length} sueltos, todos para hoy a nombre de Ricardo`);
    if (ligadosAParticipante.length) {
      console.log("  Del pipeline, colgados del negocio que ya tenían en su cohorte (no se crea otra venta):");
      for (const l of ligadosAParticipante) console.log(`    ${l}`);
    }

    console.log("\n── Datos sensibles");
    console.log(`  texto_original: no se lee. Números largos omitidos en otros textos: ${numerosOmitidos()}`);

    if (duplicadosEnArchivo.length) {
      console.log(`\n── Filas repetidas en el archivo (se importan una sola vez): ${duplicadosEnArchivo.length}`);
      for (const d of duplicadosEnArchivo) console.log(`  ${d}`);
    }
    if (avisos.length) {
      console.log("\n── Avisos");
      for (const a of avisos) console.log(`  ${a}`);
    }
    console.log(`\n── Para revisión manual: ${revision.length}`);
    for (const r of revision) console.log(`  [${r.motivo}] ${r.detalle}  (${r.origen})`);
    const rutaRevision = join(dir, "revision-manual.csv");
    writeFileSync(rutaRevision, Papa.unparse(revision.map((r) => ({ motivo: r.motivo, detalle: r.detalle, origen: r.origen }))));
    console.log(`  Lista completa en ${rutaRevision}`);

    if (dryRun) {
      console.log("\nSimulación terminada. No se escribió nada en la base.\n");
      return;
    }

    // ───────── Escritura, en una sola transaccion ─────────
    await db.transaction(async (tx) => {
      const t = tx as unknown as ScriptDb;
      const ahora = new Date();

      for (const c of cohortes.values()) {
        await t
          .insert(s.cohorts)
          .values({
            id: c.id,
            name: c.nombre,
            productId: c.productoId,
            productLabel: c.productoTexto,
            city: c.ciudad,
            startsOn: c.fecha,
            dateApproximate: c.aproximada,
            netPrice: c.precio?.toFixed(2) ?? null,
            counts: c.conteos,
            confirmedRevenue: c.confirmado.toFixed(2),
            ceilingRevenue: c.techo.toFixed(2),
            notes: c.notas,
          })
          .onConflictDoNothing();
      }

      for (const e of empresasFinales) {
        if (e.existenteId) {
          e.id = e.existenteId;
          continue;
        }
        const [row] = await t
          .insert(s.companies)
          .values({
            name: e.nombre,
            domain: e.dominio,
            website: e.dominio ? `https://${e.dominio}` : null,
            country: "Colombia",
            responsibleId: ricardo.id,
            createdBy: ricardo.id,
            notes: "Importada del tracking de bootcamps y diplomados 2026.",
          })
          .returning({ id: s.companies.id });
        e.id = row!.id;
      }
      const idEmpresa = (g: string | null) => (g ? (empresas.get(g)?.id ?? null) : null);

      for (const c of contactos.values()) {
        if (c.existenteId) {
          c.id = c.existenteId;
          continue;
        }
        const empresaId = idEmpresa(c.grupoEmpresa);
        const [row] = await t
          .insert(s.contacts)
          .values({
            fullName: c.nombre,
            email: c.email,
            emailNormalized: c.email,
            phone: c.telefono ? `+${c.telefono}` : null,
            phoneNormalized: c.telefono,
            companyId: empresaId,
            position: c.cargo,
            city: c.ciudad,
            country: "Colombia",
            segment: (empresaId ? "b2b" : "b2c") as Segment,
            interestProductId: c.productoInteres,
            responsibleId: ricardo.id,
            status: c.estado,
            notes: c.notaExtra ?? null,
            externalKey: c.llave,
            createdBy: ricardo.id,
          })
          .onConflictDoNothing()
          .returning({ id: s.contacts.id });
        if (row) c.id = row.id;
        else {
          const [prev] = await t.select({ id: s.contacts.id }).from(s.contacts).where(eq(s.contacts.externalKey, c.llave)).limit(1);
          c.id = prev!.id;
        }
        if (empresaId) {
          await t.insert(s.companyContacts).values({ companyId: empresaId, contactId: c.id!, isPrimary: true }).onConflictDoNothing();
        }
      }
      const idContacto = (k: string | null) => (k ? (contactos.get(k)?.id ?? null) : null);

      const idNegocio = new Map<string, string>();
      for (const n of nuevos) {
        const contactId = idContacto(n.contacto);
        const companyId = idEmpresa(n.grupoEmpresa);
        const cierre = n.cerradoEn ? alMediodia(n.cerradoEn) : null;
        const [opp] = await t
          .insert(s.opportunities)
          .values({
            name: n.nombre,
            contactId,
            companyId,
            segment: companyId ? "b2b" : "b2c",
            productId: n.productoId,
            amount: n.monto.toFixed(2),
            currency: n.moneda,
            taxRate: "0",
            requiresInvoice: !!n.factura,
            stage: n.etapa,
            stageChangedAt: cierre ?? ahora,
            probability: n.probabilidad,
            expectedCloseOn: n.cerradoEn,
            responsibleId: ricardo.id,
            proposalStatus: n.propuesta,
            billingStatus: n.factura ? "emitida" : "no-requiere",
            paymentStatus: n.estadoPago,
            deliveryStatus: n.entrega,
            lostReason: n.motivoPerdida,
            closedAt: n.etapa === "ganado" || n.etapa === "perdido" ? cierre : null,
            lastInteractionAt: alMediodia(n.eventoFecha),
            cohortId: n.cohorteId,
            externalKey: n.llave,
            importMeta: n.meta,
            notes: n.notas ?? null,
            createdBy: ricardo.id,
          })
          .onConflictDoNothing()
          .returning({ id: s.opportunities.id });
        if (!opp) continue; // otra corrida lo creo entre la lectura y la escritura
        idNegocio.set(n.llave, opp.id);

        if (n.pago) {
          await t.insert(s.payments).values({
            opportunityId: opp.id,
            contactId,
            companyId,
            amount: n.pago.monto.toFixed(2),
            currency: n.moneda,
            expectedOn: n.pago.fecha,
            paidOn: n.pago.estado === "pagado" ? n.pago.fecha : null,
            method: n.pago.metodo,
            reference: n.pago.referencia,
            status: n.pago.estado,
            notes: n.pago.notas,
            createdBy: ricardo.id,
          });
        }

        await t
          .insert(s.interactions)
          .values({
            kind: n.pago?.estado === "pagado" ? "pago" : "estado",
            title: n.evento,
            body: n.pago?.estado === "pagado" ? [n.pago.metodo, n.pago.referencia].filter(Boolean).join(" · ") : null,
            amount: n.monto.toFixed(2),
            currency: n.moneda,
            occurredAt: alMediodia(n.eventoFecha),
            contactId,
            companyId,
            opportunityId: opp.id,
            userId: ricardo.id,
            externalId: `import:${n.llave}`,
          })
          .onConflictDoNothing();

        if (n.tarea) {
          await t
            .insert(s.tasks)
            .values({
              title: n.tarea.titulo,
              kind: n.tarea.tipo,
              dueAt: alCierre(hoy),
              contactId,
              companyId,
              opportunityId: opp.id,
              responsibleId: ricardo.id,
              autoKey: n.tarea.llave,
              createdBy: ricardo.id,
            })
            .onConflictDoNothing();
        }
      }

      // Cobros colgados de un negocio de participante que ya se habia importado.
      for (const n of negocios.filter((x) => yaNegocios.has(x.llave) && x.tarea)) {
        const [opp] = await t.select({ id: s.opportunities.id, contactId: s.opportunities.contactId, companyId: s.opportunities.companyId }).from(s.opportunities).where(eq(s.opportunities.externalKey, n.llave)).limit(1);
        if (!opp) continue;
        await t
          .insert(s.tasks)
          .values({
            title: n.tarea!.titulo,
            kind: n.tarea!.tipo,
            dueAt: alCierre(hoy),
            contactId: opp.contactId,
            companyId: opp.companyId,
            opportunityId: opp.id,
            responsibleId: ricardo.id,
            autoKey: n.tarea!.llave,
            createdBy: ricardo.id,
          })
          .onConflictDoNothing();
      }

      for (const ts of tareasSueltas) {
        let opportunityId: string | null = null;
        if (ts.negocio) {
          opportunityId = idNegocio.get(ts.negocio) ?? null;
          if (!opportunityId) {
            const [prev] = await t.select({ id: s.opportunities.id }).from(s.opportunities).where(eq(s.opportunities.externalKey, ts.negocio)).limit(1);
            opportunityId = prev?.id ?? null;
          }
        }
        await t
          .insert(s.tasks)
          .values({
            title: ts.titulo,
            kind: ts.tipo,
            dueAt: alCierre(hoy),
            contactId: idContacto(ts.contacto),
            companyId: idEmpresa(ts.grupoEmpresa),
            opportunityId,
            responsibleId: ricardo.id,
            autoKey: ts.llave,
            createdBy: ricardo.id,
          })
          .onConflictDoNothing();
      }

      await t.insert(s.importBatches).values({
        userId: ricardo.id,
        filename: "crm-import-2026-09-23",
        entity: "cohortes-participantes-pipeline",
        imported: nuevos.length,
        duplicates: negocios.length - nuevos.length + duplicadosEnArchivo.length,
        errors: 0,
        log: revision.map((r, i) => ({ row: i + 1, status: r.motivo, detail: `${r.detalle} (${r.origen})` })),
      });
    });

    // ───────── Verificacion contra la base ─────────
    const verif = await db
      .select({
        etapa: s.opportunities.stage,
        pago: s.opportunities.paymentStatus,
        n: sql<number>`count(*)::int`,
        monto: sql<string>`coalesce(sum(${s.opportunities.amount}) filter (where ${s.opportunities.currency} = 'COP'), 0)`,
      })
      .from(s.opportunities)
      .where(and(like(s.opportunities.externalKey, `${PREFIJO}:%`), isNull(s.opportunities.deletedAt)))
      .groupBy(s.opportunities.stage, s.opportunities.paymentStatus);
    console.log("\n── Verificación en la base (todo lo importado con este script)");
    for (const v of verif) console.log(`  ${v.etapa.padEnd(24)} ${v.pago.padEnd(16)} ${String(v.n).padStart(4)}   ${fmt(Number(v.monto))}`);
    const [pag] = await db
      .select({ total: sql<string>`coalesce(sum(${s.payments.amount}), 0)` })
      .from(s.payments)
      .innerJoin(s.opportunities, eq(s.payments.opportunityId, s.opportunities.id))
      .where(and(like(s.opportunities.externalKey, `${PREFIJO}:%:%`), sql`${s.payments.paidOn} is not null`, sql`${s.opportunities.cohortId} is not null`));
    console.log(`  Pagos registrados de participantes: ${fmt(Number(pag?.total ?? 0))}   (esperado ${fmt(esperadoPagado)}: ${ok(Number(pag?.total ?? 0), esperadoPagado)})`);
    console.log("\nImportación terminada.\n");
  } finally {
    await close();
  }
}

/** Una celda que es un telefono y no un nombre ("314 6483574", "tel 593 995983672"). */
function pareceTelefono(texto: string): boolean {
  const t = texto.trim().replace(/^(tel[eé]fono|tel|cel(ular)?|whatsapp|wa)[\s.:]*/i, "");
  return /^[\d\s+().-]+$/.test(t) && t.replace(/\D/g, "").length >= 7;
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const HANDLE_RE = /(?<![\w.])@[A-Za-z0-9_.]+/g;

/** Familia de producto, para no colgar un cobro del Diplomado de un bootcamp. */
function familia(texto: string): "diplomado" | "bootcamp" | "inhouse" | null {
  const t = claveColumna(texto);
  if (/diplomado/.test(t)) return "diplomado";
  if (/in_?house/.test(t)) return "inhouse";
  if (/bootcamp|abierto|value/.test(t)) return "bootcamp";
  return null;
}

/** "juan.castrillon@..." → "Juan Castrillon". Un buzon generico no da nombre. */
function nombreDesdeEmail(email: string): string | null {
  const local = email.split("@")[0]!;
  return /^[a-z]+[._][a-z]+$/.test(local) ? titleCase(local.replace(/[._]/g, " ")) : null;
}

type FilaPipeline = {
  tipo: string;
  nombre: string;
  empresa: string | null;
  personas: string[];
  emails: string[];
  handles: string[];
  telefonos: string[];
  producto: string;
  piezas: string[];
};

/**
 * El pipeline mezcla en una columna empresas y personas ("Comfama", "Lina
 * Franco", "Juan (correo@gmail.com)") y en otra contactos, correos y handles.
 * Aqui se separa cada cosa. La regla: en in-house y oportunidades la primera
 * columna es la empresa; en cobros y servicios lo es solo si la segunda trae a
 * otra persona y la primera no es un correo personal.
 */
function leerFilaPipeline(f: Fila, Q: Record<string, string | null>): FilaPipeline {
  const tipo = val(f, Q.tipo);
  const tk = claveColumna(tipo).replace(/_/g, "");
  const a = val(f, Q.nombre);
  const b = val(f, Q.contacto);
  const emails = [...new Set([a, b, val(f, Q.email)].join(" ").match(EMAIL_RE) ?? [])].map((e) => e.toLowerCase());
  const handles = [...new Set(b.match(HANDLE_RE) ?? [])];
  const limpiar = (t: string) =>
    t.replace(EMAIL_RE, "").replace(HANDLE_RE, "").replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  const aLimpio = limpiar(a);
  const bLimpio = limpiar(b);
  const producto = val(f, Q.producto);
  const telefonos = val(f, Q.telefono) ? [val(f, Q.telefono)] : [];

  if (tk === "leads" || tk === "lead") {
    const piezas = b.split(/;|\n/).map((x) => x.trim()).filter(Boolean);
    return { tipo, nombre: aLimpio || a, empresa: null, personas: [], emails, handles, telefonos, producto, piezas };
  }

  const personalEnA = (a.match(EMAIL_RE) ?? []).some((e) => !dominioCorporativo(e.toLowerCase()));
  const mismaPersona = !!bLimpio && companyKey(bLimpio) === companyKey(aLimpio);
  let empresa: string | null = val(f, Q.empresa) || null;
  if (!empresa) {
    if (tk === "inhouse" || tk === "oportunidad") empresa = aLimpio || null;
    else if (bLimpio && !mismaPersona && !personalEnA) empresa = aLimpio || null;
  }
  let personas: string[];
  if (bLimpio && !mismaPersona) personas = bLimpio.split(/\s*\/\s*|;/).map((x) => x.trim()).filter(Boolean);
  else if (empresa && companyKey(empresa) === companyKey(aLimpio)) personas = [];
  else personas = /^sin identificar/i.test(aLimpio) || !aLimpio ? [] : [aLimpio];

  return { tipo, nombre: aLimpio || a, empresa, personas, emails, handles, telefonos, producto, piezas: [] };
}

main().catch((err) => {
  console.error(`\n${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
