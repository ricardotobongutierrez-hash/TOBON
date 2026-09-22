# -*- coding: utf-8 -*-
"""
Segunda pasada: las tablas de etiquetas y los arreglos de opciones, que la
primera no tocaba porque su clave no es una propiedad de presentacion.

Regla: solo cadenas entre comillas dobles que parezcan una frase para leer.
Se descarta cualquier cosa que huela a clase de CSS, ruta, slug o consulta.
"""
import re, sys, pathlib
sys.path.insert(0, "qa")
from acentos import apply  # reutiliza el diccionario y las frases

CSS_HINTS = ("text-", "bg-", "border-", "flex", "grid", "px-", "py-", "size-",
             "rounded", "hover:", "sm:", "lg:", "md:", "w-", "h-", "gap-", "mt-",
             "shrink", "absolute", "relative ", "overflow", "font-", "leading-",
             "min-w", "max-w", "tracking", "divide-", "ring-", "shadow", "inset-",
             "clip-", "tnum", "eyebrow", "anim-in", "scroll-thin", "sr-only")
LINE_SKIP = ("className", "cn(", "sql`", "import ", "from \"", "require(",
             "href=", "slug", "storageKey", "autoKey", "process.env", "headers",
             "https://", "http://", "data:", "@/", "./", "../")

def looks_like_css(value: str) -> bool:
    return any(h in value for h in CSS_HINTS)

def phrase(value: str) -> bool:
    if len(value) < 4 or looks_like_css(value):
        return False
    if not re.search(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]{3}", value):
        return False
    # Una frase lleva espacio, o es una palabra suelta con mayuscula inicial.
    return " " in value or (value[0].isupper() and value.isalpha())

def process(path: pathlib.Path) -> bool:
    src = path.read_text(encoding="utf-8")
    lines = src.split("\n")
    out = []
    for line in lines:
        if any(s in line for s in LINE_SKIP):
            out.append(line)
            continue
        def repl(m):
            value = m.group(1)
            return f'"{apply(value)}"' if phrase(value) else m.group(0)
        out.append(re.sub(r'"([^"\\\n]{4,})"', repl, line))
    result = "\n".join(out)
    if result != src:
        path.write_text(result, encoding="utf-8")
        return True
    return False

changed = [str(p) for folder in sys.argv[1:]
           for p in pathlib.Path(folder).rglob("*")
           if p.suffix in (".tsx", ".ts") and p.is_file() and process(p)]
print(f"{len(changed)} archivos ajustados")
