# Casos académicos y rúbricas

Responsable: Stefanía Díaz  
Requisitos (hoja «16 de octubre»): **RF-05, RF-06, RF-07, RF-08, RF-09** y parte de **RF-17**.

## Qué resuelve el módulo

Permite a un docente autenticado con permiso `CREAR_CASOS`:

1. Crear un caso en borrador (datos básicos) o construirlo completo con **Builder**.
2. Agregar personajes, escenas, preguntas (decisiones), opciones y explicaciones.
3. Asociar rúbricas con criterios, ponderaciones y niveles.
4. Validar la estructura y **publicar** solo cuando cumple las reglas de negocio.
5. Archivar casos; los publicados/archivados no se editan.

## Componentes

| Archivo | Responsabilidad |
|---|---|
| `caso.builder.js` | Patrón **Builder**: arma el agregado por pasos y llama a `validarCaso` en `build()`. |
| `caso.validacion.js` | Normalización y reglas (datos básicos, escenas, opciones, rúbrica, publicación). |
| `casos.service.js` | Casos de uso: transacciones, estados, propietario/admin, orquestación. |
| `casos.repository.js` | Persistencia MySQL parametrizada (Caso, Escena, Decision, OpcionDecision, Rubrica…). |
| `caso.errores.js` | Errores de dominio con `codigo` y `statusCode`. |
| `caso.model.js` | Constantes de estado compartidas (evita literales mágicos). |
| `routes/casos.routes.js` | HTTP + autenticación/autorización; oculta respuestas correctas a estudiantes. |

## Patrón Builder

**Problema:** un caso académico es un objeto complejo (personajes + escenas + preguntas + opciones + explicaciones + rúbrica). Un único método del servicio mezclaría construcción, validación y persistencia.

**Solución:** `CasoBuilder` expone pasos encadenados (`conTitulo`, `agregarEscena`, `conRubrica`…). `build()` no persiste: entrega un caso **ya validado**. El servicio decide si guardarlo (`construir` → `guardarCasoCompleto`).

**Separación SOLID aproximada:**

- Builder: construcción + validación estructural.
- Servicio: reglas de aplicación (docente activo, borrador, propietario, publicar).
- Repositorio: acceso a datos.

## Estados

`Borrador` → editable por el creador (o admin).  
`Publicado` → no editable; exige escenas, preguntas, ≥2 opciones, opción esperada, explicaciones y rúbrica.  
`Archivado` → terminal para edición.

## Endpoints principales

Todas las mutaciones exigen JWT + permiso `CREAR_CASOS`. La gestión de un caso existente exige además ser el **creador** o **Administrador**.

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/api/casos` | Listar |
| `GET` | `/api/casos/:id` | Consultar (oculta claves al estudiante) |
| `POST` | `/api/casos` | Crear borrador básico |
| `POST` | `/api/casos/construir` | Crear con Builder (agregado completo) |
| `PATCH` | `/api/casos/:id` | Actualizar datos básicos (borrador propio) |
| `POST` | `/api/casos/:id/escenas` | Agregar escena |
| `POST` | `/api/casos/:id/escenas/:escenaId/decisiones` | Agregar pregunta |
| `POST` | `/api/casos/:id/decisiones/:decisionId/opciones` | Agregar opción + explicación |
| `POST` | `/api/casos/:id/personajes` | Agregar personaje |
| `POST` | `/api/casos/:id/escenas/:escenaId/personajes` | Asociar personaje a escena |
| `PUT` | `/api/casos/:id/rubrica` | Asociar/actualizar rúbrica (RF-17) |
| `POST` | `/api/casos/:id/publicar` | Publicar si la estructura es válida |
| `POST` | `/api/casos/:id/archivar` | Archivar |

## Pruebas

```bash
cd backend
npm run test:unit
node --test tests/casos.routes.test.js
```

Incluyen construcción válida/inválida, publicación, rúbricas, persistencia simulada, rutas HTTP y restricción de caso ajeno.

## Interacción con otros módulos

- **Acceso (Sofía):** JWT, roles y permiso `CREAR_CASOS`.
- **Actividades/sesiones (Laura):** consumen casos publicados.
- **Participación (Valeria):** respuestas sobre preguntas/opciones del caso.
- **MySQL:** tablas del esquema oficial (`Caso`, `Escena`, `Decision`, `OpcionDecision`, `Retroalimentacion`, `Rubrica`, …).
