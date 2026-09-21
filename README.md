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

Las reglas de venta están en `config/prompts.yaml`. Las tres que más importan:

1. **Precio in-house:** responde USD 6.500 con José Ignacio. No menciona la opción de
   instructor certificado (USD 3.000) en el mismo mensaje. Esa alternativa solo aparece
   si el prospecto ya escuchó el precio y objetó presupuesto. Así no se regala un
   descuento que nadie pidió.
2. **Cierre binario:** termina con una elección entre dos opciones, nunca con
   "¿le interesa avanzar?".
3. **No inventa cifras del cliente.** Si hay que cuantificar el costo de no hacer nada,
   plantea el marco y pide los números al prospecto.

Estilo de la casa, heredado de las propuestas: trato de usted, sin rayas largas, sin
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
