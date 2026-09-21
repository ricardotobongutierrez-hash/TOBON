# agent/tools.py — Herramientas del agente
# Generado por AgentKit

"""
Herramientas especificas del negocio.

OJO: estas funciones NO se ejecutan solas todavia. La informacion del negocio le llega
al agente por el system prompt (config/prompts.yaml), asi que para CONTESTAR preguntas
no hace falta nada de aca. Este archivo es el lugar para las ACCIONES —reservar, cobrar,
abrir un ticket— y conectarlas al ciclo de tool use de Claude es un paso aparte.

Claude Code genera las funciones segun los casos de uso elegidos en la entrevista.
"""

import logging
from pathlib import Path

import yaml

logger = logging.getLogger("agentkit")

CARPETA_KNOWLEDGE = Path("knowledge")


def cargar_info_negocio() -> dict:
    """Carga la informacion del negocio desde config/business.yaml."""
    try:
        with open("config/business.yaml", "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except FileNotFoundError:
        logger.error("config/business.yaml no encontrado")
        return {}


def obtener_horario() -> dict:
    """Retorna el horario de atencion del negocio."""
    info = cargar_info_negocio()
    return {
        "horario": info.get("negocio", {}).get("horario", "No disponible"),
        "esta_abierto": True,  # TODO: calcular segun la hora actual y el horario
    }


def buscar_en_knowledge(consulta: str) -> str:
    """
    Busca informacion en los archivos de /knowledge.
    Retorna los fragmentos que coinciden con la consulta.
    """
    if not CARPETA_KNOWLEDGE.is_dir():
        return "No hay archivos de conocimiento disponibles."

    resultados = []
    for ruta in sorted(CARPETA_KNOWLEDGE.iterdir()):
        if ruta.name.startswith(".") or not ruta.is_file():
            continue
        try:
            contenido = ruta.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue  # binarios y archivos ilegibles se saltean
        if consulta.lower() in contenido.lower():
            resultados.append(f"[{ruta.name}]: {contenido[:500]}")

    if resultados:
        return "\n---\n".join(resultados)
    return "No encontre informacion especifica sobre eso en mis archivos."

# ════════════════════════════════════════════════════════════
# Herramientas de calificacion de leads y agendamiento
#
# Generadas para los casos de uso elegidos: preguntas frecuentes,
# calificacion de leads y agendamiento del diagnostico.
#
# OJO, lo mismo que dice el encabezado de este archivo: estas funciones NO se ejecutan
# solas todavia. Estan listas para conectarse al ciclo de tool use de Claude en
# brain.py, que es un paso aparte. Hoy el agente conversa y califica con el system
# prompt; para que ADEMAS escriba el lead en la base hay que engancharlas.
# ════════════════════════════════════════════════════════════

from datetime import datetime  # noqa: E402
from typing import Any  # noqa: E402

from sqlalchemy import DateTime, Integer, String, Text, select  # noqa: E402
from sqlalchemy.orm import Mapped, mapped_column  # noqa: E402

from agent.memory import Base, ahora, async_session  # noqa: E402

# Datos minimos para considerar que una cuenta esta calificada.
CAMPOS_DE_CALIFICACION = ("nombre", "empresa", "sector", "dolor", "decisor")

CONTACTO_HUMANO = {
    "nombre": "Ricardo Tobon",
    "cargo": "Coordinador Estrategico",
    "email": "ricardotobongutierrez@gmail.com",
    "telefono": "+57 321 746 7350",
}


class Lead(Base):
    """
    Un prospecto que escribio por WhatsApp.

    Hay una fila por numero de telefono: el mismo prospecto puede volver en varias
    conversaciones y lo que sabemos de el se va completando de a poco.
    """

    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telefono: Mapped[str] = mapped_column(String(50), unique=True, index=True)

    nombre: Mapped[str | None] = mapped_column(String(200), default=None)
    cargo: Mapped[str | None] = mapped_column(String(200), default=None)
    empresa: Mapped[str | None] = mapped_column(String(200), default=None)
    sector: Mapped[str | None] = mapped_column(String(200), default=None)
    pais: Mapped[str | None] = mapped_column(String(100), default=None)
    tamano_equipo: Mapped[str | None] = mapped_column(String(100), default=None)
    dolor: Mapped[str | None] = mapped_column(Text, default=None)
    decisor: Mapped[str | None] = mapped_column(String(200), default=None)
    compite_contra: Mapped[str | None] = mapped_column(String(200), default=None)

    # Siguiente paso acordado: "diagnostico", "llamada", "traspaso" o None
    siguiente_paso: Mapped[str | None] = mapped_column(String(50), default=None)
    disponibilidad: Mapped[str | None] = mapped_column(String(300), default=None)

    escalado: Mapped[int] = mapped_column(Integer, default=0)  # 0 no, 1 si
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)


