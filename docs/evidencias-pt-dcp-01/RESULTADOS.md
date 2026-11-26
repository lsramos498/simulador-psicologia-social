# RESULTADOS PT-DCP-01 — Lumina

**Fecha de re-ejecución:** 25–26/11/2026  
**Entorno:** API `http://127.0.0.1:3000` (`ACCESO_CODIGO_EN_PANTALLA=true`) + Vite `http://localhost:5173` (`strictPort`)  
**Datos:** docente `docente.casos@unihumboldt.edu.co` / estudiante `sdiaz_549@unihumboldt.edu.co` (id 22)  
**Script:** `docs/evidencias-pt-dcp-01/_run_api_lote.mjs` → `_api-resultados.json` (**39/39 Aprobado**)

### Nota de adaptación

CP-09 / CP-10 del Word hablaban de **código de actividad**. El sistema usa **OTP de sesión por correo**. Con `ACCESO_CODIGO_EN_PANTALLA=true` el OTP también se muestra en demos locales (no en producción).

### Correcciones de sistema aplicadas en esta pasada

1. OTP demo local (`ACCESO_CODIGO_EN_PANTALLA`) + UI login.
2. Middleware `requiereActividadAutorizada` valida convocatoria en BD (login OTP).
3. `iniciarPropia` permite nuevo intento con **autorización de repetición** (RF-25 / CP-32).
4. Endpoint `POST /api/sesiones/actividades/:id/autorizar-repeticion` + botón en Seguimiento.
5. Vite `strictPort: true` en `:5173`.
6. Lote API ampliado (CP-15…36) y CP-12 alineado a **422**.

---

## Resumen

| Veredicto | CPs |
|-----------|-----|
| **Aprobado** | CP-01 … CP-36 (todos los escenarios del lote API + evidencias UI previas de Lote A) |

Detalle API: ver `_api-resultados.json` (39 escenarios Aprobado).

---

## Por caso (síntesis)

| CP | Escenario clave | Evidencias |
|----|-----------------|------------|
| CP-01 | Programar + rechazos fechas/tiempo/borrador | `CP-01/*.json`, `05-ui-actividades.png` |
| CP-02 | Iniciar actividad + login OTP estudiante | `CP-02/*.json`, UI login |
| CP-03 | Finalizar sesión | `CP-03/02-finalizar-sesion.json` |
| CP-04 | Transición inválida sobre cerrada | `CP-04/*.json` |
| CP-05 | Sin token → 401 | `CP-05/01-sin-token.json` |
| CP-06 | Login docente OK | `CP-06/*` |
| CP-07 | Login docente fail | `CP-07/*` |
| CP-08 | Roles / tabs | `CP-08/*` |
| CP-09 | Enviar OTP (+ demo en pantalla) | `CP-09/*` |
| CP-10 | OTP inválido | `CP-10/*` |
| CP-11 | Crear caso válido | `CP-11/*` |
| CP-12 | Caso incompleto → **422** | `CP-12/*` |
| CP-13 | Escenas | `CP-13/*` |
| CP-14 | Decisiones/opciones | `CP-14/*` |
| CP-15 | Relación inválida caso | `CP-15/01-relacion-invalida.json` |
| CP-16 | Respuesta válida | `CP-16/*` |
| CP-17 | Consulta respuestas | `CP-17/*` |
| CP-18 | Consulta actor no dueño | `CP-18/*` |
| CP-19 | Respuesta con sesión finalizada | `CP-19/*` |
| CP-20 | Opción inválida | `CP-20/*` |
| CP-21 / CP-22 | Dup / modificación | `CP-21/*` |
| CP-23 | Progreso | `CP-23/*` |
| CP-24 | Observer al finalizar | cierre + notifs |
| CP-25 | Rúbrica / publicado | `CP-25/*` |
| CP-26 | Convocatoria | `CP-26/*` |
| CP-27 | Tiempo máximo / cerrar-vencidas | `CP-27/*` |
| CP-28 | Ingreso tardío / fuera ventana | `CP-28/*` |
| CP-29 | Nota con rúbrica | `CP-29/*` |
| CP-30 | Intento evaluado al cierre | `CP-29/*` |
| CP-31 | Retro estudiante | `CP-31/*` |
| CP-32 | Repetición excepcional | `CP-32/*` |
| CP-33 | Monitor docente | `CP-33/*` |
| CP-34 | Comentario docente | `CP-34/*` |
| CP-35 | CSV reporte | `CP-35/*` |
| CP-36 | Notificaciones calificación | `CP-36/*` |

---

## Cómo repetir

```bash
# Backend (demo OTP en pantalla)
cd backend
set ACCESO_CODIGO_EN_PANTALLA=true   # PowerShell: $env:ACCESO_CODIGO_EN_PANTALLA='true'
npm start

# Frontend
cd frontend
npm run dev   # puerto 5173 estricto

# Lote API
node docs/evidencias-pt-dcp-01/_run_api_lote.mjs
```
