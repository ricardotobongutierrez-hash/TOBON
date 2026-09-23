"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  campaigns,
  companies,
  contacts,
  interactions,
  invoices,
  leadSources,
  opportunities,
  payments,
  pipelineStages,
  products,
  proposals,
  serviceDeliveries,
  tasks,
  users,
} from "@/db/schema";
import { CURRENCIES, PRODUCT_CATEGORIES, ROLES } from "@/db/enums";
import { hashPassword, requireRole, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  DEFAULT_FINANCE,
  DEFAULT_FOLLOWUP,
  financeSettings,
  followUpSettings,
  writeSetting,
} from "@/lib/settings";
import { parseMoneyInput, toMoneyString } from "@/lib/money";
import { slugify } from "@/lib/utils";
import { explain, fail, ok, type Result } from "./_result";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

// ───────────────────────── Mi cuenta ─────────────────────────

export async function updateProfile(formData: FormData): Promise<Result> {
  try {
    const me = await requireUser();
    const name = String(formData.get("name") ?? "").trim();
    if (name.length < 3) return fail("Escribe tu nombre completo");
    const db = await getDb();
    await db
      .update(users)
      .set({
        name,
        phone: (formData.get("phone") as string) || null,
        photoUrl: (formData.get("photoUrl") as string) || null,
        notifyPrefs: {
          resumenDiario: formData.get("resumenDiario") === "on",
          vencidos: formData.get("vencidos") === "on",
          pagos: formData.get("pagos") === "on",
        },
        updatedAt: new Date(),
      })
      .where(eq(users.id, me.id));
    revalidatePath("/ajustes/mi-cuenta");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

// ───────────────────────── Usuarios ─────────────────────────

const userSchema = z.object({
  name: z.string().trim().min(3, "Escribe el nombre completo"),
  email: z.string().trim().email("Ese correo no parece valido"),
  role: z.enum(ROLES).default("equipo"),
  password: z.string().min(8, "La contraseña necesita al menos 8 caracteres"),
});

export async function createUser(formData: FormData): Promise<Result> {
  try {
    const me = await requireRole("admin");
    const parsed = userSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
    const d = parsed.data;
    const db = await getDb();

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, d.email.toLowerCase()))
      .limit(1);
    if (existing) return fail("Ya existe un usuario con ese correo");

    const [row] = await db
      .insert(users)
      .values({
        name: d.name,
        email: d.email.toLowerCase(),
        role: d.role,
        passwordHash: await hashPassword(d.password),
        // La persona cambia la clave en su primer ingreso.
        mustChangePassword: true,
      })
      .returning({ id: users.id });

    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "crear",
      entityType: "usuario",
      entityId: row!.id,
      summary: `Creo el usuario ${d.name} (${d.role})`,
    });
    revalidatePath("/ajustes/usuarios");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function updateUser(id: string, formData: FormData): Promise<Result> {
  try {
    const me = await requireRole("admin");
    const db = await getDb();
    const name = String(formData.get("name") ?? "").trim();
    const role = String(formData.get("role") ?? "equipo");
    const active = formData.get("active") === "on";

    const [before] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!before) return fail("Ese usuario ya no existe");

    // No se puede quedar el sistema sin ningun administrador activo.
    if ((before.role === "admin" && role !== "admin") || (before.active && !active && before.role === "admin")) {
      const [others] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.role, "admin"), eq(users.active, true), ne(users.id, id), isNull(users.deletedAt)));
      if ((others?.n ?? 0) === 0) {
        return fail("Tiene que quedar al menos un administrador activo.");
      }
    }

    await db
      .update(users)
      .set({ name, role: role as "admin", active, updatedAt: new Date() })
      .where(eq(users.id, id));

    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "actualizar",
      entityType: "usuario",
      entityId: id,
      summary: `Actualizo el usuario ${name}`,
      changes: [
        ...(before.role !== role ? [{ field: "Rol", from: before.role, to: role }] : []),
        ...(before.active !== active
          ? [{ field: "Activo", from: String(before.active), to: String(active) }]
          : []),
      ],
    });
    revalidatePath("/ajustes/usuarios");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function resetUserPassword(id: string, password: string): Promise<Result> {
  try {
    const me = await requireRole("admin");
    if (password.length < 8) return fail("La contraseña necesita al menos 8 caracteres");
    const db = await getDb();
    await db
      .update(users)
      .set({
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
        // Restablecer la clave tambien levanta la pausa por intentos fallidos:
        // es la salida del administrador cuando alguien se queda afuera.
        failedLogins: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "actualizar",
      entityType: "usuario",
      entityId: id,
      summary: "Restablecio la contraseña de un usuario",
    });
    revalidatePath("/ajustes/usuarios");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

// ───────────────────── Productos y servicios ─────────────────────

const productSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del producto"),
  category: z.enum(PRODUCT_CATEGORIES).default("otro"),
  audience: z.enum(["b2b", "b2c", "ambos"]).default("ambos"),
  description: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  defaultPrice: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  currency: z.enum(CURRENCIES).default("COP"),
  unit: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  taxable: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(true),
  promoPrice: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  promoLabel: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  promoEndsOn: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  active: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(true),
});

