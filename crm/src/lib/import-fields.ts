import { foldCase } from "./utils";

/**
 * Vocabulario de la importacion. Vive aparte de las acciones del servidor porque
 * un archivo "use server" solo puede exportar funciones asincronas.
 */
export type ImportField =
  | "nombre"
  | "telefono"
  | "correo"
  | "empresa"
  | "cargo"
  | "ciudad"
  | "pais"
  | "tipo"
  | "fuente"
  | "campana"
  | "producto"
  | "notas"
  | "estado"
  | "sitioWeb"
  | "sector"
  | "ignorar";

export const FIELD_LABEL: Record<ImportField, string> = {
  nombre: "Nombre",
  telefono: "Teléfono o WhatsApp",
  correo: "Correo",
  empresa: "Empresa",
  cargo: "Cargo",
  ciudad: "Ciudad",
  pais: "País",
  tipo: "B2B o B2C",
  fuente: "De dónde salió",
  campana: "Campaña",
  producto: "Producto de interes",
  notas: "Notas",
  estado: "Estado",
  sitioWeb: "Sitio web",
  sector: "Sector",
  ignorar: "No importar esta columna",
};

export const IMPORT_FIELDS: ImportField[] = [
  "nombre",
  "telefono",
  "correo",
  "empresa",
  "cargo",
  "ciudad",
  "pais",
  "tipo",
  "fuente",
  "campana",
  "producto",
  "sitioWeb",
  "sector",
  "notas",
  "estado",
  "ignorar",
];

/** Encabezados que se reconocen solos, en espanol y en ingles. */
const ALIASES: Record<Exclude<ImportField, "ignorar">, string[]> = {
  nombre: ["nombre completo", "nombre", "nombres", "full name", "fullname", "name", "contacto", "contact"],
  telefono: ["telefono", "celular", "movil", "whatsapp", "phone", "mobile", "cel", "tel"],
  correo: ["correo electrónico", "correo", "email", "e-mail", "mail"],
  empresa: ["empresa", "compania", "company", "organizacion", "organization", "cliente", "account"],
  cargo: ["cargo", "puesto", "position", "job title", "title", "rol"],
  ciudad: ["ciudad", "city", "municipio"],
  pais: ["pais", "country"],
  tipo: ["tipo", "segmento", "b2b", "b2c", "type", "segment"],
  fuente: ["de donde salió", "fuente", "origen", "lead source", "source", "canal"],
  campana: ["campaña publicitaria", "campana", "campaign", "utm campaign"],
  producto: ["interesado en", "producto", "servicio", "interes", "product", "interest"],
  notas: ["observaciones", "comentarios", "notas", "nota", "notes", "comments"],
  estado: ["estado", "status", "etapa", "lifecycle"],
  sitioWeb: ["sitio web", "página web", "website", "web", "url"],
  sector: ["sector", "industria", "industry"],
};

/**
 * Empareja un encabezado con un campo del CRM. Los alias se comparan del mas
 * largo al mas corto para que "nombre completo" no gane "nombre" por accidente.
 */
export function guessField(header: string): ImportField {
  const key = foldCase(header);
  if (!key) return "ignorar";
  for (const [field, aliases] of Object.entries(ALIASES) as [Exclude<ImportField, "ignorar">, string[]][]) {
    if (aliases.some((alias) => key === alias)) return field;
  }
  for (const [field, aliases] of Object.entries(ALIASES) as [Exclude<ImportField, "ignorar">, string[]][]) {
    if (aliases.some((alias) => key.includes(alias))) return field;
  }
  return "ignorar";
}
