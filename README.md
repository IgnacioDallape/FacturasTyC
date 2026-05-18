# NutriApp

App web para gestionar productos, stock, compras, costos, finanzas y tareas de un emprendimiento de nutricion.

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
