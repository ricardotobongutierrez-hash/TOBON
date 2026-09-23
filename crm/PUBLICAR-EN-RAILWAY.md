# Cómo poner el CRM en internet para los tres

Hoy el CRM vive en tu Mac y solo tú lo ves. Para que tu papá y tu tío entren
desde su computador o su celular, se monta en dos servicios:

| Servicio | Qué hace | Costo |
|---|---|---|
| **Supabase** | Guarda la base de datos y los documentos | Gratis para este tamaño |
| **Railway** | Corre la aplicación y le da una dirección web | USD 5 al mes |

El plan Hobby de Railway cuesta USD 5 al mes e incluye USD 5 de consumo. Un
CRM de tres personas normalmente cabe ahí. Si algún mes se pasa, Railway cobra
la diferencia y te lo muestra en **Usage**.

Solo tú necesitas cuenta en estos servicios. Tu papá y tu tío entran al CRM con
su correo y su clave, sin cuenta en ningún lado.

La primera vez toma unos 30 minutos. Después, cada cambio que se sube a GitHub
se publica solo.

---

## Paso 1. La base de datos en Supabase

1. Entra a <https://supabase.com> y crea una cuenta (puedes entrar con GitHub).
2. **New project.** Nombre: `jit-crm`. Región: la más cercana a Colombia que
   aparezca (East US sirve).
3. En **Database Password** inventa una clave **solo con letras y números**,
   sin símbolos. Los símbolos dañan la dirección de conexión. Guárdala.
4. Espera a que el proyecto termine de crearse.
5. Arriba, botón **Connect**. Copia la dirección del **Session pooler** (termina
   en `:5432/postgres`) y cambia `[YOUR-PASSWORD]` por la clave del punto 3.

   Esa dirección es la única que vas a usar, tanto desde tu Mac como en Railway.
   De aquí en adelante la llamamos **la dirección de la base**.

## Paso 2. Crear las tablas y las cuentas desde tu Mac

Primero trae la última versión del código:

```bash
cd ~/Documents/TOBON
git pull
cd crm
npm install
```

Crea las tablas. Pega la dirección de la base entre las comillas:

```bash
DATABASE_URL='pega-aquí-la-dirección-de-la-base' npm run db:migrate
```

Y siembra lo real de la firma: las tres cuentas, el tarifario, las etapas del
pipeline y las fuentes. **Sin datos de demostración.** Inventa una contraseña
inicial larga. No uses `TobonCRM2026`, que está escrita en el repositorio:

```bash
DATABASE_URL='pega-aquí-la-dirección-de-la-base' SEED_DEMO=false SEED_PASSWORD='una-clave-larga-que-inventes' npm run db:seed
```

Tiene que terminar diciendo `demo omitido (SEED_DEMO=false)` y `Usuarios creados`.

## Paso 3. El espacio para los documentos

Las propuestas, facturas y archivos que se suben al CRM van a Supabase:

1. En Supabase, menú **Storage**, **New bucket**. Nombre: `jit-crm`.
   **Déjalo privado** (Public bucket apagado).
2. Menú **Project Settings → API Keys**. Copia la **secret key** (empieza por
   `sb_secret_`). Si solo ves la pestaña de llaves antiguas, sirve la
   `service_role`. Esta llave abre todo: no la pegues en ningún chat ni correo.
3. Copia también la **Project URL** (`https://algo.supabase.co`). Sale en
   **Project Settings** y en el botón **Connect**.

## Paso 4. Preparar las variables

En la Terminal, este comando arma el bloque de variables con las llaves nuevas
ya generadas y lo deja copiado, listo para pegar:

```bash
cat <<EOF | pbcopy
DATABASE_URL=pega-aquí-la-dirección-de-la-base
DATABASE_POOL_MAX=5
AUTH_SECRET=$(openssl rand -base64 48)
ENCRYPTION_KEY=$(openssl rand -base64 48)
SUPABASE_URL=pega-aquí-la-project-url
SUPABASE_SERVICE_ROLE_KEY=pega-aquí-la-secret-key
SUPABASE_STORAGE_BUCKET=jit-crm
EOF
```

No imprime nada: el bloque queda en el portapapeles. Lo pegas en el paso 5.

## Paso 5. Publicar en Railway

1. Entra a <https://railway.com> con tu cuenta de GitHub y activa el plan
   **Hobby**.
2. **New Project → Deploy from GitHub repo** y escoge `TOBON`. Si no aparece,
   dale permiso a Railway sobre ese repositorio en el enlace que ofrece ahí
   mismo.
3. Railway crea el servicio e intenta publicarlo de una. Ese primer intento
   falla porque todavía no sabe dónde está el CRM. Es normal.
4. Entra al servicio, pestaña **Settings**:
   - **Source → Root Directory:** escribe `/crm`. El repositorio tiene dos
     proyectos y el CRM es esa carpeta.
   - **Source → Branch:** `claude/nifty-ramanujan-iwbl6f`, que es donde está el
     código. Si después unes esa rama a `main`, la cambias aquí.
