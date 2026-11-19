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
- Catálogo visual de casos (hero + carruseles) y banco de personajes
- Listado con filtro por estado (`GET /api/casos`)
- Crear borrador básico (`POST /api/casos`) o caso completo con Builder (`POST /api/casos/construir`)
- Editor de borrador: datos, personajes, escenas, preguntas, opciones y rúbrica
- Ficha completa (árbol escenas → decisiones → opciones + checklist)
- Publicar y archivar

## Arquitectura

Aplicación React (Vite) de una sola página, sin enrutador: `App.jsx` decide qué
pantalla mostrar según haya o no una sesión.

```
src/
├── App.jsx
├── api/client.js              Sesión + todas las rutas de Casos
├── data/bancoPersonajes.js    Banco local para armar casos
├── data/portadas.js           Fondos del catálogo
├── utils/casoHelpers.js       Estado, errores, checklist de publicación
├── pages/
│   ├── LoginPage.jsx
│   └── CasosPage.jsx          Orquesta vistas (historias, crear, ficha, editor)
└── components/
    ├── Sidebar.jsx
    ├── CasoHero.jsx
    ├── CasosCarrusel.jsx
    ├── BancoPersonajes.jsx
    └── casos/
        ├── CasoFicha.jsx      Detalle + publicar/archivar
        └── CasoEditor.jsx     Tabs: datos / PJs / escenas / rúbrica / publicar
```

### Autenticación

1. El docente ingresa; el backend responde con JWT + usuario.
2. `guardarSesion` guarda en `localStorage` (`lumina.token`, `lumina.usuario`).
3. Cada petición envía `Authorization: Bearer <token>`.
4. Cerrar sesión llama a `limpiarSesion`.

La interfaz **no decide permisos**: el backend valida token, `CREAR_CASOS` y
propiedad del caso. Los errores traen `status`, `codigo` y `errores[]`.

### Proxy de desarrollo

`vite.config.js` reenvía `/api` a `http://127.0.0.1:3000`.

Más detalle del backend: `backend/src/modules/casos/README.md`.
