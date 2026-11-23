# Plan de pruebas LUMINA — consolidado (cierre)

Índice único de evidencias y casos. No inventa veredictos: remite a los aportes ya ejecutados y a los casos pendientes del PDF base.

**Fecha de consolidación:** 23 de noviembre de 2026  
**Rama de referencia:** `develop` (= `stefania` al tip de integración)

**Suite backend (23 nov):** `npm test` → **486** pruebas, **483** aprobadas, **0** fallidas, **3** omitidas (MySQL real).

---

## 1. Mapa de documentos

| Documento | Qué cubre | Estado |
|---|---|---|
| `Plan_y_Casos_LUMINA_completo.pdf` | CP-01 a CP-26 (evidencia base) | Referencia PDF |
| `Anexo-Postman-y-unitarias-LUMINA.md` | Newman + unitarias de avance (9 nov) | Ejecutado |
| `Plan-pruebas-casos-de-uso-faltantes.md` | CP-27 a CP-43 (plantilla PT-DCP-01) | Escritos; no ejecutados en ese doc |
| `PT-DCP-01-casos-stefania.md` | Módulo Casos (Stefanía) | Ejecutado 8 nov |
| `PT-DCP-01-acceso-sofia.md` | Acceso / permisos (Sofía) + actualizaciones | Ejecutado; actualizado 14–23 nov |
| Capturas manuales | Flujo web (Casos, borrador listo sin publicar) | Carpeta local `Desktop/capturas-manual-lumina/` |

---

## 2. Integraciones en `develop` (cierre)

| Origen | Qué entró | Estado |
|---|---|---|
| Sofía PR #14 | Código no viaja en la respuesta de `enviar-codigo` | Integrado |
| Sofía PR #15 | RF-10: estudiante solo ve el caso de su actividad | Integrado |
| Sofía PR #16 | RF-22 ingreso tardío, cierre automático, texto login | Integrado |
| Stefanía | Front por rol, login enviar código, plan de pruebas | Integrado |
| Laura `feature/laura-cierre-backend-2026` | Parte compatible (`participacion.repository`) | Integrado parcial |
| Valeria `feature/valeria-rf16-reporte-csv` | RF-16 CSV + RF-26 comentario docente + UI Seguimiento | Integrado |
| Fix `cerrarVencidas` | Pasa `estadoAnterior` al UPDATE | Integrado |

**Migración RF-26:** `backend/database/migrations/001_rf26_comentario_docente.sql`  
Columna `Evaluacion.comentarioDocente` aplicada en bases local y de prueba.

---

## 3. Cierre de seguridad Acceso (PR #14, #15, #16)

Ya documentados en `PT-DCP-01-acceso-sofia.md`:

| ID | RF | Objetivo | Evidencia |
|---|---|---|---|
| CP-ACC-11B | RF-01, RF-20 | `enviar-codigo` nunca devuelve el código en la respuesta HTTP | `acceso.enviar-codigo.test.js` |
| CP-ACC-12 | RF-10, RF-20 | El estudiante solo consulta el caso de su actividad | `acceso.caso-autorizado.test.js` |
| (RF-22) | RF-22 | Umbral de ingreso tardío al iniciar sesión | `acceso.ingreso-tardio.test.js`, `sesiones.service.test.js` |

```bash
npm test -- tests/acceso.enviar-codigo.test.js tests/acceso.caso-autorizado.test.js tests/acceso.ingreso-tardio.test.js
```

---

## 4. Valeria — RF-16 / RF-26

| RF | Objetivo | Evidencia |
|---|---|---|
| RF-16 | Reporte CSV de participación | `reporteParticipacion.*.test.js` |
| RF-26 | Comentario del docente en evaluación | `comentarioDocente.routes.test.js` |

UI: `SeguimientoPage.jsx`, contraste en “Tu práctica”.

---

## 5. Casos funcionales pendientes de ejecución manual (CP-27…CP-43)

Detalle en `Plan-pruebas-casos-de-uso-faltantes.md`. Resumen:

| Rango | Módulo | Foco |
|---|---|---|
| CP-27…CP-29 | Acceso / administración | Alta de docente, estudiante sin contraseña, bloqueo |
| CP-30…CP-32, CP-41 | Casos | Edición borrador, personaje, permisos creador/admin |
| CP-33…CP-34 | Actividades | Datos obligatorios, convocatoria y hash del código |
| CP-35…CP-38 | Sesiones | Iniciar, finalizar, tiempo agotado, cierre docente |
| CP-39…CP-40 | Participación | Progreso sin claves; calificación con rúbrica al cerrar |
| CP-42 | Acceso | Umbral de ingreso tardío (cubierto también por pruebas RF-22) |
| CP-43 | Aplicación web | Recorrido por rol (admin, docente, estudiante) |

---

## 6. Frontend (aporte Stefanía + Valeria)

- Login: enviar código; modo demo / SMTP Lumina
- Vistas por rol: administrador, docente, estudiante
- Práctica del estudiante, editor de casos
- Seguimiento docente: CSV + comentario (Valeria)

---

## 7. Ramas que no requieren merge adicional

| Rama | Motivo |
|---|---|
| `feature/sofia-cierre-final` | Ya contenida vía PR #16 |
| `feature/laura-cierre-backend-2026` | Tip ya ancestro de `develop`; API transaccional alternativa queda fuera a propósito |
| `feature/valeria-participacion-mejoras` | Divergida y superada por el módulo de participación ya en `develop` (progreso HTTP, etc.). No mergear a ciegas |

Si Laura quiere reintroducir su validador transaccional, debe rebasear sobre este `develop`.

---

## 8. Cómo correr el paquete de pruebas

```bash
cd backend
npm test
# MySQL real (opcional):
set LUMINA_MYSQL_TEST=1
set DB_NAME=proyecto_nuclear_test
node --test tests/acceso.mysql.test.js
# Postman (servidor arriba):
npx newman run lumina-proyecto-completo.postman_collection.json
```

Actualizar este índice solo cuando haya nuevos aportes con veredicto real (misma plantilla PT-DCP-01).
