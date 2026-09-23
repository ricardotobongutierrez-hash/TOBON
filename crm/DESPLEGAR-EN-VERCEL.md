# Cómo montar el CRM en internet para los tres

Hoy el CRM vive en tu Mac y solo tú lo ves. Para que tu papá y tu tío entren
desde su computador o su celular, hay que ponerlo en internet. Son dos
servicios:

| Servicio | Qué hace | Costo |
|---|---|---|
| **Vercel** | Corre la aplicación y le da una dirección web | Plan Pro, USD 20 al mes |
| **Supabase** | Guarda la base de datos y los documentos | Gratis para este tamaño |

**Sobre el costo de Vercel.** El plan gratis (Hobby) es solo para uso personal y
no comercial, según sus propios términos. Un CRM de la firma es uso comercial,
así que toca el Pro. Solo tú necesitas cuenta de Vercel: tu papá y tu tío
entran al CRM con su correo y su clave, sin cuenta en ningún lado.

La primera vez toma unos 40 minutos. Después, cada cambio que se sube a GitHub
se publica solo.

---

## Paso 1. La base de datos en Supabase

1. Entra a <https://supabase.com> y crea una cuenta (puedes entrar con GitHub).
2. **New project.** Nombre: `jit-crm`. Región: la más cercana a Colombia que
   aparezca (East US sirve).
3. En **Database Password** inventa una clave **solo con letras y números**,
   sin símbolos. Los símbolos rompen la dirección de conexión. Guárdala.
4. Espera a que el proyecto termine de crearse.
5. Arriba, botón **Connect**. Vas a necesitar dos direcciones de ahí:
   - **Transaction pooler** (termina en `:6543/postgres`). Es la que usa Vercel.
   - **Session pooler** (termina en `:5432/postgres`). Es la que usas tú desde
     el Mac para crear las tablas.

   En las dos, cambia `[YOUR-PASSWORD]` por la clave del punto 3.

## Paso 2. Crear las tablas y las cuentas desde tu Mac

Primero trae la última versión del código:

```bash
cd ~/Documents/TOBON
git pull
cd crm
npm install
```

Ahora crea las tablas en Supabase. Pega la dirección del **Session pooler**
entre las comillas:

```bash
DATABASE_URL='pega-aquí-el-session-pooler' npm run db:migrate
```

Y siembra lo real de la firma: las tres cuentas, el tarifario, las etapas del
pipeline y las fuentes. **Sin datos de demostración.** Inventa una contraseña
inicial larga, no uses la de siempre, que está escrita en el repositorio:

```bash
DATABASE_URL='pega-aquí-el-session-pooler' SEED_DEMO=false SEED_PASSWORD='una-clave-larga-que-inventes' npm run db:seed
```

Tiene que terminar diciendo `demo omitido (SEED_DEMO=false)` y `Usuarios creados`.

## Paso 3. El espacio para los documentos

Las propuestas, facturas y archivos que se suben al CRM no pueden quedar en
Vercel, porque allá el disco se borra en cada despliegue. Van a Supabase:

1. En Supabase, menú **Storage**, **New bucket**. Nombre: `jit-crm`.
   **Déjalo privado** (Public bucket apagado).
2. Menú **Project Settings → API Keys**. Copia la **secret key** (empieza por
   `sb_secret_`). Si solo ves la pestaña de llaves antiguas, sirve la
   `service_role`. Esta llave abre todo: no la pegues en ningún chat ni correo.
3. En **Project Settings** copia la **Project URL**
   (`https://algo.supabase.co`). También sale en el botón **Connect**.

## Paso 4. Las llaves de la aplicación

En la Terminal, genera tres llaves nuevas. No reutilices las de tu `.env` local:

```bash
echo "AUTH_SECRET=$(openssl rand -base64 48)"
echo "ENCRYPTION_KEY=$(openssl rand -base64 48)"
echo "CRON_SECRET=$(openssl rand -hex 32)"
```

Déjalas a la mano para el paso siguiente.

## Paso 5. Publicar en Vercel

1. Entra a <https://vercel.com> con tu cuenta de GitHub y pásate al plan Pro.
2. **Add New → Project.** Si no aparece el repositorio `TOBON`, dale permiso a
   Vercel sobre él en el enlace que ofrece ahí mismo.
