# FacturasTyC

App web para gestionar facturas por cliente, pendientes de cobro y viajes realizados que todavia no fueron facturados.

## Configurar Supabase

1. Crear un proyecto en Supabase.
2. Abrir el SQL Editor y ejecutar el contenido de `supabase/schema.sql`.
3. Crear un archivo `.env.local` usando `.env.example` como base.
4. Completar:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

5. Ejecutar la app:

```bash
npm install
npm run dev
```

Si las variables no estan configuradas, la app funciona en modo local. Cuando Supabase esta configurado, todos los datos se guardan en la tabla `app_state`.

## PWA

La app incluye manifest, service worker e iconos para instalarse como PWA desde el navegador. En produccion debe servirse por HTTPS para que la instalacion y el modo offline funcionen correctamente.

## API

La app expone endpoints de lectura para consumir los mismos datos guardados en Supabase:

```txt
GET /api
GET /api/state
GET /api/clients
GET /api/invoices
GET /api/invoices?clientId=ypf&month=2026-05&paid=false
GET /api/trips
GET /api/trips?clientId=ypf&billed=false
GET /api/fiscal-credits?month=2026-05
GET /api/iva?month=2026-05
GET /api/summary?month=2026-05
GET /api/finance-realtime?month=2026-05&email=nachodallape2@gmail.com
```

Para ver cambios en tiempo real se puede usar Server-Sent Events:

```js
const stream = new EventSource("https://TU-DOMINIO/api/realtime?month=2026-05");

stream.addEventListener("state", (event) => {
  const payload = JSON.parse(event.data);
  console.log(payload.state);
  console.log(payload.summary);
});
```

`/api/realtime` envia un snapshot inicial y despues vuelve a emitir cuando cambia `app_state.updated_at` en Supabase. Si el stream corta por limite de ejecucion, `EventSource` reconecta solo.

`/api/finance-realtime` hace lo mismo pero para `FinanzasApp` y publica la card de `Cheques en cartera` en tiempo real.
