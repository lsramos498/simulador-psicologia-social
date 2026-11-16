# Lumina — Frontend (taller de casos)

Interfaz docente para el módulo de **Casos situacionales** (Stefania Díaz).

## Requisitos

1. Backend levantado en `http://127.0.0.1:3000`
2. MySQL con la base `proyecto_nuclear` y usuario seed / docente con `CREAR_CASOS`

## Arranque

```powershell
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`. El proxy de Vite reenvía `/api` al backend.

## Qué incluye

- Ingreso docente (`POST /api/acceso/ingreso`)
- Listado de casos con filtro por estado (`GET /api/casos?estado=Publicado`)
- Crear borrador básico
- Crear caso completo con Builder (`POST /api/casos/construir`)
- Publicar y archivar
