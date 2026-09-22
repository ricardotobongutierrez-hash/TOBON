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
| Tono | Profesional y directo, **se tutea siempre**, no acartonado | `config/prompts.yaml` |
| Idioma | Solo español, aunque escriban en otro | `config/prompts.yaml` |
| Horario | 24/7, no se declara horario ni se hace esperar a nadie | `config/prompts.yaml` |
| Proveedor de WhatsApp | Zernio | `.env`, `agent/providers/zernio.py` |
| Modelo | `claude-sonnet-5` | `.env` (`ANTHROPIC_MODEL`) |

No cambies el modelo por tu cuenta para ahorrar costos. Es decisión del dueño del negocio.

## Reglas de negocio que no se tocan sin permiso

Fuente de verdad: `docs/contexto-maestro-v1.md` (22 de septiembre de 2026). Ese
documento manda sobre cualquier propuesta o material histórico. El contenido curado
para el agente vive en `knowledge/`.

1. **Tarifario vigente, en pesos colombianos.** Bootcamp Abierto COP 980.000 por
   persona; In-House COP 15.000.000 un día y COP 29.000.000 dos días, sin viajes ni
   viáticos; Diplomado COP 3.900.000, anticipado COP 3.499.000; masterclass USD 99;
   libro digital COP 55.000 o USD 18; libro físico COP 115.000, dos por COP 190.000.
2. **El Bootcamp Abierto está en COP 980.000, no en COP 3.900.000.** Ese segundo valor
   es el del Diplomado y aparece en materiales antiguos del Bootcamp.
3. **No se inventan descuentos, fechas, cupos ni inventario.** Para 3 o más personas en
   el Bootcamp se consulta condición especial, no se promete un número.
4. **El In-House no se rebaja automáticamente.** Si hay negociación comercial, se escala.
5. **No se mencionan nombres de empresas clientes** ni resultados confidenciales. La
   experiencia se presenta por sectores.
6. **No se prometen porcentajes** de margen, ventas ni retorno de la inversión.
7. **La asesoría 1:1 no se cotiza automáticamente.** Se califica y se escala.
8. **La comunidad Skool no existe como producto.** Es un proyecto en evaluación.

### Un tarifario en dólares circula por ahí

La skill `propuesta-jit` maneja otro tarifario (USD 6.500 el día in-house, USD 1.500 el
diagnóstico, USD 62.000 la licencia). **No es el vigente para WhatsApp.** Si aparece en
una conversación o en un archivo, no lo mezcles con el de arriba. Están sin conciliar.

## Estilo de la casa

Aplica al system prompt y a cualquier texto de cara al cliente:

- **Se tutea siempre. Nunca "usted".** Es la regla de la casa y, según el handoff de
  ManyChat del 6 de agosto de 2026, la que más se incumple. Si encuentras "usted" en
  un texto de cara al cliente, es un error, no una variante de estilo.
- Registro analítico, sin lenguaje de influencer.
- Se saluda una sola vez, en el primer contacto real.
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

## De dónde sale el contexto de Benjamín

Dos fuentes, y la distinción importa:

- `config/prompts.yaml` — **cómo se comporta**: identidad, tono, reglas de venta, cierre.
- `knowledge/*.md` — **qué sabe**: precios, servicios, credenciales, casos, políticas.

`brain.py` las junta en `construir_system()`. La carpeta se lee en runtime y se relee
sola cuando cambia un archivo (huella de nombre, tamaño y fecha), así que no hace falta
reiniciar el servidor para corregir un precio.

Solo se leen `.md` y `.txt`. Los PDF y Word se convierten con `scripts/ingesta.py`,
que deja un `.md` en `knowledge/`. Es deliberado: el contexto queda revisable en un
diff, no enterrado en un binario.

### Reglas al tocar esto

- **El orden de los archivos tiene que ser estable.** El caché de la API es un match de
  prefijo byte a byte: si el orden cambiara entre llamadas, se perdería el caché entero
  en cada mensaje. Por eso `_huella_knowledge()` ordena alfabéticamente.
- **Nunca metas nada variable en el system prompt** (fecha de hoy, nombre del cliente,
  un id). Invalida el caché en cada llamada. Eso va en `messages`, no en `system`.
  La fecha de hoy ya se inyecta así: `fecha_de_hoy()` la agrega como un bloque
  aparte del último mensaje del cliente, para que el agente pueda descartar un
  evento vencido de `knowledge/06-calendario.md` sin tocar el prefijo cacheado.
- **Verifica el caché en los logs.** Cada respuesta imprime `cache escribe` y
  `cache lee`. Si `cache lee` queda en cero mensaje tras mensaje, algo lo está
  invalidando o el contexto no llega al mínimo del modelo (1.024 tokens en Sonnet 5,
  512 en Opus 5, 4.096 en Haiku 4.5).
- `python scripts/contexto.py` mide el contexto y proyecta el costo mensual.

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
