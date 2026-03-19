# Frontend MVP - Campus Incidencias

## Ejecutar

1. Crear `.env.local` usando `.env.example`.
2. Instalar dependencias:
   `npm install`
3. Levantar frontend:
   `npm run dev`
4. Abrir `http://localhost:3000`.

## Pantallas

- `/` reporte agil (foto + GPS + descripcion).
- `/dashboard` listado con filtros y detalle de incidencias.

## PWA

- Manifest: `public/manifest.webmanifest`
- Service worker: `public/sw.js`
- Registro SW: `components/pwa-register.tsx`

