# Anexo — Plan y casos LUMINA

Complemento de `Plan_y_Casos_LUMINA_comprimido.pdf` (evidencia del 3 de noviembre de 2026, CP-01 a CP-26).

**Qué se agrega en esta entrega**

- Pruebas de integración de Postman sobre el flujo que ya existe: acceso, casos, actividades, sesión del estudiante, respuesta, progreso, calificación y retroalimentación.
- Pruebas unitarias del avance posterior a esa evidencia: espacios, sesión y nota, progreso, edición de casos y proxy.

**Fecha de ejecución:** 9 de noviembre de 2026  
**Entorno:** Node.js v26.13.0, `node --test`, Newman contra `http://localhost:3000`, MySQL 8 en Docker  
**Colección:** `lumina-proyecto-completo.postman_collection.json`

---

## 1. Integración Postman

Comando:

```bash
npx newman run lumina-proyecto-completo.postman_collection.json
```

La colección se corre completa y en orden. Los tokens no se pegan a mano: los guardan las peticiones de ingreso.

| Carpeta | Peticiones | Qué cubre |
|---|---|---|
| 1. Salud de la API | 2 | Raíz y health |
| 2. Acceso y permisos | 21 | Ingreso, roles, docente, estudiante, espacio |
| 3. Casos | 24 | Borrador, Builder, edición, rúbrica, publicación y archivo |
| 4. Actividades y sesión | 20 | Programar, iniciar, sesión del estudiante, respuesta, nota y cierre |
| 5. Participación | 6 | Rechazos: sin token, datos inválidos y sesión inexistente |
| **Total** | **73 peticiones, 101 comprobaciones** | **0 fallidas** |

Usuarios de la colección:

| Rol | Correo | Cómo entra |
|---|---|---|
| Administrador | admin@unihumboldt.edu.co | Contraseña del seed |
| Docente | docente.casos@unihumboldt.edu.co | La colección lo crea. Contraseña `Docente1234` |
| Estudiante | estudiante.flujo@unihumboldt.edu.co | Código que devuelve programar la actividad |

### Casos nuevos de integración

Estos no estaban en el PDF del 3 de noviembre. El resto de la colección vuelve a ejecutar, ya en Postman, el acceso, los casos y el ciclo de la actividad que esa evidencia mostraba con otro cliente.

| ID | Requisito | Objetivo | Resultado obtenido | Veredicto |
|---|---|---|---|---|
| CP-27 | RF-01, RF-20 | El estudiante entra con el código de la convocatoria y el token queda atado a esa actividad | 200, con token y el `actividadId` de la actividad recién programada | **Aprobado** |
| CP-28 | RF-01, RF-20 | Sin token no inicia sesión; con token no inicia la sesión de otra actividad | 401 sin token; 403 en la actividad 999999 | **Aprobado** |
| CP-29 | RF-18 | El estudiante pasa su sesión de Sin iniciar a En curso, dentro de la ventana y con la actividad ya iniciada | 200, estado `En curso` | **Aprobado** |
| CP-30 | RF-10 | Registra la opción esperada del caso publicado | 201, con esa `opcionId` | **Aprobado** |
| CP-31 | RF-11 | El progreso cuenta la pregunta respondida | 200: 1 total, 1 respondida, 0 pendientes | **Aprobado** |
| CP-32 | RF-10 | La explicación sigue oculta mientras la sesión está En curso | 409, código `ESTADO_NO_PERMITIDO` | **Aprobado** |
| CP-33 | RF-18, RF-17 | Al finalizar, la sesión queda Finalizado y la nota sale de la rúbrica | 200, motivo `Finalizacion`, 1 acierto de 1, resultado 5 | **Aprobado** |
| CP-34 | RF-10 | Después de finalizar, la retroalimentación incluye la explicación | 200, con explicación no vacía | **Aprobado** |

La actividad de esa corrida se cerró después, con 200 y estado `Cerrada`.

---

## 2. Pruebas unitarias del avance

Comando, desde `backend`:

```bash
node --test src/modules/evaluacion/evaluacion.test.js src/modules/espacios/espacios.service.test.js src/modules/sesiones/sesiones.service.test.js tests/sesion.state.test.js src/modules/participacion/participacion.service.test.js src/modules/actividades/actividades.controller.test.js tests/casos.edicion.service.test.js tests/casos.proxy.test.js tests/casos.sustentacion.unitarias.test.js
```

**Resultado: 69 pruebas, 69 aprobadas, 0 fallidas.**

