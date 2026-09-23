# CRM · JOSÉ I. TOBÓN — Expertos en Negociación

Sistema comercial interno de la firma. Contactos, empresas, negocios,
propuestas, facturas, cobros y entrega del servicio, en un solo lugar y con el
siguiente paso siempre visible.

Está pensado para tres personas que usan WhatsApp y correo todos los días, no
para expertos en CRM. Toda la complejidad vive en el software.

---

## Arrancar en local

Necesitas Node 20 o superior y, de preferencia, PostgreSQL 14 o superior.

```bash
cd crm
npm install

cp .env.example .env
# Genera el secreto de sesión y pégalo en AUTH_SECRET:
openssl rand -base64 48

npm run db:migrate    # crea las tablas
npm run db:seed       # catálogo real + datos de demostración
npm run dev
```

Abre <http://localhost:3000>.

### Sin PostgreSQL instalado

En `.env.example` la línea `DATABASE_URL` viene comentada a propósito: así la
aplicación levanta un PostgreSQL embebido (PGlite) en la carpeta `.pgdata/` y
arranca sin instalar nada. Sirve para ver el producto de una.

No lo uses para trabajar de verdad: no soporta dos procesos a la vez (el
servidor y un script se pelean el archivo) y no sobrevive bien a un cierre
abrupto. Para uso diario, un PostgreSQL de verdad.

### Primer ingreso

Las semillas crean tres cuentas con la contraseña de `SEED_PASSWORD`
(`TobonCRM2026` por defecto):

| Correo | Persona | Rol |
|---|---|---|
| `director@joseitobon.com` | José Ignacio Tobón | Administrador |
| `carlos.tobon@joseitobon.com` | Carlos Tobón | Administrador |
| `ricardo.tobon@joseitobon.com` | Ricardo Tobón | Administrador |

Los tres quedan como administradores porque son los socios. Bajar a alguno a
**Equipo** es un clic en Ajustes, Usuarios.

Las tres quedan marcadas para cambiar la contraseña en el primer ingreso.
**Cámbialas antes de usar el sistema con datos reales.**

Si corres las migraciones sin las semillas, la aplicación muestra una pantalla
de primer ingreso para crear el administrador inicial. Así no hay credenciales
escritas en el código.

---

## Qué hay adentro

### Las siete pantallas

| Pantalla | Qué responde |
|---|---|
| **Inicio** | Qué hay que hacer hoy, qué está vencido y cuánto dinero hay en juego |
| **Contactos** | Las personas, con su origen, su estado y su próxima acción |
| **Empresas** | La relación completa con cada organización |
| **Negocios** | El pipeline en tablero o lista, y todas las propuestas |
| **Pendientes** | Los seguimientos por urgencia, lo que se espera y los servicios por entregar |
| **Finanzas** | Por cobrar, vencido, pagado y facturas, con el detalle por cliente |
| **Reportes** | Resultados del período, con filtros |

Y **Ajustes**, aparte: usuarios, catálogo, pipeline, fuentes, campañas, correo,
avisos, importación y configuración financiera.

### Decisiones que definen el producto

**Los cinco ciclos de vida van separados.** Un negocio puede estar ganado, con
la propuesta aceptada, la factura emitida, el pago pendiente y el servicio sin
programar, todo al mismo tiempo. Un solo campo de estado obligaría a elegir
entre cosas que son ciertas a la vez.

**Ningún negocio activo debería existir sin próxima acción.** La aplicación lo
señala en Inicio, en el tablero y en la ficha del negocio.

**La próxima acción no es una columna.** Es el pendiente abierto más cercano. Se
deriva en un solo lugar para que el contacto y su pendiente nunca digan cosas
distintas.

**El saldo no se guarda, se calcula.** Total menos pagado. Así no existen dos
cifras del mismo dinero que se contradigan.

**El IVA del 19 % se cobra solo a quien necesita factura electrónica**, no por
ser empresa. Es una casilla en el negocio, no una regla automática.

