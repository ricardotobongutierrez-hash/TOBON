# Conectar el agente de WhatsApp al CRM

Benjamín, el agente de WhatsApp que vive en la raíz de este repositorio,
conversa y califica. El CRM guarda. Este documento explica cómo se hablan.

El CRM expone una sola puerta de entrada:

```
POST /api/ingesta/whatsapp
```

El agente no necesita conocer el esquema del CRM. Manda lo que entendió de la
conversación y el CRM decide dónde va: encuentra o crea el contacto, evita
duplicados, deja el mensaje en la línea de tiempo, abre el negocio si hay señal
de compra, recalcula el puntaje y agenda el siguiente paso.

## Autenticación

Se protege con una clave compartida. Genérala y ponla en las dos aplicaciones:

```bash
openssl rand -hex 32
```

En el CRM:

```
CRM_INGEST_SECRET=la-clave-generada
```

El agente la manda de una de estas dos formas:

- **Sencilla:** la cabecera `x-jit-clave` con la clave tal cual.
- **Firmada:** la cabecera `x-jit-firma` con el HMAC-SHA256 del cuerpo, en
  hexadecimal, usando esa misma clave. Es la recomendada si el CRM queda
  expuesto a internet.

Sin la variable configurada, la ruta responde `503` y no procesa nada. Es a
propósito: es preferible que la integración no funcione a que quede abierta a
cualquiera que conozca la URL.

## Qué mandar

Solo `telefono` es obligatorio. Todo lo demás es opcional, y entre más mande el
agente, mejor queda calificado el lead.

```json
{
  "telefono": "+57 311 785 4412",
  "idExterno": "wamid.HBgMNTczMTE3ODU0NDEy",
  "nombre": "Juan Pérez",
  "mensaje": "Buenas tardes, quisiera información del programa para nuestro equipo de compras.",
  "direccion": "entrada",
  "fecha": "2026-09-22T15:04:00-05:00",

  "correo": "juan.perez@dorexcargo.com",
  "empresa": "Dorex Cargo S.A.S.",
  "cargo": "Gerente Comercial",
  "ciudad": "Bogotá",
  "pais": "Colombia",
  "segmento": "b2b",

  "producto": "bootcamp in-house de dos días",
  "fuente": "WhatsApp",
  "campana": "Meta Ads Bootcamp Septiembre",

  "urgencia": "alta",
  "presupuesto": "30.000.000",
  "resumen": "Equipo de 14 negociadores. Pierden margen en descuentos. Decide el gerente general.",
  "siguientePaso": "Llamar para confirmar el alcance y las fechas",
  "fechaSiguientePaso": "2026-09-24T09:00:00-05:00",
  "escalar": false
}
```

### Notas por campo

- **`telefono`** se normaliza solo. Un celular colombiano de diez dígitos queda
  como `57XXXXXXXXXX`, que es la llave con la que el CRM reconoce al contacto.
- **`idExterno`** evita duplicar: si el proveedor reentrega el mismo mensaje, el
  evento no se escribe dos veces. Manda el id del mensaje de WhatsApp.
- **`producto`** se puede escribir como lo diría una persona. El CRM lo empareja
  contra el catálogo: "el in-house", "bootcamp de dos días" y "programa
  corporativo" llegan al producto correcto.
- **`empresa`** se busca por nombre normalizado y por dominio del correo, así que
  "Dorex", "DOREX SAS" y "Dorex Cargo S.A.S." no crean tres empresas.
- **`escalar`** fuerza el aviso al equipo. El CRM además escala solo cuando el
  negocio supera el valor alto configurado o el puntaje pasa de 70.

## Qué responde

```json
{
  "contactId": "…",
  "contactCreado": true,
  "companyId": "…",
  "opportunityId": "…",
  "opportunityCreada": true,
  "puntaje": 74,
  "escalado": true,
  "duplicadoIgnorado": false
}
```

Con `contactId` y `opportunityId` el agente puede armar un enlace directo a la
ficha, por si necesita pasarle el caso a una persona.

## Chequeo de salud

```bash
curl https://TU-DOMINIO/api/ingesta/whatsapp
```

Devuelve si la clave está configurada y la lista completa de campos aceptados.

## Ejemplo desde Python, para el agente

```python
import hmac, hashlib, json, os, httpx

CRM = os.environ["CRM_URL"]
SECRET = os.environ["CRM_INGEST_SECRET"]

async def enviar_al_crm(evento: dict) -> dict:
    cuerpo = json.dumps(evento, ensure_ascii=False)
    firma = hmac.new(SECRET.encode(), cuerpo.encode(), hashlib.sha256).hexdigest()
    async with httpx.AsyncClient(timeout=10) as cliente:
        respuesta = await cliente.post(
            f"{CRM}/api/ingesta/whatsapp",
            content=cuerpo,
            headers={"content-type": "application/json", "x-jit-firma": firma},
        )
        respuesta.raise_for_status()
        return respuesta.json()
```

Llama a esto **después** de responderle al cliente, no antes: el webhook de
Zernio reintenta si no recibe el 2xx en unos cinco segundos, y el CRM no debe
meterse en ese camino crítico.

## Reglas de negocio que el agente no debe romper

El CRM no valida el contenido comercial de lo que diga el agente. Las reglas de
precios, IVA y descuentos siguen viviendo en `knowledge/` y en
`config/prompts.yaml` del agente. En particular:

- El Bootcamp Abierto está en COP 980.000, no en COP 3.900.000.
- El IVA del 19 % se cobra solo a quien necesita factura electrónica.
- No se inventan descuentos, fechas ni cupos.

Si el agente manda un `presupuesto`, el CRM lo usa como valor estimado del
negocio, no como un precio prometido al cliente.
