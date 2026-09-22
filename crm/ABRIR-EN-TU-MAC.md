# Cómo abrir el CRM en tu Mac

El CRM **no está en tu computador todavía**, por eso no lo encuentras en Finder.
Se construyó en un computador en la nube que se apaga cuando termina la sesión.
Lo que queda es el código, guardado en GitHub. Bajarlo y abrirlo toma unos diez
minutos la primera vez, y después es un solo comando.

## Lo que necesitas instalar una sola vez

1. **Node 20 o superior.** Descárgalo de <https://nodejs.org> (el botón que dice
   LTS) y ábrelo como cualquier instalador de Mac.
2. **Git.** Probablemente ya lo tienes. Abre la Terminal (Cmd + Espacio, escribe
   "Terminal") y escribe `git --version`. Si te pide instalar las herramientas
   de desarrollo, acepta.

No necesitas instalar PostgreSQL para verlo funcionando. Más abajo dice cuándo
sí conviene.

## Bajar el código

En la Terminal, una línea a la vez:

```bash
cd ~/Documents
git clone https://github.com/ricardotobongutierrez-hash/TOBON.git
cd TOBON
git checkout claude/nifty-ramanujan-iwbl6f
```

Ahí ya aparece en Finder: **Documentos → TOBON → crm**. El CRM es esa carpeta
`crm`. El resto del repositorio es Benjamín, el agente de WhatsApp.

## Arrancarlo

```bash
cd ~/Documents/TOBON/crm
npm install
cp .env.example .env
```

`npm install` escupe una pila de avisos amarillos (`npm warn deprecated`,
vulnerabilidades moderadas, scripts de instalación no aprobados). Eso es normal
en cualquier proyecto de Node y no rompe nada. Lo único que importa es que diga
`added 327 packages`.

Ahora las dos llaves del `.env`. Pégalas de una, sin abrir ningún archivo:

```bash
sed -i '' "s|^AUTH_SECRET=.*|AUTH_SECRET=$(openssl rand -base64 48)|" .env
sed -i '' "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$(openssl rand -base64 48)|" .env
grep -E '^(AUTH_SECRET|ENCRYPTION_KEY)=' .env
```

Ese último comando te muestra las dos líneas ya llenas. Si alguna sale vacía,
ábrelo a mano con `open -e .env` y pega ahí lo que imprima
`openssl rand -base64 48`, sin comillas.

`AUTH_SECRET` firma la cookie de sesión y es obligatoria. `ENCRYPTION_KEY`
cifra los tokens de Google y solo hace falta el día que conectes el correo,
pero es gratis dejarla lista.

Y termina:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Abre <http://localhost:3000> en el navegador.

## Entrar

| Correo | Contraseña |
|---|---|
| `ricardo.tobon@joseitobon.com` | `TobonCRM2026` |
| `director@joseitobon.com` | `TobonCRM2026` |
| `carlos.tobon@joseitobon.com` | `TobonCRM2026` |

Las tres cuentas quedan marcadas como pendientes de cambio de contraseña y el
sistema te lo avisa en **Ajustes → Mi cuenta**. No te bloquea el paso, así que
hazlo tú: **cambia las tres antes de meter datos reales de clientes.**

## Los días siguientes

Ya no repites nada de lo anterior. Solo:

```bash
cd ~/Documents/TOBON/crm
npm run dev
```

Y para apagarlo, Control + C en la Terminal.

## Qué datos vas a ver

La semilla trae **el tarifario real** de la firma y **datos de demostración**
(contactos, negocios y facturas inventados) para que las pantallas no estén
vacías. Los de demostración quedan marcados y se pueden borrar desde Ajustes
cuando quieras arrancar limpio.

## Cuándo instalar PostgreSQL de verdad

Sin `DATABASE_URL` en el `.env`, el CRM levanta una base de datos embebida en la
carpeta `.pgdata/`. Sirve perfecto para verlo y probarlo. Pero no aguanta dos
procesos a la vez y no sobrevive bien a un cierre abrupto del computador.

Para trabajar con datos reales todos los días, instala PostgreSQL (la forma
fácil en Mac es <https://postgresapp.com>), crea una base llamada `jit_crm` y
descomenta la línea `DATABASE_URL` del `.env`, apuntándola a esa base:

```
DATABASE_URL=postgresql://localhost:5432/jit_crm
```

Después `npm run db:migrate && npm run db:seed` otra vez y listo.

## Si algo falla

- **`command not found: npm`** → Node no quedó instalado. Vuelve al paso 1.
- **Un error que menciona `esbuild` al correr `db:migrate`** → los scripts de
  instalación que npm dejó sin aprobar. Corre `npm rebuild esbuild` y vuelve a
  intentar.
- **`EADDRINUSE` o el puerto 3000 ocupado** → ya tienes algo corriendo ahí.
  Usa `npm run dev -- --port 3100` y abre <http://localhost:3100>.
- **La pantalla de ingreso no acepta la contraseña** → seguramente no corriste
  `npm run db:seed`. Córrelo y vuelve a intentar.
- **Pantalla en blanco o error de base de datos** → borra la carpeta `.pgdata/`
  y corre `npm run db:migrate && npm run db:seed` de nuevo.

El detalle técnico completo, las decisiones de producto y lo que falta por
conectar están en `README.md`, en esta misma carpeta.