**Una sola línea de tiempo por cliente.** WhatsApp, correos, llamadas,
reuniones, notas, propuestas, facturas, pagos y cambios de estado, en orden.
Todos los eventos se escriben en la misma tabla, así que es una consulta y no
seis uniones que se desincronizan.

**El puntaje del lead se explica.** Va de 0 a 100 y al hacer clic muestra de
dónde sale cada punto. Se puede fijar a mano.

**Cada cifra de Finanzas se abre** y muestra exactamente qué clientes la
componen.

**Lo vendido que falta entregar vive en Pendientes**, no escondido dentro de
cada negocio. Es la otra mitad de la pregunta "qué me queda por hacer".

### Reglas que corren solas

| Cuando | El sistema |
|---|---|
| Se acepta una propuesta | Marca ganado el negocio si seguía activo y crea la tarea de emitir factura |
| Se emite una factura | Registra el pago esperado y agenda el seguimiento de cobro |
| El pago queda completo | Crea el registro del servicio y la tarea de coordinarlo |
| Se envía una propuesta | Agenda el seguimiento según los días configurados |
| Pasa la fecha de un pago | Lo marca vencido y crea el pendiente de cobro |

Las tareas automáticas llevan una llave única, así que la regla no crea dos
pendientes iguales si se dispara dos veces.

---

## Estructura

```
crm/
├── src/
│   ├── app/
│   │   ├── (app)/              Las siete pantallas y Ajustes
│   │   ├── ingresar/           Inicio de sesión
│   │   ├── primer-ingreso/     Creación del primer administrador
│   │   ├── api/
│   │   │   ├── buscar/         Búsqueda universal
│   │   │   ├── archivos/[id]/  Descarga de documentos, con sesión
│   │   │   ├── exportar/       CSV de contactos, empresas y negocios
│   │   │   ├── correo/google/  OAuth de Gmail
│   │   │   └── ingesta/whatsapp/  Entrada del agente
│   │   ├── globals.css         Identidad visual y tokens de marca
│   │   └── proxy.ts            Corta el paso sin sesión antes de renderizar
│   ├── components/
│   │   ├── ui/                 Botón, tarjeta, panel, tabla, campos
│   │   ├── forms/              Los formularios del día a día
│   │   ├── shell/              Barra lateral, encabezado, navegación móvil
│   │   ├── timeline.tsx        Línea de tiempo unificada
│   │   └── lifecycles.tsx      Los cinco estados de un negocio
│   ├── db/
│   │   ├── schema.ts           27 tablas
│   │   ├── enums.ts            Vocabulario del CRM
│   │   └── client.ts           PostgreSQL o PGlite, misma API
│   ├── lib/
│   │   ├── auth.ts             Sesión por cookie firmada
│   │   ├── automation.ts       Reglas encadenadas y estado financiero
│   │   ├── scoring.ts          Puntaje explicable
│   │   ├── events.ts           Escritura en la línea de tiempo
│   │   ├── ingest.ts           Puerta del agente de WhatsApp
│   │   ├── gmail.ts            Integración de correo
│   │   ├── ai.ts               Hallazgos comerciales
│   │   └── storage.ts          Disco local o Supabase Storage
│   └── server/
│       ├── actions/            Escritura: validación, auditoría, reglas
│       └── queries/            Lectura: listas, detalle, tablero, reportes
├── drizzle/                    Migraciones SQL
├── scripts/                    migrate, seed, reset, status, dev-token
├── qa/                         Pruebas de interfaz y de flujo con navegador
├── docs/                       Guías de integración
└── public/marca/               Aquí va el logo oficial
```

### Base de datos

27 tablas con llaves foráneas, índices, marcas de tiempo, `created_by`,
`updated_by` y borrado suave donde corresponde. Los identificadores son UUID
generados en la aplicación, para que el mismo esquema corra en PostgreSQL
administrado y en PGlite sin depender de extensiones.