export async function saveProduct(id: string | null, formData: FormData): Promise<Result> {
  try {
    const me = await requireRole("admin");
    const parsed = productSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
    const d = parsed.data;
    const db = await getDb();

    const values = {
      name: d.name,
      category: d.category,
      audience: d.audience,
      description: d.description ?? null,
      defaultPrice: d.defaultPrice ? toMoneyString(parseMoneyInput(d.defaultPrice)) : null,
      currency: d.currency,
      unit: d.unit ?? null,
      taxable: d.taxable,
      promoPrice: d.promoPrice ? toMoneyString(parseMoneyInput(d.promoPrice)) : null,
      promoLabel: d.promoLabel ?? null,
      promoEndsOn: d.promoEndsOn ?? null,
      active: d.active,
      updatedAt: new Date(),
    };

    if (id) {
      await db.update(products).set(values).where(eq(products.id, id));
    } else {
      await db.insert(products).values(values);
    }

    await logAudit({
      userId: me.id,
      userName: me.name,
      action: id ? "actualizar" : "crear",
      entityType: "producto",
      entityId: id ?? d.name,
      summary: `${id ? "Actualizó" : "Creó"} el producto ${d.name}`,
    });
    revalidatePath("/ajustes/productos");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function archiveProduct(id: string): Promise<Result> {
  try {
    const me = await requireRole("admin");
    const db = await getDb();
    await db
      .update(products)
      .set({ deletedAt: new Date(), active: false, updatedAt: new Date() })
      .where(eq(products.id, id));
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "archivar",
      entityType: "producto",
      entityId: id,
      summary: "Archivo un producto del catalogo",
    });
    revalidatePath("/ajustes/productos");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

// ───────────────────────── Pipeline ─────────────────────────

export async function saveStage(id: string | null, formData: FormData): Promise<Result> {
  try {
    await requireRole("admin");
    const name = String(formData.get("name") ?? "").trim();
    if (name.length < 2) return fail("Escribe el nombre de la etapa");
    const kind = String(formData.get("kind") ?? "activa") as "activa";
    const probability = Math.max(0, Math.min(100, Number(formData.get("probability") ?? 0)));
    const sort = Number(formData.get("sort") ?? 100);
    const active = formData.get("active") === "on";
    const db = await getDb();

    if (id) {
      await db.update(pipelineStages).set({ name, kind, probability, sort, active }).where(eq(pipelineStages.id, id));
    } else {
      const slug = slugify(name);
      const [existing] = await db
        .select({ id: pipelineStages.id })
        .from(pipelineStages)
        .where(eq(pipelineStages.slug, slug))
        .limit(1);
      if (existing) return fail("Ya existe una etapa con ese nombre");
      await db.insert(pipelineStages).values({ slug, name, kind, probability, sort, active });
    }
    revalidatePath("/ajustes/pipeline");
    revalidatePath("/negocios");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function deleteStage(id: string): Promise<Result> {
  try {
    await requireRole("admin");
    const db = await getDb();
    const [stage] = await db.select().from(pipelineStages).where(eq(pipelineStages.id, id)).limit(1);
    if (!stage) return fail("Esa etapa ya no existe");

    const [inUse] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(opportunities)
      .where(and(eq(opportunities.stage, stage.slug), isNull(opportunities.deletedAt)));
    if ((inUse?.n ?? 0) > 0) {
      return fail(
        `No se puede eliminar: hay ${inUse!.n} negocios en "${stage.name}". Muevelos primero o desactiva la etapa.`,
      );
    }
    await db.delete(pipelineStages).where(eq(pipelineStages.id, id));
    revalidatePath("/ajustes/pipeline");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

// ───────────────────── Fuentes y campanas ─────────────────────

export async function saveSource(id: string | null, formData: FormData): Promise<Result> {
  try {
    await requireRole("admin");
    const name = String(formData.get("name") ?? "").trim();
    if (name.length < 2) return fail("Escribe el nombre de la fuente");
    const active = formData.get("active") === "on";
    const db = await getDb();
    if (id) {
      await db.update(leadSources).set({ name, active }).where(eq(leadSources.id, id));
    } else {
      const slug = slugify(name);
      const [existing] = await db
        .select({ id: leadSources.id })
        .from(leadSources)
        .where(eq(leadSources.slug, slug))
        .limit(1);
      if (existing) return fail("Ya existe una fuente con ese nombre");
      await db.insert(leadSources).values({ name, slug, active });
    }
    revalidatePath("/ajustes/fuentes");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function saveCampaign(id: string | null, formData: FormData): Promise<Result> {
  try {
    await requireRole("admin");
    const name = String(formData.get("name") ?? "").trim();
    if (name.length < 2) return fail("Escribe el nombre de la campaña");
    const db = await getDb();
    const values = {
      name,
      sourceId: (formData.get("sourceId") as string) || null,
      channel: (formData.get("channel") as string) || null,
      startsOn: (formData.get("startsOn") as string) || null,
      endsOn: (formData.get("endsOn") as string) || null,
      budget: formData.get("budget") ? toMoneyString(parseMoneyInput(String(formData.get("budget")))) : null,
      currency: (formData.get("currency") as "COP") || "COP",
      active: formData.get("active") === "on",
      notes: (formData.get("notes") as string) || null,
      updatedAt: new Date(),
    };
    if (id) await db.update(campaigns).set(values).where(eq(campaigns.id, id));
    else await db.insert(campaigns).values(values);
    revalidatePath("/ajustes/campanas");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

// ───────────────── Configuracion financiera y avisos ─────────────────

export async function saveFinanceSettings(formData: FormData): Promise<Result> {
  try {
    const me = await requireRole("admin");
    const current = await financeSettings();
    const next = {
      usdRate: Number(formData.get("usdRate") ?? current.usdRate) || current.usdRate,
      ivaRate: Number(formData.get("ivaRate") ?? current.ivaRate),
      defaultPaymentTermDays: Number(formData.get("defaultPaymentTermDays") ?? current.defaultPaymentTermDays),
      invoicePrefix: String(formData.get("invoicePrefix") ?? current.invoicePrefix).trim() || "FV",
      proposalPrefix: String(formData.get("proposalPrefix") ?? current.proposalPrefix).trim() || "P",
    };
    if (next.usdRate <= 0) return fail("La tasa del dólar tiene que ser mayor que cero");
    if (next.ivaRate < 0 || next.ivaRate > 100) return fail("El IVA tiene que estar entre 0 y 100");
    await writeSetting("finanzas", next, me.id);
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "actualizar",
      entityType: "ajustes",
      entityId: "finanzas",
      summary: "Cambio la configuración financiera",
    });
    revalidatePath("/ajustes/finanzas");
    revalidatePath("/finanzas");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function saveFollowUpSettings(formData: FormData): Promise<Result> {
  try {
    const me = await requireRole("admin");
    const current = await followUpSettings();
    const next = {
      proposalFollowUpDays: Number(formData.get("proposalFollowUpDays") ?? current.proposalFollowUpDays),
      staleDays: current.staleDays,
      highValueCop: parseMoneyInput(String(formData.get("highValueCop") ?? current.highValueCop)),
    };
    if (next.proposalFollowUpDays < 1) return fail("Los días de seguimiento tienen que ser al menos 1");
    await writeSetting("seguimiento", next, me.id);
    revalidatePath("/ajustes/notificaciones");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function saveBusinessSettings(formData: FormData): Promise<Result> {
  try {
    const me = await requireRole("admin");
    await writeSetting(
      "negocio",
      {
        name: String(formData.get("name") ?? "").trim(),
        tagline: String(formData.get("tagline") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim(),
        whatsapp: String(formData.get("whatsapp") ?? "").trim(),
        website: String(formData.get("website") ?? "").trim(),
        city: String(formData.get("city") ?? "").trim(),
      },
      me.id,
    );
    revalidatePath("/ajustes");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

// ───────────────────── Datos de demostracion ─────────────────────

/**
 * Borra los datos de demostracion. Solo toca lo marcado is_demo, asi que los
 * registros reales que ya haya cargado el equipo se quedan.
 */
export async function deleteDemoData(): Promise<Result<{ borrados: number }>> {
  try {
    const me = await requireRole("admin");
    const db = await getDb();
    let total = 0;

    for (const table of [
      interactions,
      tasks,
      payments,
      invoices,
      proposals,
      serviceDeliveries,
      opportunities,
      contacts,
      companies,
    ]) {
      const deleted = await db.delete(table).where(eq(table.isDemo, true)).returning({ id: table.id });
      total += deleted.length;
    }

    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "eliminar",
      entityType: "ajustes",
      entityId: "demo",
      summary: `Elimino ${total} registros de demostracion`,
    });

    revalidatePath("/", "layout");
    return ok({ borrados: total });
  } catch (err) {
    return fail(explain(err));
  }
}

export async function demoCount(): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(companies)
    .where(eq(companies.isDemo, true));
  const [c] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(contacts)
    .where(eq(contacts.isDemo, true));
  return (row?.n ?? 0) + (c?.n ?? 0);
}
