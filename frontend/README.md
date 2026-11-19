# Lumina — Frontend

Interfaz completa del simulador: **Administrador**, **Docente** y **Estudiante**.

## Requisitos

1. MySQL (`docker compose up -d mysql`) + seed del backend (`npm run db:seed`)
2. Backend en `http://127.0.0.1:3000`
3. Node 20+

## Arranque

```powershell
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`. Vite reenvía `/api` al backend.

## Roles

| Rol | Entrada | Pantallas |
|-----|---------|-----------|
| **Estudiante** | Login → **Jugar** (correo + código) | Práctica, notificaciones, simulación live, resultados |
| **Docente** | Login → **Iniciar sesión** | Historias, crear/IA, editor, actividades, seguimiento, espacios, avisos, biblioteca |
| **Administrador** | Mismo login docente | Todo lo docente + consola Admin (usuarios, roles, permisos, vista global) |

## Estructura

```
src/
├── App.jsx                 Routing por rol
├── api/client.js           Cliente HTTP completo
├── utils/roles.js          Helpers de rol
├── pages/
│   ├── LoginPage.jsx       Portada estilo misterio
│   ├── CasosPage.jsx       Shell docente/admin
│   ├── AdminPage.jsx       RF-03 administración
│   ├── ActividadesPage.jsx RF-04 / RF-21
│   ├── SeguimientoPage.jsx Sesiones + participación
│   ├── AvisosPage.jsx      Notificaciones
│   ├── EspaciosPage.jsx    Espacios académicos
│   └── PracticaEstudiantePage.jsx
└── components/
    ├── Sidebar.jsx
    ├── actividades/
    ├── casos/              Editor, simulación, tabs
    └── practica/
```

## Autenticación

1. Login guarda JWT en `localStorage` (`lumina.token`, `lumina.usuario`).
2. Cada petición envía `Authorization: Bearer`.
3. Permisos los valida el backend; la UI solo enruta por rol.
