# Informe de avance del Backend — Lumina  
## Del 40 % al 70 % (Segundo corte — Proyecto Nuclear II)

**Proyecto:** Simulador de Psicología Social — plataforma Lumina  
**Repositorio:** [https://github.com/lsramos498/simulador-psicologia-social](https://github.com/lsramos498/simulador-psicologia-social)  
**Rama de integración:** `develop`  
**Periodo:** entrega del ~40 % → entrega del mínimo ~70 % (noviembre 2026)  
**Equipo:** Laura Ramos, Stefanía Díaz, Sofía Gallego, Valeria Tobar  

**Enlace del repositorio:** https://github.com/lsramos498/simulador-psicologia-social

---

## 1. Resumen ejecutivo

El equipo construyó el Backend de Lumina sobre **Node.js, Express y MySQL**, con API REST, autenticación JWT, módulos por responsabilidad, patrones de diseño justificados y pruebas automatizadas. El código está en el repositorio privado del equipo: [https://github.com/lsramos498/simulador-psicologia-social](https://github.com/lsramos498/simulador-psicologia-social).

| Momento | Meta | Situación del Backend |
|--------|------|------------------------|
| Primera entrega (avance ~40 %) | Base funcional | Bootstrap API, esquema MySQL, módulos iniciales por integrante |
| Segunda entrega (mínimo ~70 %) | Backend integrado y demostrable | Acceso, casos, actividades/sesiones, participación y notificaciones con persistencia y pruebas |

**Estado actual (referencia `develop` + ramas de integración del equipo):**  
el Backend supera el umbral del **70 % mínimo** en funcionalidades principales implementadas, integradas y con evidencia de pruebas. Persisten pendientes hacia el 100 % (evaluación/calificación completa, RF-22 umbral de ingreso tardío, consolidación documental conjunta, etc.).

---

## 2. Organización del trabajo

| Integrante | Módulo principal | Requisitos (referencia hoja «16 de octubre») | Patrón principal |
|------------|------------------|-----------------------------------------------|------------------|
| **Sofía Gallego** | Acceso y permisos | RF-01, RF-02, RF-03, RF-20 | **Proxy** |
| **Stefanía Díaz** | Casos académicos y rúbricas | RF-05, RF-06, RF-07, RF-08, RF-09, parte RF-17 | **Builder** |
| **Laura Ramos** | Actividades, sesiones y notificaciones (correo) | RF-04, RF-18, RF-19, RF-21 (canal email) | **State** (+ Strategy / Factory Method en notificaciones) |
| **Valeria Tobar** | Participación y respuestas | RF-10, RF-11 (y progreso / notificaciones internas) | **Observer** |

Convención Git: `main` (estable), `develop` (integración), `feature/...` (trabajo individual) y *pull requests* con revisión entre compañeras.

---

## 3. Lo que hizo cada una

### 3.1 Sofía Gallego — Acceso y permisos

**Responsabilidad:** autenticación, autorización, roles/permisos y protección de operaciones.

**Implementado (del 40 % al 70 %):**

- Ingreso de **estudiantes** con correo institucional + código de autorización (hash HMAC), JWT y vínculo a la actividad de la convocatoria (RF-01, RF-20).
- Ingreso de **docentes/administradores** con correo + contraseña (hash scrypt).
- **Administración** (RF-03): crear docentes, listar/asignar roles y permisos; seed inicial de roles, catálogo de permisos y primer administrador.
- Middlewares `autenticar`, `requiereRol`, `requierePermiso`.
- Middleware `requiereActividadAutorizada` para que un estudiante solo opere sobre la actividad de su código (importante: en rutas de Laura usar `(req) => req.params.actividadId`).
- Política de contraseñas al crear docentes; **límite de intentos** de ingreso (bloqueo temporal / 429).
- Aplicación del **Proxy** en la creación de casos (`POST /api/casos`) sin duplicar `requierePermiso`.
- Documentación del módulo (`README`), colección Postman, pruebas unitarias/integración y aporte **PT-DCP-01** (`docs/PT-DCP-01-acceso-sofia.md`).
- Integración en `develop` (PR #6 mergeado).

**Evidencia en código:** `backend/src/modules/acceso/`, rutas `/api/acceso` y `/api/acceso/admin`.

---

### 3.2 Stefanía Díaz — Casos académicos y rúbricas

**Responsabilidad:** estructura y ciclo de vida de casos situacionales, escenarios, preguntas, opciones, explicaciones, validación/publicación y rúbricas.

**Implementado (del 40 % al 70 %):**

- Modelo, validación y persistencia MySQL del agregado **Caso** (personajes, escenas, decisiones, opciones, retroalimentación, rúbrica).
- Creación básica y creación completa mediante **Builder** (`POST /api/casos/construir`).
- Agregar y **editar** (PATCH) escenas, preguntas y opciones en borrador.
- Asociación de rúbricas (criterios, ponderaciones = 100, niveles) — parte de RF-17.
- Publicación solo si la estructura cumple reglas (escenas, preguntas, ≥2 opciones, opción esperada, explicaciones, rúbrica).
- Archivar; restricción de edición solo en **Borrador**.
- Permisos: docente con `CREAR_CASOS`; solo **creador o administrador** gestiona el caso; estudiantes no ven claves/explicaciones.
- Pruebas amplias del módulo (`npm run test:casos`), documentación de arquitectura, revisión de antipatrones, PT-DCP-01 y guion de sustentación.
- Integración en `develop` (PR #8 y #9).

**Evidencia en código:** `backend/src/modules/casos/`, rutas `/api/casos`.

---

### 3.3 Laura Ramos — Actividades, sesiones y notificaciones

**Responsabilidad:** programación de actividades, ciclo de vida de sesiones, coordinación e integración; canal de correo en notificaciones.

**Implementado (del 40 % al 70 %):**

- Bootstrap inicial de la API y conexión MySQL (base compartida del proyecto).
- Módulo de **actividades programadas**: crear, consultar, iniciar, cerrar; asociación con espacios/estudiantes; validación de transiciones de estado; cierre automático (en su rama de mejoras).
- Módulo de **sesiones** con patrón **State**: transiciones `Sin iniciar` → `En curso` → `Finalizado`, motivos de cierre, intentos.
- Módulo de **notificaciones** con **Strategy** (convocatoria / cambio de estudiante) y **Factory Method** para crear estrategias; integración de transporte **SMTP** (RF-21, canal email).
- Coordinación de merges entre módulos (acceso, casos, participación) hacia la rama de integración.
- Pruebas de actividades, sesiones y notificaciones.

**Evidencia en código:** `backend/src/modules/actividades/`, `sesiones/`, `notificaciones/`, rutas de actividades/sesiones.  
**Nota:** parte de los avances más recientes de Laura viven en `feature/laura-rf04-18-19` / PR asociados; deben quedar integrados en `develop` para la entrega conjunta.

---

### 3.4 Valeria Tobar — Participación y respuestas

**Responsabilidad:** registro/modificación de respuestas, consulta, progreso e integración con sesiones/preguntas; notificaciones internas vía eventos.

**Implementado (del 40 % al 70 %):**

- Validación de registro y modificación de respuestas (RF-10) según estado de sesión.
- Servicio y repositorio con **persistencia MySQL**: registrar/consultar respuestas; validar propietario de sesión, estado *En curso*, cadena caso/escena/decisión/opción.
- Cálculo de **progreso** según decisiones aplicables; exposición HTTP de progreso (rama de mejoras).
- Patrón **Observer** para eventos de participación y notificación interna (con posibilidad de desuscripción).
- Rutas `/api/participacion`; pruebas unitarias y de MySQL real (activables con `LUMINA_MYSQL_TEST=1`).
- Fortalecimiento de seguridad HTTP (no exponer errores internos).

**Evidencia en código:** `backend/src/modules/participacion/`.  
**Nota:** mejoras de progreso/seguridad adicionales están en `feature/valeria-participacion-mejoras`; conviene confirmar su merge a `develop` antes del cierre formal.

---

## 4. Patrones de diseño implementados

| Patrón | Integrante | Dónde | Problema que resuelve |
|--------|------------|-------|------------------------|
| **Builder** | Stefanía | `caso.builder.js` | Construir un caso complejo (personajes, escenas, preguntas, opciones, rúbrica) por pasos y validarlo antes de persistir. |
| **Proxy** | Sofía | `servicioProtegido.proxy.js` + `POST /api/casos` | Interceptar operaciones sensibles (p. ej. crear caso) y exigir permiso sin contaminar el servicio de negocio. |
| **State** | Laura | `sesion.state.js` | Controlar transiciones legales del ciclo de vida de la sesión de simulación. |
| **Observer** | Valeria | `eventosParticipacion.js` / notificación interna | Desacoplar eventos de participación de las reacciones (notificación interna). |
| **Strategy** | Laura (+ apoyo notificaciones) | `notificaciones.strategy.js` | Variar el comportamiento de entrega/contenido según tipo de notificación. |
| **Factory Method** | Laura | `notificaciones.factory.js` | Crear la estrategia concreta de notificación sin acoplar al cliente. |

**Criterio del equipo:** no se crearon clases “solo para decir que hay patrón”; cada uno tiene uso en el dominio, pruebas y relación con requisitos.

---

## 5. Integración entre módulos

Flujo académico que el Backend ya permite encadenar:

1. **Sofía:** docente/admin inicia sesión; administrador puede crear docentes y permisos.  
2. **Stefanía:** docente crea/valida/publica un caso con rúbrica.  
3. **Laura:** docente programa una actividad sobre un caso publicado y gestiona sesiones (State).  
4. **Sofía:** estudiante ingresa con código de la convocatoria (JWT + `actividadId`).  
5. **Valeria:** estudiante registra respuestas y consulta progreso en sesión *En curso*.  
6. **Laura/Valeria:** notificaciones (correo / internas) según eventos.

Infraestructura común: Express (`app.js`), pool MySQL (`config/database.js`), esquema relacional (`backend/database/schema.sql`).

---

## 6. Pruebas y evidencia

- Suite automatizada del Backend con `npm test` (centenas de pruebas; 0 fallos en corridas recientes del equipo; algunas omitidas si no hay MySQL de prueba).
- Pruebas por módulo (`test:casos`, pruebas de acceso, actividades, participación, sesiones, notificaciones).
- Postman (módulo de acceso).
- Aportes PT-DCP-01:
  - Sofía: `docs/PT-DCP-01-acceso-sofia.md`
  - Stefanía: `docs/PT-DCP-01-casos-stefania.md`
  - Pendiente de consolidación formal con filas de Laura y Valeria en la plantilla oficial.

---

## 7. Evolución 40 % → 70 %

| Aspecto | ~40 % | ~70 % |
|---------|-------|-------|
| API | Health + esqueleto | Rutas de acceso, casos, actividades, participación (y sesiones/notificaciones) |
| Datos | Esquema / primeros repositorios | Persistencia MySQL en los cuatro módulos |
| Seguridad | Ideas / JWT inicial | Roles, permisos, Proxy, dueño del caso, actividad autorizada |
| Dominio casos | Consulta/creación básica | Builder, validación, publicación, rúbricas, edición PATCH |
| Sesiones | State inicial | Transiciones + gestión e intentos |
| Participación | Validaciones en memoria | MySQL + progreso + Observer |
| Notificaciones | Diseño Strategy/Factory | SMTP / canal correo |
| Calidad | Primeras pruebas | Amplia cobertura + docs + PRs mergeados |

---

## 8. Pendientes hacia Backend completo (más allá del 70 %)

- Evaluación/calificación con rúbrica al finalizar (resultados por criterio).  
- RF-22 (umbral de ingreso tardío) y otros RF de cierre del documento oficial.  
- Merge final de ramas abiertas de Laura/Valeria si aún no están en `develop`.  
- Consolidar un único PT-DCP-01 del equipo.  
- Frontend consumiendo la API real (complementario; no sustituye Backend).

---

## 9. Conclusión

Entre el avance del **40 %** y el del **70 %**, las cuatro integrantes aportaron **código de Backend real**, con **requisitos trazables**, **patrones aplicados**, **persistencia MySQL**, **control de acceso** e **integración en el mismo repositorio**.  

El 70 % es el **mínimo de la entrega**, no el techo del proyecto: el equipo continúa hacia un Backend completo, manteniendo la separación de responsabilidades y la evidencia por ramas, commits, PRs y pruebas.

---

*Documento elaborado a partir del estado del repositorio y de los módulos versionados (noviembre 2026). Debe cotejarse con la matriz oficial de requisitos (hoja «16 de octubre») antes de la trazabilidad definitiva.*
