# Casos académicos y rúbricas

Responsable: Stefanía Díaz.  
Requisitos (hoja «16 de octubre»): **RF-05, RF-06, RF-07, RF-08, RF-09** y parte de **RF-17**.

## Decisiones del módulo

| Tema | Decisión |
|---|---|
| Creación | Borrador básico (`POST /api/casos`) o agregado completo con **Builder** (`POST /api/casos/construir`). |
| Edición | Solo en estado `Borrador` y solo el **creador** o un **Administrador**. |
| Publicación | Exige ≥1 escena, ≥1 pregunta, ≥2 opciones, opción esperada, explicación por opción y rúbrica activa. |
| Listado para Actividades | `GET /api/casos?estado=Publicado` incluye `rubricaId` de la rúbrica activa. |
| Respuestas correctas | Se ocultan a estudiantes en `GET /api/casos/:id`. |
| Seguridad | JWT + permiso `CREAR_CASOS`. La creación usa el **Proxy** de Acceso. |
| Persistencia | MySQL parametrizado; mutaciones en transacción. |

## Componentes

| Archivo | Responsabilidad |
|---|---|
| `caso.builder.js` | Patrón **Builder**: arma el agregado por pasos; `build()` valida y no persiste. |
| `caso.validacion.js` | Normalización y reglas (datos básicos, escenas, opciones, rúbrica, publicación). |
| `casos.service.js` | Casos de uso: transacciones, estados, propietario/admin, orquestación. |
| `casos.repository.js` | Persistencia MySQL (`Caso`, `Escena`, `Decision`, `OpcionDecision`, `Rubrica`…). |
| `caso.errores.js` | Errores de dominio con `codigo` y `statusCode`. |
| `caso.model.js` | Constantes de estado compartidas (evita literales mágicos). |
| `routes/casos.routes.js` | HTTP + autenticación/autorización; oculta claves al estudiante. |
| `casos.postman_collection.json` | Colección Postman del módulo. |

## Patrón Builder

**Problema:** un caso académico es un objeto complejo (personajes + escenas + preguntas + opciones + explicaciones + rúbrica). Un único método del servicio mezclaría construcción, validación y persistencia.

**Solución:** `CasoBuilder` expone pasos encadenados (`conTitulo`, `agregarEscena`, `conRubrica`…). `build()` no persiste: entrega un caso **ya validado**. El servicio decide si guardarlo (`construir` → `guardarCasoCompleto`).

```
datos → CasoBuilder / construirCaso → validarCaso → servicio.construir → repositorio.guardarCasoCompleto → MySQL
```

**Separación:**

- Builder: construcción + validación estructural.
- Servicio: reglas de aplicación (docente activo, borrador, propietario, publicar).
- Repositorio: acceso a datos.

## Estados

`Borrador` → editable por el creador (o admin).  
`Publicado` → no editable; listable para programar actividades.  
`Archivado` → terminal para edición.

## Endpoints

Todas las mutaciones exigen JWT + permiso `CREAR_CASOS`. La gestión de un caso existente exige además ser el **creador** o **Administrador**.

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/api/casos` | Listar (`?creadorId=` / `?estado=Publicado`); incluye `rubricaId` activa |
| `GET` | `/api/casos/:id` | Consultar (oculta claves al estudiante) |
| `POST` | `/api/casos` | Crear borrador básico (protegido con Proxy) |
| `POST` | `/api/casos/construir` | Crear con Builder (agregado completo) |
| `PATCH` | `/api/casos/:id` | Actualizar datos básicos (borrador propio) |
| `POST` | `/api/casos/:id/escenas` | Agregar escena |
| `PATCH` | `/api/casos/:id/escenas/:escenaId` | Editar escena |
| `POST` | `/api/casos/:id/escenas/:escenaId/decisiones` | Agregar pregunta |
| `PATCH` | `/api/casos/:id/decisiones/:decisionId` | Editar pregunta |
| `POST` | `/api/casos/:id/decisiones/:decisionId/opciones` | Agregar opción + explicación |
| `PATCH` | `/api/casos/:id/opciones/:opcionId` | Editar opción y explicación |
| `POST` | `/api/casos/:id/personajes` | Agregar personaje |
| `POST` | `/api/casos/:id/escenas/:escenaId/personajes` | Asociar personaje a escena |
| `PUT` | `/api/casos/:id/rubrica` | Asociar/actualizar rúbrica (RF-17) |
| `POST` | `/api/casos/:id/publicar` | Publicar si la estructura es válida |
| `POST` | `/api/casos/:id/archivar` | Archivar |

### Códigos de respuesta frecuentes

| Código | Cuándo |
|---|---|
| `200` / `201` | Operación exitosa |
| `400` | ID o estado inválido |
| `401` | Sin autenticación |
| `403` | Sin permiso `CREAR_CASOS` o caso ajeno |
| `404` | Caso / escena / pregunta / opción inexistente |
| `409` | Caso no editable / no publicable / ya archivado |
| `422` | Estructura inválida (`codigo: ESTRUCTURA_INVALIDA`, lista en `errores`) |

### Ejemplo: construir y publicar

```json
POST /api/casos/construir
{
  "titulo": "Conflicto en el aula",
  "desarrolloSituacional": "Dos grupos discuten una norma.",
  "contextoHistoria": "Primer semestre.",
  "tiempoEstimadoSegundos": 600,
  "personajes": [{ "nombre": "Ana", "rolSocial": "Estudiante" }],
  "escenas": [{
    "nombre": "Aula",
    "contexto": "Inicio de clase",
    "orden": 1,
    "esFinal": false,
    "personajes": ["Ana"],
    "decisiones": [{
      "pregunta": "¿Cómo interviene?",
      "orden": 1,
      "opciones": [
        { "texto": "Escucha", "esCorrecta": true, "orden": 1, "explicacion": "Contiene el conflicto." },
        { "texto": "Ignora", "esCorrecta": false, "orden": 2, "explicacion": "Evita la situación." }
      ]
    }]
  }],
  "rubrica": {
    "nombre": "Intervención",
    "criterios": [{
      "nombre": "Mediación",
      "ponderacion": 100,
      "puntajeMaximo": 4,
      "niveles": [{ "nombre": "Básico", "descripcion": "Nombra el conflicto.", "puntaje": 1, "orden": 1 }]
    }]
  }
}
```

Luego: `POST /api/casos/:id/publicar`.

## Pruebas

```powershell
cd backend
npm run test:casos
```

Incluyen Builder, validación, publicación, rúbricas, persistencia simulada, rutas HTTP, Proxy, edición y sustentación.

Integración MySQL real (rollback, no deja datos):

```powershell
$env:LUMINA_MYSQL_TEST = "1"
npm run test:casos:mysql
```

## Interacción con otros módulos

- **Acceso (Sofía):** JWT, roles y permiso `CREAR_CASOS` (Proxy en creación).
- **Actividades/sesiones (Laura):** consumen casos `Publicado` y su `rubricaId`.
- **Participación (Valeria):** respuestas sobre preguntas/opciones del caso.
- **MySQL:** tablas del esquema oficial (`Caso`, `Escena`, `Decision`, `OpcionDecision`, `Retroalimentacion`, `Rubrica`, …).

## Frontend

El taller docente está en `frontend/` (login, listar, crear borrador, demo Builder, publicar/archivar). Ver `frontend/README.md`.