5. Pestaña **Variables → Raw Editor.** Pega el bloque del paso 4 (Cmd + V) y
   reemplaza los tres `pega-aquí` por lo que copiaste de Supabase. **Update
   Variables.**
6. Pestaña **Settings → Networking → Generate Domain.** Te da una dirección
   como `tobon-production.up.railway.app`. Si te pregunta el puerto, déjale el
   que propone.
7. Vuelve a **Variables**, agrega una más y guarda:
   ```
   APP_URL=https://la-dirección-que-te-dio-railway
   ```
8. Railway vuelve a publicar solo cada vez que cambias variables. Espera a que
   el despliegue quede en verde (**Active**) y abre la dirección.

## Paso 6. Darle la entrada a tu papá y a tu tío

1. Entra tú primero con `ricardo.tobon@joseitobon.com` y la contraseña que
   inventaste en el paso 2.
2. Ve a **Ajustes → Mi cuenta** y cambia tu clave.
3. Mándales a cada uno, **por WhatsApp o en persona, no por correo**:
   - la dirección del CRM,
   - su correo: `director@joseitobon.com` y `carlos.tobon@joseitobon.com`,
   - la contraseña inicial del paso 2.
4. Diles que al entrar vayan a **Ajustes → Mi cuenta** y pongan su propia clave.
   El sistema les muestra el aviso, pero no los obliga.

Funciona igual en el celular. En el iPhone, desde Safari, **Compartir → Agregar
a pantalla de inicio** y queda como una aplicación más.

Los tres quedaron como administradores. Si alguno debe ver pero no configurar,
en **Ajustes → Usuarios** se cambia a **Equipo**.

## Si alguien se queda afuera

Después de cinco claves equivocadas seguidas, la cuenta queda en pausa quince
minutos. Es a propósito: el CRM está en internet y así nadie puede probar
claves sin parar. Si fue alguno de ustedes, un administrador entra a
**Ajustes → Usuarios → Restablecer clave**, le pone una nueva y la pausa se
levanta en ese momento.

## Lo que se hace solo

- **Cada hora** el CRM revisa vencimientos: marca pagos y facturas vencidos y
  propuestas que pasaron su fecha, y crea el pendiente de cobro. Así el Inicio
  está al día aunque nadie haya entrado.
- Esa misma revisión mantiene despierta la base de Supabase, que en el plan
  gratis se pausa si pasa una semana sin uso.
- Cada cambio que se sube a la rama se publica solo en Railway.

## Cuando haya cambios en el código

Railway publica solo. La única excepción: si el cambio trae un archivo nuevo en
`crm/drizzle/`, la base necesita ponerse al día. Corre esto una vez desde tu
Mac:

```bash
cd ~/Documents/TOBON && git pull && cd crm
DATABASE_URL='pega-aquí-la-dirección-de-la-base' npm run db:migrate
```

## Tu propio dominio (opcional)

Para que quede en `crm.joseitobon.com`: en Railway, **Settings → Networking →
Custom Domain**, escribe el dominio y Railway te dice qué registro poner donde
administras el dominio de la firma. Después cambia `APP_URL` a la dirección
nueva.

## Lo que todavía no funciona en línea

- **Conectar el Gmail.** Necesita credenciales de Google Cloud. Los pasos están
  en `docs/correo-gmail.md`. Sin eso, la pantalla de correo lo dice y el resto
  del CRM funciona igual.
- **Benjamín.** Cuando esté listo, se le da la dirección del CRM y una clave
  compartida (`CRM_INGEST_SECRET`). La guía está en `docs/agente-whatsapp.md`.
- **Verificación en dos pasos.** No existe todavía. Por eso importan las claves
  largas y que cada uno tenga la suya.

## Si algo falla

En Railway, pestaña **Deployments**, el despliegue que falló tiene un botón
**View logs**. Copia las últimas líneas y pásamelas. Los casos que ya se conocen:

- **`Falta DATABASE_URL`** → la variable no quedó guardada. Revisa **Variables**.
- **`No start command could be found`** o no encuentra `package.json` → falta
  el `/crm` en **Root Directory**.
- **La pantalla de ingreso no acepta la clave** → el paso 2 se corrió contra
  otra base. Confirma que Railway y tu Mac usen la misma dirección de la base.
- **`password authentication failed`** → la clave de la base tiene símbolos o
  quedó `[YOUR-PASSWORD]` sin cambiar. En Supabase, **Database → Settings →
  Reset database password**, pon una solo con letras y números y actualiza la
  dirección en Railway y en tus comandos.
- **`max clients reached`** → baja `DATABASE_POOL_MAX` a 3.
- **Error al subir un documento** → revisa `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` y que el bucket se llame exactamente `jit-crm`.

---

Si algún día prefieren Vercel en vez de Railway, la guía está en
`DESPLEGAR-EN-VERCEL.md`. Cuesta USD 20 al mes, porque el plan gratis de
Vercel no permite uso comercial.
