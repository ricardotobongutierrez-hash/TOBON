# agent/brain.py — Cerebro del agente: conexion con Claude
# Generado por AgentKit

"""
Logica de IA del agente. Lee el system prompt de config/prompts.yaml y genera las
respuestas con la API de Anthropic.
"""

import logging
import os
from pathlib import Path

import yaml
from anthropic import AsyncAnthropic
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("agentkit")

client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# El modelo se cambia desde .env, sin tocar el codigo.
#   claude-opus-5     el mas capaz             $5 / $25 por millon de tokens
#   claude-sonnet-5   el balanceado (default)  $2 / $10
#   claude-haiku-4-5  el mas barato y rapido   $1 / $5
# Las lecturas de cache cuestan 0.1x la entrada, y las escrituras 1.25x.
# El "or" y no el default de os.getenv: una variable declarada vacia en el .env
# devuelve "" y dejaria al agente sin modelo.
MODELO = os.getenv("ANTHROPIC_MODEL") or "claude-sonnet-5"

# Es un bot de respuestas cortas: con esfuerzo bajo contesta mas rapido y mas barato.
# Dejalo vacio en el .env para no mandar el parametro.
ESFUERZO = os.getenv("ANTHROPIC_EFFORT", "low").strip()

# WhatsApp son mensajes cortos, pero este tope NO es solo la respuesta: en los modelos
# actuales el razonamiento interno tambien cuenta contra el. Con el margen justo, una
# pregunta que exija pensar un poco deja al agente sin espacio para contestar.
MAX_TOKENS = int(os.getenv("ANTHROPIC_MAX_TOKENS") or "4096")

# Los modelos mas viejos no aceptan output_config. Si la primera llamada falla por eso,
# se reintenta sin el parametro y se recuerda para las siguientes.
_soporta_esfuerzo = True

# ── Contexto del negocio ───────────────────────────────────────────────────────
# Todo lo que Benjamin sabe sale de dos lugares: el system_prompt de
# config/prompts.yaml (quien es y como se comporta) y los archivos de knowledge/
# (que sabe del negocio). Los archivos se leen en texto plano a proposito: asi el
# contexto queda versionado en git y se puede revisar en un diff.
CARPETA_KNOWLEDGE = Path(os.getenv("CARPETA_KNOWLEDGE", "knowledge"))
EXTENSIONES_KNOWLEDGE = (".md", ".txt")

# Caching de prompt. El contexto del negocio es identico en cada mensaje, asi que se
# marca como cacheable: la primera llamada lo escribe (1.25x el precio de entrada) y
# las siguientes lo leen a 0.1x. Sin esto, cada turno paga el contexto completo.
# Ojo: el minimo cacheable depende del modelo (1024 tokens en Sonnet 5, 512 en Opus 5).
# Por debajo de ese minimo la API no cachea y no avisa: cache_creation queda en cero.
USAR_CACHE = os.getenv("ANTHROPIC_CACHE", "true").strip().lower() not in ("false", "0", "no")

# El contexto se relee solo cuando algun archivo cambia en disco. Releerlo en cada
# mensaje seria gasto de I/O sin sentido, y armarlo una sola vez al importar obligaria
# a reiniciar el servidor para cada correccion de un precio.
_knowledge_cache: tuple[str, tuple] | None = None


def _huella_knowledge() -> tuple:
    """Lista de (nombre, tamano, fecha de modificacion) de los archivos de contexto."""
    if not CARPETA_KNOWLEDGE.is_dir():
        return ()
    huella = []
    for ruta in sorted(CARPETA_KNOWLEDGE.iterdir()):
        if ruta.name.startswith(".") or ruta.suffix.lower() not in EXTENSIONES_KNOWLEDGE:
            continue
        try:
            st = ruta.stat()
        except OSError:
            continue
        huella.append((ruta.name, st.st_size, st.st_mtime))
    return tuple(huella)


def cargar_knowledge() -> str:
    """
    Junta los archivos de knowledge/ en un solo bloque de texto.

    El orden es alfabetico y estable a proposito: el cache de la API es un match de
    prefijo byte a byte, asi que si el orden cambiara entre llamadas se perderia el
    cache completo en cada mensaje.
    """
    global _knowledge_cache

    huella = _huella_knowledge()
    if _knowledge_cache is not None and _knowledge_cache[1] == huella:
        return _knowledge_cache[0]

    if not huella:
        logger.warning(
            f"No hay archivos de contexto en {CARPETA_KNOWLEDGE}/. "
            "El agente solo va a saber lo que diga config/prompts.yaml."
        )
        _knowledge_cache = ("", huella)
        return ""

    partes = []
    for nombre, _, _ in huella:
        try:
            contenido = (CARPETA_KNOWLEDGE / nombre).read_text(encoding="utf-8").strip()
        except (UnicodeDecodeError, OSError) as e:
            logger.error(f"No se pudo leer {nombre}: {e}")
            continue
        if contenido:
            partes.append(f"<documento nombre=\"{nombre}\">\n{contenido}\n</documento>")

    texto = "\n\n".join(partes)
    _knowledge_cache = (texto, huella)
    logger.info(f"Contexto del negocio cargado: {len(partes)} archivos, {len(texto)} caracteres")
    return texto