async def registrar_lead(telefono: str, **datos: Any) -> dict:
    """
    Crea o actualiza el prospecto de ese telefono.

    Solo pisa los campos que vengan con valor: si en esta conversacion supimos el sector
    pero no el decisor, el decisor que ya estaba guardado no se borra.
    """
    campos_validos = {c.name for c in Lead.__table__.columns}
    cambios = {
        k: v
        for k, v in datos.items()
        if k in campos_validos and k not in ("id", "telefono") and v not in (None, "")
    }

    async with async_session() as sesion:
        lead = (
            await sesion.execute(select(Lead).where(Lead.telefono == telefono))
        ).scalar_one_or_none()

        if lead is None:
            lead = Lead(telefono=telefono, **cambios)
            sesion.add(lead)
        else:
            for k, v in cambios.items():
                setattr(lead, k, v)
            lead.actualizado_en = ahora()

        await sesion.commit()
        await sesion.refresh(lead)
        logger.info(f"Lead guardado: {telefono} ({', '.join(cambios) or 'sin cambios'})")
        return _a_dict(lead)


async def obtener_lead(telefono: str) -> dict | None:
    """Retorna lo que sabemos del prospecto, o None si nunca escribio."""
    async with async_session() as sesion:
        lead = (
            await sesion.execute(select(Lead).where(Lead.telefono == telefono))
        ).scalar_one_or_none()
        return _a_dict(lead) if lead else None


async def calificar_lead(telefono: str) -> str:
    """
    Clasifica la cuenta segun que tan completa esta la informacion.

    "caliente": sabemos quien es, de que empresa, cual es el dolor y quien decide.
    "tibio":    hay dolor identificado pero falta contexto de la cuenta.
    "frio":     todavia no sabemos casi nada.
    """
    lead = await obtener_lead(telefono)
    if not lead:
        return "frio"

    completos = sum(1 for c in CAMPOS_DE_CALIFICACION if lead.get(c))

    if completos >= 4 and lead.get("dolor"):
        return "caliente"
    if lead.get("dolor"):
        return "tibio"
    return "frio"


async def agendar_siguiente_paso(
    telefono: str, tipo: str, disponibilidad: str | None = None
) -> dict:
    """
    Deja registrado el siguiente paso que el prospecto acepto.

    NO escribe en un calendario real y NO confirma la cita: la coordinacion final la
    hace Ricardo. Por eso el mensaje que devuelve habla de propuesta, no de reserva.

    tipo: "diagnostico" (1:1 con Jose Ignacio, USD 1.500 acreditable),
          "llamada"     (20 minutos),
          "traspaso"    (pasar el contacto a Ricardo).
    """
    tipos_validos = ("diagnostico", "llamada", "traspaso")
    if tipo not in tipos_validos:
        raise ValueError(f"Tipo invalido: '{tipo}'. Validos: {' | '.join(tipos_validos)}")

    lead = await registrar_lead(telefono, siguiente_paso=tipo, disponibilidad=disponibilidad)

    etiquetas = {
        "diagnostico": "Diagnostico estrategico 1:1 con Jose Ignacio",
        "llamada": "Llamada de 20 minutos",
        "traspaso": "Traspaso directo a Ricardo Tobon",
    }
    return {
        "registrado": True,
        "confirmado": False,  # lo confirma un humano, no el agente
        "tipo": tipo,
        "etiqueta": etiquetas[tipo],
        "disponibilidad": disponibilidad,
        "lead": lead,
    }


async def escalar_a_ricardo(telefono: str, contexto: str = "") -> dict:
    """
    Marca la cuenta para que la retome Ricardo y devuelve el resumen para el traspaso.

    El aviso a Ricardo todavia hay que conectarlo: hoy esto deja la marca en la base de
    datos. Para que le llegue un correo o un WhatsApp, ese envio se agrega aca.
    """
    lead = await registrar_lead(telefono, escalado=1, dolor=contexto or None)
    temperatura = await calificar_lead(telefono)

    resumen = {
        "telefono": telefono,
        "temperatura": temperatura,
        "empresa": lead.get("empresa"),
        "sector": lead.get("sector"),
        "pais": lead.get("pais"),
        "dolor": lead.get("dolor"),
        "decisor": lead.get("decisor"),
        "compite_contra": lead.get("compite_contra"),
        "siguiente_paso": lead.get("siguiente_paso"),
        "contacto": CONTACTO_HUMANO,
    }
    logger.info(f"Lead escalado a Ricardo: {telefono} ({temperatura})")
    return resumen


async def listar_leads(solo_calientes: bool = False) -> list[dict]:
    """Lista los prospectos guardados, del mas reciente al mas viejo."""
    async with async_session() as sesion:
        filas = (
            await sesion.execute(select(Lead).order_by(Lead.actualizado_en.desc()))
        ).scalars().all()

    leads = [_a_dict(f) for f in filas]
    if not solo_calientes:
        return leads

    return [
        lead
        for lead in leads
        if sum(1 for c in CAMPOS_DE_CALIFICACION if lead.get(c)) >= 4 and lead.get("dolor")
    ]


def _a_dict(lead: Lead) -> dict:
    """Pasa una fila de Lead a diccionario plano."""
    return {c.name: getattr(lead, c.name) for c in Lead.__table__.columns}
