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

## Arquitectura

Aplicación React (Vite) de una sola página, sin enrutador: `App.jsx` decide qué
pantalla mostrar según haya o no una sesión.

```
src/
├── main.jsx            Punto de entrada (monta <App />)
├── App.jsx             Si no hay sesión muestra LoginPage; si la hay, CasosPage
├── pages/
│   ├── LoginPage.jsx   Formulario de ingreso docente
│   └── CasosPage.jsx   Listado, creación, publicación y archivado de casos
└── api/
    └── client.js       Único lugar que llama al backend (fetch) y guarda la sesión
```

### Páginas

- **LoginPage**: pide correo y contraseña, llama a `ingresarDocente` y, si el
  ingreso es correcto, guarda la sesión y avisa a `App`.
- **CasosPage**: recibe la `sesion` (token + usuario) y usa las funciones de
  `client.js` (`listarCasos`, `crearCaso`, `construirCaso`, `publicarCaso`,
  `archivarCaso`, `obtenerCaso`). Muestra los mensajes de error del servidor.

### Autenticación

1. El docente ingresa con correo y contraseña; el backend responde con un
   **token JWT** y los datos del usuario.
2. `guardarSesion` los guarda en `localStorage` (`lumina.token`, `lumina.usuario`)
   para que la sesión sobreviva a recargar la página; `App` la recupera con `leerSesion`.
3. Cada petición de casos envía el token en `Authorization: Bearer <token>`.
4. Cerrar sesión llama a `limpiarSesion`, que borra ambas claves.

> La interfaz **no decide permisos**: el backend valida el token, el permiso
> `CREAR_CASOS` y si el usuario es el creador del caso (o administrador). Si
> algo falla, `client.js` lanza un `Error` con `status`, `codigo` y `errores`
> (lista de validación) para mostrarlo al docente.

### Proxy de desarrollo

`vite.config.js` reenvía todo lo que empiece por `/api` a
`http://127.0.0.1:3000`. Por eso `client.js` usa rutas relativas
(`/api/casos`) y no hace falta configurar CORS ni cambiar URLs entre equipos.
Este proxy solo existe en `npm run dev`; para producción habría que servir el
frontend y la API bajo el mismo origen o configurar un proxy equivalente.

### Respuestas correctas ocultas

El backend entrega `esCorrecta`, `explicacion` y `fundamentoTeorico` solo a
docentes y administradores. Esta interfaz es de uso docente, así que las ve; un
cliente de estudiante recibiría el caso sin esos campos.

Más detalle del backend: `backend/src/modules/casos/README.md`.
