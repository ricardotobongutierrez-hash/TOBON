"use client";

import { useState } from "react";
import { Archive, Pencil, Plus } from "lucide-react";
import {
  CURRENCIES,
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABEL,
  type ProductCategory,
} from "@/db/enums";
import { archiveProduct, saveProduct } from "@/server/actions/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { Drawer } from "@/components/ui/drawer";
import { Checkbox, Field, FieldGrid, Input, Select, Textarea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useRun, useSubmit } from "@/lib/use-submit";
import { formatMoney, toNumber } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { groupBy } from "@/lib/utils";
import type { Product } from "@/db/schema";

export function ProductsPanel({ rows }: { rows: Product[] }) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState<Product | null>(null);
  const { run } = useRun();

  const form = useSubmit({
    action: (fd) => saveProduct(editing?.id ?? null, fd),
    success: editing ? "Producto actualizado" : "Producto creado",
    onDone: () => {
      setEditing(null);
      setCreating(false);
    },
  });

  const grouped = groupBy(rows, (r) => r.category);
  const open = creating || editing !== null;

  return (
    <>
      <div className="flex justify-end border-b border-line-soft px-4 py-3 sm:px-5">
        <Button
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
        >
          <Plus aria-hidden />
          Nuevo producto
        </Button>
      </div>

      <div className="divide-y divide-line-soft">
        {PRODUCT_CATEGORIES.filter((category) => (grouped[category] ?? []).length > 0).map((category) => (
          <section key={category}>
            <h3 className="bg-canvas px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted sm:px-5">
              {PRODUCT_CATEGORY_LABEL[category as ProductCategory]}
            </h3>
            <ul className="divide-y divide-line-soft">
              {(grouped[category] ?? []).map((product) => (
                <li key={product.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="break-anywhere text-[14px] font-medium text-ink">{product.name}</p>
                    {product.description ? (
                      <p className="clip-2 mt-0.5 text-[12px] leading-relaxed text-muted">{product.description}</p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {!product.active ? (
                        <Badge tone="gris" size="sm">
                          Inactivo
                        </Badge>
                      ) : null}
                      {product.taxable ? (
                        <Badge tone="gris" size="sm">
                          Lleva IVA con factura
                        </Badge>
                      ) : (
                        <Badge tone="gris" size="sm">
                          Sin IVA
                        </Badge>
                      )}
                      {product.unit ? (
                        <Badge tone="gris" size="sm">
                          por {product.unit}
                        </Badge>
                      ) : null}
                      {product.promoPrice ? (
                        <Badge tone="verde" size="sm">
                          {product.promoLabel ?? "Promoción"}: {formatMoney(product.promoPrice, product.currency)}
                          {product.promoEndsOn ? ` hasta ${formatDate(product.promoEndsOn)}` : ""}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tnum whitespace-nowrap text-[14px] font-semibold text-ink">
                      {product.defaultPrice
                        ? formatMoney(product.defaultPrice, product.currency)
                        : "Según alcance"}
                    </span>
                    <Button
                      variant="quiet"
                      size="icon"
                      onClick={() => {
                        setCreating(false);
                        setEditing(product);
                      }}
                      aria-label={`Editar ${product.name}`}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <Button
                      variant="quiet"
                      size="icon"
                      onClick={() => setArchiving(product)}
                      aria-label={`Archivar ${product.name}`}
                    >
                      <Archive aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <Drawer
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            setEditing(null);
            setCreating(false);
          }
        }}
        title={editing ? "Editar producto" : "Nuevo producto"}
        description="El precio que pongas aquí se sugiere al crear un negocio."
        width="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" form="producto-form" loading={form.pending}>
              Guardar
            </Button>
          </>
        }
      >
        <form id="producto-form" onSubmit={form.submit} className="space-y-4" key={editing?.id ?? "nuevo"}>
          <FormError message={form.error} />

          <Field label="Nombre" htmlFor="name" required>
            <Input id="name" name="name" defaultValue={editing?.name} required autoFocus />
          </Field>

          <FieldGrid>
            <Field label="Categoría" htmlFor="category">
              <Select id="category" name="category" defaultValue={editing?.category ?? "otro"}>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {PRODUCT_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Para quien" htmlFor="audience">
              <Select id="audience" name="audience" defaultValue={editing?.audience ?? "ambos"}>
                <option value="ambos">Empresas y personas</option>
                <option value="b2b">Solo empresas</option>
                <option value="b2c">Solo personas</option>
              </Select>
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field label="Precio" htmlFor="defaultPrice" hint="Dejalo vacio si se cotiza según alcance.">
              <Input
                id="defaultPrice"
                name="defaultPrice"
                inputMode="numeric"
                defaultValue={editing?.defaultPrice ? String(toNumber(editing.defaultPrice)) : ""}
                placeholder="15.000.000"
              />
            </Field>
            <Field label="Moneda" htmlFor="currency">
              <Select id="currency" name="currency" defaultValue={editing?.currency ?? "COP"}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldGrid>

          <Field label="Unidad" htmlFor="unit" hint="Por persona, por programa, por título.">
            <Input id="unit" name="unit" defaultValue={editing?.unit ?? ""} placeholder="persona" />
          </Field>

          <fieldset className="space-y-3 rounded-md border border-line-soft bg-canvas p-4">
            <legend className="px-1 text-[13px] font-medium text-ink">Promoción o pago anticipado</legend>
            <FieldGrid>
              <Field label="Precio promocional" htmlFor="promoPrice">
                <Input
                  id="promoPrice"
                  name="promoPrice"
                  inputMode="numeric"
                  defaultValue={editing?.promoPrice ? String(toNumber(editing.promoPrice)) : ""}
                  placeholder="3.499.000"
                />
              </Field>
              <Field label="Como se llama" htmlFor="promoLabel">
                <Input id="promoLabel" name="promoLabel" defaultValue={editing?.promoLabel ?? ""} placeholder="Pago anticipado" />
              </Field>
            </FieldGrid>
            <Field
              label="Vence el"
              htmlFor="promoEndsOn"
              hint="La fecha limite es editable a propósito: no se debe prometer una fecha sin confirmarla."
            >
              <Input id="promoEndsOn" name="promoEndsOn" type="date" defaultValue={editing?.promoEndsOn ?? ""} />
            </Field>
          </fieldset>

          <Field label="Descripción" htmlFor="description">
            <Textarea id="description" name="description" rows={3} defaultValue={editing?.description ?? ""} />
          </Field>

          <div className="space-y-2.5 rounded-md border border-line-soft bg-canvas p-4">
            <Checkbox
              label="Lleva IVA del 19 % cuando el cliente pide factura electrónica"
              name="taxable"
              defaultChecked={editing?.taxable ?? true}
            />
            <Checkbox
              label="Disponible para la venta"
              hint="Si lo desactivas deja de aparecer al crear negocios."
              name="active"
              defaultChecked={editing?.active ?? true}
            />
          </div>
        </form>
      </Drawer>

      <Confirm
        open={archiving !== null}
        onOpenChange={(v) => !v && setArchiving(null)}
        title="Archivar este producto"
        description={`${archiving?.name ?? ""} deja de aparecer al crear negocios. Los negocios que ya lo usan no cambian.`}
        confirmLabel="Archivar"
        onConfirm={async () => {
          if (archiving) await run(() => archiveProduct(archiving.id), "Producto archivado");
        }}
      />
    </>
  );
}