3. **Importante:** en **Root Directory** escoge `crm`. El repositorio tiene dos
   proyectos y el CRM es esa carpeta.
4. Abre **Environment Variables** y carga estas:

   | Nombre | Valor |
   |---|---|
   | `DATABASE_URL` | La dirección del **Transaction pooler** (la de `:6543`) |
   | `AUTH_SECRET` | La del paso 4 |
   | `ENCRYPTION_KEY` | La del paso 4 |
   | `CRON_SECRET` | La del paso 4 |
   | `SUPABASE_URL` | La Project URL del paso 3 |
   | `SUPABASE_SERVICE_ROLE_KEY` | La secret key del paso 3 |
   | `SUPABASE_STORAGE_BUCKET` | `jit-crm` |

5. **Deploy.** Tarda un par de minutos y te da una dirección como
   `jit-crm.vercel.app`.
6. Vuelve a **Settings → Environment Variables**, agrega
   `APP_URL` con esa dirección completa (`https://jit-crm.vercel.app`) y en
   **Deployments** dale **Redeploy** al último.

### La rama

El código está en la rama `claude/nifty-ramanujan-iwbl6f`. Vercel publica como
sitio oficial solo la rama principal (`main`). Lo que venga de otra rama queda
como vista previa, y esas vistas previas le piden a quien entre una cuenta de
Vercel: tu papá y tu tío se quedarían en la puerta.

Tienes dos salidas: unir la rama a `main` en GitHub (un pull request y
**Merge**), o en la configuración de entornos del proyecto en Vercel
(**Settings → Environments → Production**) cambiar la rama de producción a la
actual. La primera es la limpia.

## Paso 6. Darle la entrada a tu papá y a tu tío

1. Entra tú primero a la dirección con `ricardo.tobon@joseitobon.com` y la
   contraseña que inventaste en el paso 2.
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

## Tu propio dominio (opcional)

Para que quede en `crm.joseitobon.com`: en Vercel, **Settings → Domains**,
agrega el dominio y Vercel te dice qué registro poner donde administras el
dominio de la firma. Después cambia `APP_URL` a la dirección nueva y haz
**Redeploy**.

## Cuando haya cambios en el código

Cada vez que se sube algo a la rama de producción, Vercel lo publica solo.

La única excepción: si el cambio trae un archivo nuevo en `crm/drizzle/`, la
base necesita ponerse al día. Corre esto una vez desde tu Mac, con el Session
pooler:

```bash
cd ~/Documents/TOBON && git pull && cd crm
DATABASE_URL='pega-aquí-el-session-pooler' npm run db:migrate
```

## Lo que se hace solo

- **Todas las mañanas a las 6** (hora de Colombia) Vercel corre el barrido de
  mantenimiento: marca pagos y facturas vencidos y propuestas que pasaron su
  fecha, para que el Inicio del día arranque al día aunque nadie haya entrado.
  Eso también mantiene despierta la base de Supabase, que en el plan gratis se
  pausa si pasa una semana sin uso.

## Lo que todavía no funciona en línea

- **Conectar el Gmail.** Necesita credenciales de Google Cloud. Los pasos están
  en `docs/correo-gmail.md`. Sin eso, la pantalla de correo lo dice y el resto
  del CRM funciona igual.
- **Benjamín.** Cuando esté listo, se le da la dirección del CRM y una clave
  compartida (`CRM_INGEST_SECRET`). La guía está en `docs/agente-whatsapp.md`.
- **Verificación en dos pasos.** No existe todavía. Por eso importan las claves
  largas y que cada uno tenga la suya.

## Si algo falla

- **Vercel dice `Falta DATABASE_URL`** → la variable no quedó cargada, o quedó
  solo para Preview. Revisa que esté marcada para Production y haz Redeploy.
- **La pantalla de ingreso no acepta la clave** → el paso 2 se corrió contra
  otra base. Confirma que la dirección tenga el mismo nombre de proyecto de
  Supabase y vuelve a sembrar.
- **Error al subir un documento** → revisa `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` y que el bucket se llame exactamente `jit-crm`.
- **`password authentication failed`** en el paso 2 → la clave de la base tiene
  símbolos o quedó `[YOUR-PASSWORD]` sin cambiar. En Supabase,
  **Database → Settings → Reset database password** y ponle una solo con
  letras y números.