| ID | Módulo | Objetivo | Resultado obtenido | Veredicto | Evidencia |
|---|---|---|---|---|---|
| CP-U01 | Espacios | Crea un espacio, recorta nombre y código, y lo lista activo | Activo, nombre y código recortados | **Aprobado** | `espacios.service.test.js` |
| CP-U02 | Espacios | Rechaza nombre vacío y código repetido | 400 y 409 | **Aprobado** | `espacios.service.test.js` |
| CP-U03 | Sesiones | Al iniciar la actividad se preparan las sesiones de los convocados | 2 sesiones y 2 asistencias | **Aprobado** | `sesiones.service.test.js` |
| CP-U04 | Sesiones | El estudiante pasa a En curso dentro de la ventana y queda Presente | Estado `En curso` | **Aprobado** | `sesiones.service.test.js` |
| CP-U05 | Sesiones | Rechaza iniciar fuera de la ventana o si la actividad sigue Programada | 403 y 409 | **Aprobado** | `sesiones.service.test.js` |
| CP-U06 | Evaluación | Al finalizar calcula la nota, avisa calificación y retroalimentación, y no recalcula si se cierra otra vez | Resultado 2.5, 1 acierto; una sola evaluación | **Aprobado** | `sesiones.service.test.js`, `evaluacion.test.js` |
| CP-U07 | Evaluación | La pregunta vacía cuenta como cero y reparte según la ponderación | 1 de 2 correctas, resultado 2.5 en criterios 60/40 | **Aprobado** | `evaluacion.test.js` |
| CP-U08 | Evaluación | La ausencia deja la evaluación en cero | Resultado 0 y texto de ausencia | **Aprobado** | `evaluacion.test.js` |
| CP-U09 | Evaluación | Una opción que no es la esperada no suma | 0 aciertos, resultado 0 | **Aprobado** | `evaluacion.test.js` |
| CP-U10 | Sesiones | Un estudiante no cierra la sesión de otro | 403, sin escrituras | **Aprobado** | `sesiones.service.test.js` |
| CP-U11 | Sesiones | El cierre docente de una sesión que no empezó queda en cero y como ausencia | Motivo `CierreDocente`, resultado 0, asistencia Ausente | **Aprobado** | `sesiones.service.test.js` |
| CP-U12 | Sesiones | El estado permite cerrar en el mismo segundo de inicio y rechaza un cierre un minuto antes | Finalizado con 0 segundos; el minuto anterior se rechaza | **Aprobado** | `sesion.state.test.js` |
| CP-U13 | Participación | Calcula el progreso y oculta la retroalimentación mientras la sesión sigue en curso | 4 totales, 1 respondida, 3 pendientes; retroalimentación rechazada | **Aprobado** | `participacion.service.test.js` |
| CP-U14 | Participación | Rechaza responder si se agotó el tiempo, si la sesión no está En curso o si la opción no pertenece al caso | No guarda la respuesta | **Aprobado** | `participacion.service.test.js` |
| CP-U15 | Actividades | Entrega los códigos una sola vez y no devuelve el arreglo interno | `codigosDeAcceso` presente; `estudiantesAutorizados` ausente | **Aprobado** | `actividades.controller.test.js` |
| CP-U16 | Actividades | Un cuerpo incompleto responde 400; un fallo interno sigue en 500 sin el detalle | 400 con el mensaje de validación; 500 genérico | **Aprobado** | `actividades.controller.test.js` |
| CP-U17 | Casos | Editar escena, pregunta y opción solo dentro del borrador propio | Nombre recortado; escena ajena rechazada; texto y explicación guardados | **Aprobado** | `casos.edicion.service.test.js` |
| CP-U18 | Casos | El proxy deja crear el caso solo al docente con `CREAR_CASOS` | 201 con permiso; 403 sin permiso o con estudiante; 401 sin token, y en los rechazos el servicio no se ejecuta | **Aprobado** | `casos.proxy.test.js` |
| CP-U19 | Casos | El Builder arma el caso, la rúbrica suma 100 y solo el creador publica | Caso válido publicado; ponderación distinta de 100 y caso ajeno rechazados | **Aprobado** | `casos.sustentacion.unitarias.test.js` |

---

## 3. Ajustes que salieron al correr la integración

La primera corrida de Newman mostró tres fallos del avance actual. Quedaron corregidos y la corrida final quedó en 0 fallos.

| Qué pasaba | Dónde | Qué quedó |
|---|---|---|
| El estudiante recibía 403 al iniciar su propia sesión | `sesiones.routes.js` leía `params.id` y la ruta usa `actividadId` | El middleware recibe `params.actividadId` |
| Programar una actividad incompleta y registrar una respuesta con id inválido respondían 500 | El controlador de actividades y `registrarRespuesta` | Esos datos inválidos responden 400. Un error interno de base de datos sigue en 500, sin el detalle |
| Finalizar en el mismo segundo del inicio respondía 409 | MySQL guarda el inicio sin milisegundos y puede redondearlo al segundo siguiente | `sesion.state.js` acepta ese mismo segundo y sigue rechazando un cierre anterior |

---

## 4. Cómo repetir la evidencia

1. MySQL encendido y, en `backend`, `npm run db:seed` si el administrador todavía no existe.
2. `npm run dev` en `backend`.
3. En Postman: Import de `lumina-proyecto-completo.postman_collection.json` y Run de toda la colección, en orden.
4. Para las unitarias, el comando de la sección 2.