```
users · profiles(en users) · contacts · companies · company_contacts
products · opportunities · opportunity_products · interactions · tasks
proposals · proposal_versions · invoices · payments · service_deliveries
email_accounts · email_threads · email_messages · attachments
lead_sources · campaigns · tags · contact_tags · audit_logs
notifications · settings · pipeline_stages · import_batches
```

Comandos:

```bash
npm run db:generate   # genera el SQL tras cambiar el esquema
npm run db:migrate    # aplica las migraciones pendientes
npm run db:seed       # catálogo real + demostración (no duplica)
npm run db:reset -- --si   # borra todo y vuelve a empezar
npx tsx scripts/status.ts  # cuenta filas por tabla
```

---

## El logo

El logo oficial **no se dibuja ni se aproxima**. Copia el archivo en
`public/marca/` con uno de estos nombres:

```
logo.svg      (preferido)
logo.png      (fondo transparente)
logo.webp
```

Aparece solo en el ingreso, la barra lateral, el encabezado móvil y las
pantallas de autenticación. Mientras no exista, la aplicación compone el nombre
de la firma en tipografía. Instrucciones completas en `public/marca/LEEME.txt`.

### Paleta

| Color | Valor | Uso |
|---|---|---|
| Midnight Express | `#050834` | Navegación, títulos, autoridad |
| Mariner | `#3A63A8` | Botones, enlaces, estado activo |
| Maya Blue | `#7CB8F2` | Acentos, con moderación |
| Shuttle Grey | `#5C6972` | Tipografía secundaria |
| Light Grey | `#D5D5D5` | Bordes y fondos suaves |

Fondo blanco y hueso. No hay tablero oscuro, es a propósito.

---

## Integraciones

| Integración | Estado | Qué falta |
|---|---|---|
| **Agente de WhatsApp** | Lista | `CRM_INGEST_SECRET` en el CRM y en el agente. Ver [docs/agente-whatsapp.md](docs/agente-whatsapp.md) |
| **Google Workspace / Gmail** | Código completo | Credenciales de Google Cloud. Ver [docs/correo-gmail.md](docs/correo-gmail.md) |
| **Asistente comercial con IA** | Opcional | `ANTHROPIC_API_KEY`. Sin ella los hallazgos se calculan igual, solo falta el resumen redactado |
| **Supabase Storage** | Opcional | `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Sin ellas los archivos van al disco del servidor |
| **Avisos por correo** | Pendiente | Falta elegir proveedor de correo saliente. Las preferencias por persona ya se guardan |

Ninguna integración sin configurar rompe la aplicación. Cada pantalla afectada
dice qué falta y sigue funcionando.

---

## Variables de entorno

Están todas documentadas en `.env.example`. Las obligatorias:

| Variable | Para qué |
|---|---|
| `AUTH_SECRET` | Firma la cookie de sesión. Mínimo 24 caracteres |
| `DATABASE_URL` | PostgreSQL. Vacía usa el PostgreSQL embebido |

Las demás habilitan integraciones y son opcionales.

---

## Desplegar

### Railway con Supabase (lo recomendado)

Es lo más barato y lo más simple de operar: USD 5 al mes en Railway y Supabase
gratis. La guía paso a paso está en
[`PUBLICAR-EN-RAILWAY.md`](PUBLICAR-EN-RAILWAY.md). Lo esencial:

1. Root Directory `/crm` y la rama que corresponda.
2. `DATABASE_URL` al pooler de sesión de Supabase (puerto 5432), la misma
   dirección que se usa para migrar desde un computador. `DATABASE_POOL_MAX=5`.
3. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y un bucket privado.
4. Railway arranca con `npm start`, que respeta la variable `PORT`.
5. No hace falta cron: en un servidor que queda prendido,
   `src/instrumentation.ts` programa el barrido de mantenimiento cada hora.

### Vercel

La guía completa, paso a paso y para alguien que no vive en la terminal, está en
[`DESPLEGAR-EN-VERCEL.md`](DESPLEGAR-EN-VERCEL.md). Lo esencial:

1. Directorio raíz del proyecto: `crm`.
2. `DATABASE_URL` al pooler de transacciones de Supabase (puerto 6543). En
   producción el CRM se niega a arrancar sin ella: la base embebida escribe en
   disco y en Vercel el disco no sobrevive.
3. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y un bucket privado: el sistema
   de archivos de Vercel es efímero. Sirven la llave nueva (`sb_secret_`) y la
   antigua (`service_role`).
4. Migraciones y semilla desde un computador, contra el pooler de sesión:
   `npm run db:migrate` y `SEED_DEMO=false npm run db:seed`.
5. `CRON_SECRET` para el barrido diario que programa `vercel.json`.

El build no necesita la base: ninguna página toca PostgreSQL al compilar.

### Servidor propio o contenedor

```bash
npm ci
npm run build
npm run db:migrate
npm start
```

El almacenamiento local (`storage/`) necesita un volumen persistente. Pon
`APP_URL` con el dominio real, o el retorno de Google no va a funcionar.

---

## Antes de dar un cambio por bueno

```bash
npx tsc --noEmit                # tipos
npm run build                   # compilación de producción
npx tsx scripts/dev-token.ts    # cookie de sesión para las pruebas

