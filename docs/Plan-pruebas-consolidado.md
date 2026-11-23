# Plan de pruebas LUMINA — consolidado (cierre)

Índice único de evidencias y casos. No inventa veredictos: remite a los aportes ya ejecutados y a los casos pendientes del PDF base.

**Fecha de consolidación:** 22 de noviembre de 2026  
**Ramas de referencia:** `stefania` → `develop` (incluye PR #14, PR #15 y front por rol)

---

## 1. Mapa de documentos

| Documento | Qué cubre | Estado |
|---|---|---|
| `Plan_y_Casos_LUMINA_completo.pdf` | CP-01 a CP-26 (evidencia base) | Referencia PDF |
| `Anexo-Postman-y-unitarias-LUMINA.md` | Newman + unitarias de avance (9 nov) | Ejecutado |
| `Plan-pruebas-casos-de-uso-faltantes.md` | CP-27 a CP-43 (plantilla PT-DCP-01) | Escritos; no ejecutados en ese doc |
| `PT-DCP-01-casos-stefania.md` | Módulo Casos (Stefanía) | Ejecutado 8 nov |
| `PT-DCP-01-acceso-sofia.md` | Acceso / permisos (Sofía) + actualizaciones | Ejecutado; actualizado 14–22 nov |
| Capturas manuales | Flujo web (Casos, borrador listo sin publicar) | Carpeta local `Desktop/capturas-manual-lumina/` |

---

## 2. Cierre de seguridad Acceso (PR #14 y #15)

Ya documentados y aprobados en `PT-DCP-01-acceso-sofia.md`:

| ID | RF | Objetivo | Evidencia |
|---|---|---|---|
| CP-ACC-11B | RF-01, RF-20 | `enviar-codigo` nunca devuelve el código en la respuesta HTTP | `acceso.enviar-codigo.test.js` (PR #14) |
| CP-ACC-12 | RF-10, RF-20 | El estudiante solo consulta el caso de su actividad | `acceso.caso-autorizado.test.js` (PR #15) |

Comando de verificación rápida (backend):

```bash
npm test -- tests/acceso.enviar-codigo.test.js tests/acceso.caso-autorizado.test.js
```

---

## 3. Casos funcionales pendientes de ejecución manual (CP-27…CP-43)

Detalle completo en `Plan-pruebas-casos-de-uso-faltantes.md`. Resumen por módulo:

| Rango | Módulo | Foco |
|---|---|---|
| CP-27…CP-29 | Acceso / administración | Alta de docente, estudiante sin contraseña, bloqueo |
| CP-30…CP-32, CP-41 | Casos | Edición borrador, personaje, permisos creador/admin |
| CP-33…CP-34 | Actividades | Datos obligatorios, convocatoria y hash del código |
| CP-35…CP-38 | Sesiones | Iniciar, finalizar, tiempo agotado, cierre docente |
| CP-39…CP-40 | Participación | Progreso sin claves; calificación con rúbrica al cerrar |
| CP-42 | Acceso | Umbral de ingreso tardío |
| CP-43 | Aplicación web | Recorrido por rol (admin, docente, estudiante) |

---

## 4. Frontend (aporte Stefanía)

Cubierto en código en `stefania` / `develop`:

- Login: enviar código (sin “Jugar”); modo demo / SMTP Lumina
- Vistas por rol: administrador, docente, estudiante
- Práctica del estudiante y editor de casos

Caso de smoke alineado con CP-43: ingresar por rol y completar una tarea típica sin llamar la API a mano.

---

## 5. Pendiente coordinado (Laura)

`feature/laura-cierre-backend-2026` chocaba con `develop` en 7 archivos de participación y sesiones.

**Qué quedó en `develop` hoy**

- Se conservó la API RF-23 ya en `develop`/`stefania` (validador puro, monitor, progreso/retroalimentación).
- Se integró el cambio compatible de `participacion.repository` (`enTransaccion` entrega también la conexión).

**Qué falta con Laura**

- Rebase de su validación transaccional (`validarSesionParaResponder(sesionId, estudianteId, conexion)`) sobre el `develop` actual.
- No mezclar a ciegas: su firma y repositorio (`obtenerReferenciaSesion`, etc.) no son drop-in sobre el servicio actual.

---

## 6. Cómo correr el paquete de pruebas

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
