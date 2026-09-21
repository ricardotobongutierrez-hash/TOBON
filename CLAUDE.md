# CLAUDE.md — Benjamín, agente de WhatsApp de José I. Tobón Consultores

Contexto para Claude Code al trabajar en este repositorio.

## Qué es esto

Un agente de WhatsApp construido con WhatsApp AgentKit (MIT). **El onboarding ya se
corrió**: el agente está generado y configurado. No vuelvas a ejecutar `/build-agent`
ni rehagas la entrevista de las 5 fases. La especificación original del kit quedó en
`docs/agentkit-spec.md` solo como referencia de por qué el código está escrito así.

## Decisiones ya tomadas

| Decisión | Valor | Dónde vive |
|---|---|---|
| Nombre del agente | Benjamín | `config/business.yaml` |
| Tono | Profesional y formal, trato de usted | `config/prompts.yaml` |
| Idioma | Solo español, aunque escriban en otro | `config/prompts.yaml` |
| Horario | 24/7, no se declara horario ni se hace esperar a nadie | `config/prompts.yaml` |
| Proveedor de WhatsApp | Zernio | `.env`, `agent/providers/zernio.py` |
| Modelo | `claude-sonnet-5` | `.env` (`ANTHROPIC_MODEL`) |

No cambies el modelo por tu cuenta para ahorrar costos. Es decisión del dueño del negocio.

## Reglas de negocio que no se tocan sin permiso

1. **El día in-house con José Ignacio no baja de USD 6.500.** Es un piso, no un punto
   de partida para negociar.
2. **La opción de instructor certificado (USD 3.000) nunca se ofrece junto al día con
   José Ignacio.** Solo aparece si el prospecto ya escuchó el precio y objetó
   presupuesto. Ofrecer las dos juntas destruye el anclaje.
3. **El diagnóstico de USD 1.500 es acreditable contra el contrato posterior.**
4. **Nunca inventar cifras del cliente.** Para el costo de no hacer nada se plantea el
   marco y se piden los números al prospecto.
5. **Urgencia solo con fechas reales.** Nada de cupos que se acaban.

## Estilo de la casa

Aplica al system prompt y a cualquier texto de cara al cliente:

- Trato de usted. Registro analítico, sin lenguaje de influencer.
- **Cero rayas largas.** Comas, dos puntos, o reestructurar la frase.
- No empezar frases con "Y" ni con "Pero".
- Nunca mencionar la sigla de la metodología propietaria: describirla con palabras.
- Nada de "grupos pequeños" si la cohorte supera 20 personas.
- En WhatsApp: mensajes de dos a cinco líneas, sin markdown ni viñetas.

## Arquitectura, en una línea cada archivo

- `agent/main.py` — Webhook. Verifica firma, responde 200 **antes** de trabajar y
  procesa en segundo plano. Un candado por teléfono para que dos mensajes seguidos no
  se mezclen. **No cambies el orden de responder y procesar:** Zernio reintenta hasta 7
  veces si no recibe el 2xx en unos 5 segundos.
- `agent/brain.py` — Llamada a Claude con el system prompt más el historial.
- `agent/memory.py` — Historial por teléfono y tabla de eventos ya procesados
  (la entrega es *at-least-once*).
- `agent/tools.py` — Leads, calificación y agendamiento. Define la tabla `leads`.
- `agent/providers/` — Patrón adaptador. `main.py` no sabe cuál proveedor está activo.

`main.py` importa `agent.tools` a propósito: ese import registra la tabla `leads` en el
metadata de SQLAlchemy antes del `create_all`. Si lo quitas, la tabla no se crea.

## Estado real de las herramientas

`tools.py` **no está conectado al tool use de Claude**. Hoy Benjamín conversa y califica
con el system prompt; las funciones están listas pero nadie las llama. Conectarlas en
`brain.py` es una tarea pendiente, no un bug.

Tampoco hay calendario real ni aviso automático a Ricardo:
`agendar_siguiente_paso()` devuelve `confirmado: False` a propósito.

## Antes de dar un cambio por bueno

```bash
.venv/bin/python -m compileall -q agent tests      # sintaxis
.venv/bin/python -c "import yaml; yaml.safe_load(open('config/prompts.yaml'))"
.venv/bin/python -m uvicorn agent.main:app --port 8000   # y pegarle a GET /
```

Si tocaste el prompt, corre `python tests/test_local.py` y conversa de verdad con
Benjamín antes de decir que quedó listo. Hace falta `ANTHROPIC_API_KEY` en `.env`.

## Secretos

Las claves viven en `.env`, que está en `.gitignore`. Nunca las escribas en el código,
en `config/`, en `knowledge/` ni en un commit.