QA_TOKEN=… node qa/smoke.mjs    # 20 pantallas en 4 resoluciones
QA_TOKEN=… node qa/flujos.mjs   # 29 escenarios comerciales con navegador
```

`qa/smoke.mjs` revisa cada pantalla en escritorio, portátil, tableta y móvil, y
falla si encuentra errores de consola, desplazamiento horizontal, texto que se
sale de su caja, texto recortado hasta volverse inútil, botones sin nombre
accesible o áreas de clic pequeñas en móvil.

`qa/flujos.mjs` recorre los flujos de verdad haciendo clic: crear un lead,
convertirlo en negocio, moverlo por el pipeline, enviar y aceptar la propuesta,
facturar, cobrar en dos partes, programar el servicio y cerrar un seguimiento.

---

## Limitaciones conocidas

- **Los avisos por correo no se envían todavía.** Falta configurar un proveedor
  de correo saliente. Las alertas viven donde se trabaja: los contadores de la
  barra lateral, Inicio y Pendientes.
- **La sincronización de correo se dispara a mano** desde Ajustes. Dejarla
  automática requiere un cron, explicado en `docs/correo-gmail.md`.
- **Los permisos son de dos niveles**, administrador y equipo. Todos ven la
  información comercial; el filtro "Mis pendientes" es de foco, no de seguridad.
  Para tres personas de la misma firma es lo correcto; si entra gente externa,
  hay que agregar reglas por registro.
- **El barrido de vencimientos corre al abrir la aplicación**, como máximo una
  vez cada diez minutos. En producción conviene apuntarle un cron.
- **La conversión de moneda es una referencia**, editable en Ajustes. Sirve para
  poder sumar pesos y dólares en un total, no es contabilidad.
- **La facturación es seguimiento comercial**, no reemplaza el software contable
  ni emite facturas electrónicas ante la DIAN.

## Siguientes pasos recomendados

1. Cargar el logo oficial en `public/marca/`.
2. Crear las credenciales de Google Cloud y conectar los tres correos.
3. Conectar a Benjamín con `CRM_INGEST_SECRET`, que es lo que cierra el círculo
   entre la conversación de WhatsApp y el pipeline.
4. Importar la base de contactos real y borrar los datos de demostración desde
   Ajustes, Configuración financiera.
5. Configurar el proveedor de correo saliente para el resumen diario.
6. Revisar el tarifario en Ajustes, Productos, contra el documento maestro antes
   de cotizar con el sistema.
