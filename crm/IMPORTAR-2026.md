# Cargar los datos comerciales de 2026

Carga al CRM las 20 cohortes de 2026 (bootcamps abiertos y Diplomado Online),
sus participantes y el pipeline abierto, desde los CSV de
`crm-import-2026-09-23/`.

**Los CSV nunca van al repositorio.** Tienen correos y teléfonos de 612
personas. El `.gitignore` ya los bloquea.

## 1. Simulación (no escribe nada)

Detén el CRM si lo tienes abierto (Control + C en su Terminal): la base local
no admite dos programas a la vez. Después:

```bash
cd ~/Documents/TOBON && git pull && cd crm
npm install
npm run db:migrate
npm run importar:2026 -- --dir "/Users/ricardotobon/Claude/Projects/Aumentar Ventas JIT/crm-import-2026-09-23" --dry-run
```

Imprime lo que crearía: empresas, contactos, negocios por etapa, sumas por
estado de pago y el cuadre contra el archivo de cohortes. Tiene que decir
**cuadra** en las dos líneas:

```
PAID:                  COP 325.608.000   esperado COP 325.608.000   cuadra
PAID + por conciliar:  COP 744.454.000   esperado COP 744.454.000   cuadra
```

Al final lista los casos para revisión manual y los deja también en
`revision-manual.csv`, dentro de la misma carpeta de los CSV.

Si el script dice que no encuentra una columna, muestra las columnas que sí
trae el archivo. Con eso se ajusta el script en un minuto.

## 2. Importación real

La misma línea sin `--dry-run`. Todo va en una sola transacción: si algo falla,
no queda nada a medias. Al terminar vuelve a consultar la base e imprime los
totales para compararlos con la simulación.

**¿Contra qué base?**

- **Supabase (producción):** antepón la dirección de la base, como en
  `PUBLICAR-EN-RAILWAY.md`:
  `DATABASE_URL='...' npm run importar:2026 -- --dir "..."`.
- **Tu Mac:** la base local tiene datos de demostración. Bórralos antes en
  **Ajustes → Configuración financiera → Eliminar los datos de demostración**, o se mezclan con los
  reales en los reportes.

Correrlo dos veces no duplica nada: cada negocio lleva una llave (cohorte +
correo, o cohorte + hoja + fila) y lo que ya existe se salta.

## 3. Qué queda en el CRM

| En el CSV | En el CRM |
|---|---|
| Cohorte | Tabla de cohortes. Si solo trae el mes, queda el día 1 marcado como aproximado |
| PAGADO_* y CONFIRMADO_EN_LISTA | Negocio **Ganado** con su **pago registrado** (factura FAN como referencia, evidencia como nota) |
| SIN_MARCA_DE_PAGO | Negocio **Ganado** con **Pago por conciliar** |
| INTERESADO_SIN_CONFIRMAR | Negocio **Perdido**, motivo "No confirmó" |
| EXCLUIDO_INVITADO | Negocio **Ganado** por COP 0, marcado "(Invitado)" |
| EXCLUIDO_NO_ASISTE, _PAGO_2025, _RESERVA_INTERNA | Solo el contacto, si tiene correo o teléfono |
| es_placeholder = SI | "Cupo sin nombre" de la empresa, sin contacto |
| Pipeline: cobro | **Ganado con pago pendiente**: aparece en Finanzas → Por cobrar. Si la persona ya tiene su negocio de cohorte por conciliar, el cobro se cuelga de ese negocio |
| Pipeline: in-house | Propuesta enviada, o por preparar si la acción es prepararla |
| Pipeline: oportunidad | Calificado |
| Pipeline: leads | Nuevo lead, un negocio por persona |
| Pipeline: servicio | Solo un pendiente |
| siguiente_accion | Pendiente para hoy a nombre de Ricardo |
| texto_original | No se lee |

Los números de cédula o de cuenta que aparezcan en la evidencia o en la
siguiente acción se reemplazan por "[número omitido]". Las cifras de dinero y
las fechas se respetan.

## 4. Conciliar

**Finanzas → Pagos por conciliar** lista los negocios ganados sin pago
verificado, agrupados por cohorte. **Descargar para Excel** baja la lista con
dos columnas vacías, "Factura FAN" y "Referencia Bold", para cruzarla con el
reporte de Btwerp y el de Bold. Cada negocio se concilia al abrirlo y registrar
el pago: desde ese momento sale de la lista y cuenta como pagado.
