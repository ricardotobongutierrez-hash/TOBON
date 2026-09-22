# Conectar el correo: Google Workspace y Gmail

Cada persona del equipo conecta su propia cuenta. Nadie ve la bandeja de otro, y
el CRM nunca guarda contraseñas de correo: solo tokens de acceso, cifrados.

La integración está construida completa en el código. Lo único que falta es
crear las credenciales en Google Cloud, que solo puede hacer alguien con la
cuenta de administración de Workspace de la firma.

## 1. Crear el proyecto

1. Entra a [Google Cloud Console](https://console.cloud.google.com/) con la
   cuenta de Workspace de José I. Tobón Consultores.
2. Crea un proyecto nuevo. Nómbralo, por ejemplo, `CRM Jose I. Tobon`.

## 2. Habilitar la API de Gmail

En **APIs y servicios → Biblioteca**, busca **Gmail API** y habilítala.

## 3. Pantalla de consentimiento

En **APIs y servicios → Pantalla de consentimiento de OAuth**:

- Tipo de usuario: **Interno**. Así solo pueden conectarse cuentas del dominio
  de la firma, y Google no pide verificación de la aplicación.
- Nombre de la aplicación: `CRM Jose I. Tobon`.
- Correo de soporte y de contacto: el del administrador.

En **Permisos**, agrega estos cuatro:

```
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.compose
https://www.googleapis.com/auth/userinfo.email
```

Son los mínimos para lo que hace el CRM: leer los correos de los contactos,
enviar desde la ficha del cliente y saber qué cuenta se conectó.

## 4. Crear el ID de cliente

En **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de
OAuth**:

- Tipo: **Aplicación web**.
- URI de redirección autorizada:

```
https://TU-DOMINIO/api/correo/google/callback
```

En desarrollo, además:

```
http://localhost:3000/api/correo/google/callback
```

Google copia esta URL carácter por carácter. Si sobra una barra al final, falla.

## 5. Cargar las variables

```bash
GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
ENCRYPTION_KEY=$(openssl rand -base64 48)
APP_URL=https://TU-DOMINIO
```

`ENCRYPTION_KEY` es la que cifra los tokens en la base de datos. Si la cambias
después, las cuentas ya conectadas dejan de funcionar y hay que reconectarlas.

Reinicia la aplicación. En **Ajustes → Correo** el botón **Conectar Gmail** queda
activo.

## Qué hace la sincronización

No copia la bandeja completa. Le pregunta a Gmail solo por los correos que
involucran las direcciones de los contactos del CRM, de los últimos seis meses.

Cada correo encontrado se asocia al contacto por su dirección, y a la empresa
cuando el contacto tiene una. Aparece en la línea de tiempo del cliente con
asunto, fecha, un extracto y el enlace **Abrir en Gmail**.

Los correos enviados directamente desde Gmail también se capturan en la
siguiente sincronización, siempre que sean con un contacto del CRM.

## Desconectar

**Ajustes → Correo → Desconectar** borra los tokens de la base. Los correos que
ya están en la línea de tiempo se quedan, pero deja de sincronizarse.

## Sincronización automática

Hoy la sincronización se dispara a mano desde Ajustes. Para dejarla automática,
apunta un cron a la acción `syncEmail`, o expón una ruta protegida que la llame
y prográmala cada 15 minutos con el planificador de tu proveedor (Vercel Cron,
Railway Scheduler, cron del servidor).
