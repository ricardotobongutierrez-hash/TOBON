# Benjamín · Agente de WhatsApp de José I. Tobón Consultores

Agente de WhatsApp con IA que atiende, califica y agenda para José I. Tobón Consultores.
Construido con [WhatsApp AgentKit](https://github.com/Hainrixz/whatsapp-agentkit) (MIT).

- **Agente:** Benjamín, tono profesional y formal, responde solo en español.
- **Proveedor de WhatsApp:** Zernio.
- **Modelo:** `claude-sonnet-5` (se cambia con `ANTHROPIC_MODEL`, sin tocar código).
- **Casos de uso:** preguntas frecuentes, calificación de leads, agendamiento del
  diagnóstico estratégico o de una llamada de 20 minutos.

---

## Arrancar en local

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env     # y llena las claves (ver abajo)
python tests/test_local.py   # chat con Benjamín en la terminal, sin WhatsApp
```

Para levantar el servidor:

```bash
uvicorn agent.main:app --reload --port 8000
curl http://localhost:8000/        # health check
```

El health check responde `degradado` mientras falten credenciales, y dice cuál falta.
Eso es a propósito: el servidor arranca igual para que puedas leer el diagnóstico.

---

## Qué llaves hacen falta

Todas van en `.env`, que nunca se sube a GitHub.

| Variable | Dónde se saca | Obligatoria |
|---|---|---|
| `ANTHROPIC_API_KEY` | platform.anthropic.com → Settings → API Keys | Sí |
| `ZERNIO_API_KEY` | zernio.com → Settings → API Keys (empieza con `sk_`) | Sí, para WhatsApp |
| `ZERNIO_WEBHOOK_SECRET` | Lo inventas tú | Sí, antes de atender clientes reales |
| `ZERNIO_ACCOUNT_ID` | Opcional, solo para el chequeo al arrancar | No |

**Sobre el webhook secret:** si lo dejas vacío, el agente arranca y avisa en los logs,
pero **no verifica la firma de los webhooks**. Cualquiera que conozca la URL podría
inyectarle mensajes. Sirve para probar, no para producción.

---

## Estructura

```
agent/
├── main.py              Servidor FastAPI. Verifica firma, responde 200 y procesa aparte
├── brain.py             Llamada a Claude
├── memory.py            Historial por teléfono + deduplicación de eventos
├── tools.py             Leads, calificación y agendamiento
└── providers/
    ├── base.py          Interfaz común
    ├── __init__.py      Elige el proveedor según WHATSAPP_PROVIDER
    └── zernio.py        Adaptador de Zernio

config/
├── business.yaml        Datos del negocio
└── prompts.yaml         El system prompt de Benjamín

knowledge/               Servicios y precios, credenciales de JIT, proceso comercial
tests/test_local.py      Simulador de chat en terminal
docs/agentkit-spec.md    Especificación original del kit, como referencia
```

---

## Cómo se comporta Benjamín

El comportamiento está en `config/prompts.yaml`; lo que sabe, en `knowledge/`. La fuente
de verdad del negocio es `docs/contexto-maestro-v1.md`.

Lo primero que hace es averiguar cuál de tres rutas es: la persona quiere mejorar ella,
quiere entrenar a un equipo, o tiene una negociación concreta encima. Sin eso, cualquier
recomendación es adivinanza, y presentar cinco productos de entrada satura al prospecto.

Las reglas que más importan:

1. **Tarifario en pesos.** Bootcamp Abierto COP 980.000 por persona; In-House COP 15M un
   día y COP 29M dos días, sin viajes ni viáticos; Diplomado COP 3.900.000. No inventa
   descuentos y no rebaja el In-House por su cuenta.
2. **No inventa nada** que no esté en su documentación: fechas, cupos, inventario,
   tiempos de entrega, porcentajes de retorno. Dice que lo confirma con el equipo.
3. **No menciona nombres de empresas clientes.** La experiencia se presenta por sectores.
4. **Una pregunta por mensaje**, máximo tres opciones, y siempre un siguiente paso.
5. **Sabe en qué día vive.** La fecha de hoy se le inyecta en cada mensaje para que no
   ofrezca un bootcamp que ya pasó.

Estilo de la casa: trato de usted, español colombiano natural, sin rayas largas, sin
lenguaje de influencer, sin mencionar la sigla de la metodología.

---

## Qué NO hace todavía

Esto es importante para no llevarse sorpresas.

- **Las funciones de `tools.py` no se ejecutan solas.** Benjamín conversa y califica con
  el system prompt, pero para que *además* escriba el lead en la base de datos hay que
  conectar esas funciones al ciclo de tool use de Claude en `brain.py`. Es el siguiente
  paso natural, no algo que salga andando de la caja.
- **No agenda en un calendario real.** `agendar_siguiente_paso()` deja registrado el
  paso y la disponibilidad, y devuelve `confirmado: False`. La confirmación la hace un
  humano.
- **No avisa a Ricardo automáticamente.** `escalar_a_ricardo()` marca la cuenta en la
  base y arma el resumen del traspaso. El correo o el WhatsApp de aviso hay que
  agregarlo.
- **No escribe primero.** WhatsApp solo permite texto libre dentro de las 24 horas
  posteriores al último mensaje del cliente. Fuera de esa ventana hace falta una
  plantilla aprobada por Meta.

---

## Deploy

```bash
docker compose up --build     # local, con Docker
```

Para producción: subir el repo, conectarlo a Railway, cargar las variables de entorno y
apuntar el webhook de Zernio a `https://TU-DOMINIO/webhook`.

**Agrega PostgreSQL en Railway.** Con SQLite el historial vive dentro del contenedor y
se borra en cada redespliegue: los clientes que vuelvan encontrarían a Benjamín sin
memoria. El código ya reescribe la URL al driver async, solo hay que poner
`DATABASE_URL`.

---

## Cambiarlo después

No hace falta tocar código. Desde Claude Code, en esta carpeta:

```bash
claude "Benjamín está sonando demasiado rígido. Bájale medio punto de formalidad."
claude "Agrega el nuevo bootcamp de octubre a la información de precios."
claude "Conecta las funciones de tools.py al tool use de Claude en brain.py."
claude "Quiero migrar de Zernio a Meta Cloud API."
```

---

Construido con [WhatsApp AgentKit](https://github.com/Hainrixz/whatsapp-agentkit) de
Todo de IA. Licencia del kit en `LICENSE-agentkit`.

---

## Cómo meterle contexto del negocio

Benjamín saca todo lo que sabe de dos lugares:

| Dónde | Qué va ahí |
|---|---|
| `config/prompts.yaml` | **Quién es y cómo se comporta.** Identidad, tono, reglas de venta, cómo cierra |
| `knowledge/*.md` | **Qué sabe.** Servicios, precios, credenciales, casos, políticas, FAQ |

La regla práctica: si es una *instrucción* sobre cómo actuar, va al prompt; si es
*información* que podría cambiar mañana, va a `knowledge/`.

### Agregar material

```bash
# Texto: simplemente cae en la carpeta y ya queda cargado
cp casos-de-exito.md knowledge/

# PDF, Word, CSV, HTML: se convierten primero
pip install pypdf python-docx
python scripts/ingesta.py ~/Documentos/programa-2026.pdf

# Ver qué está cargado y cuánto cuesta
python scripts/contexto.py
```

No hace falta reiniciar el servidor: el contexto se relee solo cuando cambia un
archivo en disco.

Los archivos se guardan en `.md` a propósito, no en PDF. Así el contexto queda
versionado en git y puedes ver en un diff exactamente qué cambió de lo que Benjamín
le dice a tus clientes.

### Qué cuesta, de verdad

El contexto viaja **en cada mensaje**. Sin caché, 30.000 tokens de contexto cuestan
unos 6 centavos por turno; con caché, menos de uno. Por eso el agente marca el
contexto como cacheable: la primera llamada lo escribe a 1,25× el precio de entrada y
las siguientes lo leen a 0,1×.

Dos cosas que conviene saber:

- **El caché dura 5 minutos** y cada lectura reinicia ese reloj. Dentro de una
  conversación seguida se mantiene caliente; si pasan más de 5 minutos sin mensajes,
  el siguiente vuelve a escribirlo.
- **Hay un mínimo para que cachee:** 1.024 tokens en Sonnet 5, 512 en Opus 5, 4.096 en
  Haiku 4.5. Por debajo de eso la API no cachea y **no avisa**. `scripts/contexto.py`
  te lo dice, y en los logs del agente lo ves como `cache lee 0` mensaje tras mensaje.

### Cuánto contexto es demasiado

Más contexto no es mejor automáticamente. Un prompt con tres transcripciones completas
de conferencias diluye las reglas de venta: el modelo tiene más dónde perderse y las
instrucciones importantes pesan relativamente menos.

Lo que funciona es material curado y denso: precios, condiciones, objeciones
frecuentes con su respuesta, casos con cifras. Lo que no funciona es volcar todo el
Drive. Si un cliente nunca lo va a preguntar por WhatsApp, no va en el contexto.
