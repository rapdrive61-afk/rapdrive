# Rap Drive Push Notifications

Archivos incluidos:

1. `App_RapDrive_ADMIN_V30_PUSH_READY.jsx`
2. `public/firebase-messaging-sw.js`
3. `api/send-push.js`

## Instalar dependencia backend

```bash
npm install firebase-admin
```

## Variables en Vercel

Project Settings → Environment Variables:

```txt
FIREBASE_PROJECT_ID=rapdrive
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@rapdrive.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

También puedes usar una sola variable:

```txt
FIREBASE_SERVICE_ACCOUNT_JSON={...json completo...}
```

## Flujo

- El mensajero inicia sesión.
- El navegador pide permiso de notificaciones.
- Se guarda el token en `oficinas/{officeId}/pushTokens/{driverId}`.
- Cuando el admin envía o elimina una ruta activa, llama `/api/send-push`.

## Importante

No pongas la llave privada del service account dentro del frontend.