def construir_system() -> list[dict]:
    """
    Arma el system prompt completo: quien es el agente, mas lo que sabe del negocio.

    Devuelve bloques y no un string porque el marcador de cache va sobre un bloque.
    Todo va en un solo bloque cacheable: es contenido estable, y el mensaje del
    cliente, que es lo que cambia en cada turno, viaja aparte en "messages".
    """
    bloques: list[dict] = []
    texto = cargar_system_prompt()

    knowledge = cargar_knowledge()
    if knowledge:
        texto = (
            f"{texto}\n\n"
            "## Documentacion del negocio\n"
            "Lo que sigue son los documentos de la empresa. Es tu unica fuente de verdad "
            "sobre servicios, precios y condiciones. Si algo no esta aca, no te lo inventes.\n\n"
            f"{knowledge}"
        )

    bloque: dict = {"type": "text", "text": texto}
    if USAR_CACHE:
        bloque["cache_control"] = {"type": "ephemeral"}
    bloques.append(bloque)
    return bloques


def cargar_config_prompts() -> dict:
    """Lee toda la configuracion desde config/prompts.yaml."""
    try:
        with open("config/prompts.yaml", "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except FileNotFoundError:
        logger.error("config/prompts.yaml no encontrado")
        return {}


def cargar_system_prompt() -> str:
    """El system prompt: quien es el agente y que sabe del negocio."""
    return cargar_config_prompts().get(
        "system_prompt", "Eres un asistente util. Responde siempre en espanol."
    )


def obtener_mensaje_error() -> str:
    """Que decirle al cliente cuando algo falla de nuestro lado."""
    return cargar_config_prompts().get(
        "error_message",
        "Lo siento, estoy teniendo problemas tecnicos. Por favor intenta de nuevo en unos minutos.",
    )


def obtener_mensaje_fallback() -> str:
    """Que decirle al cliente cuando no se entendio el mensaje."""
    return cargar_config_prompts().get(
        "fallback_message", "Disculpa, no entendi tu mensaje. Podrias reformularlo?"
    )


def _extraer_texto(respuesta) -> str:
    """
    Junta el texto de la respuesta de Claude.

    Ojo: NO se puede hacer respuesta.content[0].text. La respuesta es una lista de
    bloques y el primero no siempre es texto (los modelos que razonan devuelven
    primero un bloque de pensamiento). Hay que filtrar por tipo.
    """
    partes = [bloque.text for bloque in respuesta.content if bloque.type == "text"]
    return "\n".join(p for p in partes if p).strip()


def _es_error_de_esfuerzo(error: Exception) -> bool:
    """
    True solo si el modelo rechazo la llamada POR el parametro output_config/effort.

    Se exige que sea un 400 de peticion invalida y no cualquier error que mencione la
    palabra: un 529 de sobrecarga que la nombre de paso no debe apagar el parametro
    para todo el proceso.
    """
    if getattr(error, "status_code", None) != 400:
        return False
    texto = str(error).lower()
    return "output_config" in texto or "effort" in texto


async def generar_respuesta(mensaje: str, historial: list[dict]) -> tuple[str, bool]:
    """
    Genera una respuesta con Claude.

    Args:
        mensaje: el mensaje nuevo del cliente
        historial: los mensajes anteriores, [{"role": "user"|"assistant", "content": "..."}]

    Returns:
        (texto, es_respuesta_real)

        "es_respuesta_real" es False cuando lo que se devuelve es un aviso tecnico
        (error o fallback) y no una respuesta del agente. main.py lo usa para no
        guardar esos avisos en el historial: si se guardaran, quedarian contaminando
        el contexto de todos los mensajes siguientes.
    """
    global _soporta_esfuerzo

    if not mensaje or len(mensaje.strip()) < 2:
        return obtener_mensaje_fallback(), False

    mensajes = [{"role": m["role"], "content": m["content"]} for m in historial]
    mensajes.append({"role": "user", "content": mensaje})

    system = construir_system()
    extras = {"output_config": {"effort": ESFUERZO}} if (_soporta_esfuerzo and ESFUERZO) else {}

    async def _llamar(parametros_extra: dict):
        return await client.messages.create(
            model=MODELO,
            max_tokens=MAX_TOKENS,
            system=system,
            messages=mensajes,
            **parametros_extra,
        )

    try:
        respuesta = await _llamar(extras)
    except Exception as e:  # noqa: BLE001
        if extras and _es_error_de_esfuerzo(e):
            logger.warning(
                f"El modelo {MODELO} no acepta output_config.effort; se reintenta sin ese parametro."
            )
            _soporta_esfuerzo = False
            try:
                respuesta = await _llamar({})
            except Exception as e2:  # noqa: BLE001
                logger.error(f"Error llamando a Claude: {e2}")
                return obtener_mensaje_error(), False
        else:
            logger.error(f"Error llamando a Claude: {e}")
            return obtener_mensaje_error(), False

    if getattr(respuesta, "stop_reason", None) == "max_tokens":
        logger.warning(
            f"La respuesta se corto por llegar al tope de {MAX_TOKENS} tokens. "
            "Si pasa seguido, sube ANTHROPIC_MAX_TOKENS o acorta el system prompt."
        )

    texto = _extraer_texto(respuesta)
    if not texto:
        logger.warning("Claude devolvio una respuesta sin texto")
        return obtener_mensaje_fallback(), False

    # Las metricas de cache son la forma de comprobar que el contexto se esta cacheando.
    # Si "cache lee" queda en cero mensaje tras mensaje, algo esta invalidando el cache:
    # el contexto quedo por debajo del minimo del modelo, o cambia entre llamadas.
    uso = respuesta.usage
    cache_escribe = getattr(uso, "cache_creation_input_tokens", 0) or 0
    cache_lee = getattr(uso, "cache_read_input_tokens", 0) or 0
    logger.info(
        f"Respuesta generada con {MODELO} "
        f"({uso.input_tokens} in / {uso.output_tokens} out, "
        f"cache escribe {cache_escribe} / cache lee {cache_lee})"
    )
    return texto, True
