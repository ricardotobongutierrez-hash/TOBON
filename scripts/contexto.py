#!/usr/bin/env python3
"""
Mide el contexto que carga Benjamin y lo que cuesta.

    python scripts/contexto.py

Cuenta los tokens con la API de Anthropic si hay ANTHROPIC_API_KEY en el .env
(count_tokens no consume creditos); si no, estima a 4 caracteres por token, que
sirve para tener un orden de magnitud pero no es exacto.
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402

from agent import brain  # noqa: E402

load_dotenv()

# Precios por millon de tokens. Entrada, salida.
PRECIOS = {
    "claude-opus-5": (5.0, 25.0),
    "claude-sonnet-5": (2.0, 10.0),
    "claude-haiku-4-5": (1.0, 5.0),
}

# Minimo de tokens que hace falta para que la API cachee, segun el modelo.
# Por debajo de esto no cachea y no avisa.
MINIMO_CACHE = {
    "claude-opus-5": 512,
    "claude-sonnet-5": 1024,
    "claude-haiku-4-5": 4096,
}

# Supuestos de una conversacion tipica de WhatsApp.
TURNOS = 8
TOKENS_POR_MENSAJE = 40
TOKENS_RESPUESTA = 150


def contar_tokens(texto: str, modelo: str) -> tuple[int, bool]:
    """Retorna (tokens, exacto)."""
    if not os.getenv("ANTHROPIC_API_KEY"):
        return len(texto) // 4, False
    try:
        from anthropic import Anthropic

        r = Anthropic().messages.count_tokens(
            model=modelo,
            system=[{"type": "text", "text": texto}],
            messages=[{"role": "user", "content": "hola"}],
        )
        return r.input_tokens, True
    except Exception as e:  # noqa: BLE001
        print(f"  (no se pudo contar con la API: {e})")
        return len(texto) // 4, False


def main() -> int:
    modelo = brain.MODELO
    if modelo not in PRECIOS:
        print(f"Modelo desconocido para el calculo de costos: {modelo}")
        print(f"Modelos con precio conocido: {', '.join(PRECIOS)}")
        return 1

    entrada, salida = PRECIOS[modelo]
    minimo = MINIMO_CACHE[modelo]

    print("=" * 62)
    print(f"  Contexto de Benjamin  ·  modelo {modelo}")
    print("=" * 62)

    # Archivos de knowledge
    carpeta = brain.CARPETA_KNOWLEDGE
    archivos = []
    if carpeta.is_dir():
        archivos = sorted(
            r for r in carpeta.iterdir()
            if not r.name.startswith(".") and r.suffix.lower() in brain.EXTENSIONES_KNOWLEDGE
        )

    print(f"\nArchivos en {carpeta}/ ({len(archivos)}):")
    if not archivos:
        print("  ninguno. Benjamin solo sabe lo que diga config/prompts.yaml")
    for ruta in archivos:
        print(f"  {ruta.name:<42} {ruta.stat().st_size / 1024:>7.1f} KB")

    otros = []
    if carpeta.is_dir():
        otros = [
            r.name for r in sorted(carpeta.iterdir())
            if r.is_file()
            and not r.name.startswith(".")
            and r.suffix.lower() not in brain.EXTENSIONES_KNOWLEDGE
        ]
    if otros:
        print(f"\n  IGNORADOS (no son {' ni '.join(brain.EXTENSIONES_KNOWLEDGE)}):")
        for nombre in otros:
            print(f"    {nombre}")
        print("  Convertilos con: python scripts/ingesta.py")

    # Tamano del system prompt completo
    texto = brain.construir_system()[0]["text"]
    tokens, exacto = contar_tokens(texto, modelo)
    etiqueta = "exacto" if exacto else "estimado"

    print(f"\nSystem prompt completo: {len(texto):,} caracteres, {tokens:,} tokens ({etiqueta})")

    if tokens < minimo:
        print(f"\n  AVISO: {tokens:,} tokens esta por debajo del minimo de {minimo:,} de "
              f"{modelo}.\n  La API no va a cachear el contexto y no avisa: cada mensaje "
              "paga el precio completo.")
    else:
        print(f"  Supera el minimo de cache de {minimo:,} tokens: el contexto se cachea.")

    # Costos de una conversacion tipica
    print(f"\nConversacion de {TURNOS} turnos "
          f"({TOKENS_POR_MENSAJE} tokens por mensaje, {TOKENS_RESPUESTA} por respuesta):")

    # Sin cache: cada turno reenvia el contexto entero mas el historial acumulado.
    historial = sum(
        (TOKENS_POR_MENSAJE + TOKENS_RESPUESTA) * t for t in range(TURNOS)
    )
    in_sin_cache = tokens * TURNOS + historial + TOKENS_POR_MENSAJE * TURNOS
    out_total = TOKENS_RESPUESTA * TURNOS

    costo_sin = in_sin_cache / 1e6 * entrada + out_total / 1e6 * salida

    # Con cache: el primer turno escribe el contexto a 1.25x, los demas lo leen a 0.1x.
    costo_con = (
        tokens * 1.25 / 1e6 * entrada
        + tokens * 0.1 * (TURNOS - 1) / 1e6 * entrada
        + (historial + TOKENS_POR_MENSAJE * TURNOS) / 1e6 * entrada
        + out_total / 1e6 * salida
    )

    print(f"  sin cache: ${costo_sin:.4f}")
    print(f"  con cache: ${costo_con:.4f}   (lo que hace este agente)")
    if costo_con < costo_sin:
        print(f"  ahorro:    {(1 - costo_con / costo_sin) * 100:.0f}%")

    print("\nProyeccion mensual, con cache:")
    for n in (100, 300, 1000):
        print(f"  {n:>5} conversaciones al mes: ${costo_con * n:>8.2f}")

    print("\nNota: el cache dura 5 minutos y cada lectura reinicia ese reloj. Si pasan")
    print("mas de 5 minutos sin un mensaje, el siguiente vuelve a escribir el contexto.")
    print("Los numeros de arriba asumen una conversacion seguida.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
