# Participación y respuestas: avance académico

Alcance actual: registro, modificación y consulta de respuestas del Backend para RF-10.
Fuente oficial: hoja `16 oct`, fila 11, de la matriz local. No representa el módulo completo.

## Uso del servicio

Desde un archivo del directorio de Participación, la composición prevista es:

```js
import { pool } from '../../config/database.js';
import { crearRepositorioParticipacion } from './participacion.repository.js';
import { crearServicioParticipacion } from './participacion.service.js';

const servicio = crearServicioParticipacion(crearRepositorioParticipacion(pool));
// IDs de ejemplo: sustituir por registros existentes y relacionados.
await servicio.registrar({ sesionId: 1, decisionId: 2, opcionId: 3 }, estudianteId);
const respuestas = await servicio.consultar(1, estudianteId);
```

`estudianteId` debe ser un entero positivo. El router existente lo obtiene de `req.usuario.id`,
validado por autenticación; nunca del cuerpo enviado por el cliente.

El servicio reutiliza `registrarRespuesta()` y `ESTADOS_SESION` del módulo de sesiones.
El repositorio recibe el pool existente; no modifica su configuración. Usa los nombres de tabla
del esquema, con mayúscula inicial (`SesionSimulacion`, `RespuestaEstudiante`).

El registro comprueba propietario, estado En curso y la cadena actividad/caso/escena/decisión/opción.
Una transacción con bloqueo de sesión mantiene estado y escritura coordinados. La restricción UNIQUE
del esquema complementa el rechazo de duplicados. Devuelve el ID solo después del commit.
La consulta requiere propietario, permite sesiones finalizadas y excluye soluciones y puntuaciones.
No calcula calificaciones ni altera la sesión.

Si ya existe una fila para la sesión y decisión, y la sesión sigue En curso, el registro cambia
la opción elegida. Una sesión finalizada no acepta respuestas nuevas ni cambios. La consulta
muestra únicamente filas con opción seleccionada.

Errores de negocio: `SESION_NO_EXISTE`, `SESION_AJENA`, `ESTADO_NO_PERMITIDO`,
`OPCION_INVALIDA`, `RESPUESTA_DUPLICADA`, `RESPUESTA_INCONSISTENTE` en `error.codigo`.
El router existente oculta los detalles de errores de infraestructura e integridad con un 500 genérico.

## Pruebas sin MySQL

Desde `backend`:

```powershell
npm.cmd test
```

Ejecuta pruebas existentes y nuevas unitarias; la prueba MySQL aparece omitida por defecto.
Las unitarias no demuestran persistencia real.

## Pruebas reales MySQL (requieren autorización previa)

Se necesita `proyecto_nuclear_test` con una copia íntegra del esquema aprobado y un usuario
de pruebas distinto de root con permisos suficientes SOLO sobre esa base. Esta prueba NO crea
bases, tablas ni permisos. No ejecutar `schema.sql` directamente: contiene `USE proyecto_nuclear`.
La preparación del esquema requiere revisión y autorización independientes.

Crear localmente `backend/.env.test` (excluido por el `.gitignore` compartido), con:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=proyecto_nuclear_test
DB_USER=USUARIO_DE_PRUEBAS
DB_PASSWORD=CONTRASENA_LOCAL_PRIVADA
```

No versionar este archivo ni compartir su contenido. La prueba exige que el archivo exista
y declare explícitamente la base de pruebas. No utiliza la base de desarrollo como alternativa.

Operaciones que deben aprobarse antes de activarla:

- INSERT de fixtures: 2 usuarios, 1 espacio académico, 2 casos, 1 rúbrica, 2 escenas,
  3 decisiones, 4 opciones, 1 actividad, 1 autorización y 1 sesión (18 filas).
  Son dependencias técnicas de claves foráneas en la base aislada, no funcionalidades ajenas.
- UPDATE del estado de esa única sesión para probar rechazo en Sin iniciar y Finalizado,
  con restauración a En curso. No se cambia ninguna sesión preexistente.
- INSERT de una respuesta mediante el servicio y otra pendiente completada por el servicio.
- UPDATE de selección, fechas y una incoherencia temporal controlada, solo en respuestas creadas.
  La misma selección repetida no cambia datos; las relaciones inválidas deben rechazarse.
- SELECT para comprobar guardado confirmado, consulta y ausencia de escrituras inválidas.
- DELETE de respuestas filtrado por el ID de la sesión creada; después DELETE de cada fixture
  por su propio ID en orden inverso. No hay TRUNCATE, DROP, borrado global ni cambios de permisos.

Después de aprobar estas operaciones y preparar la configuración:

```powershell
$env:LUMINA_MYSQL_TEST = '1'
try {
  node --test src/modules/participacion/participacion.mysql.test.js
} finally {
  Remove-Item Env:LUMINA_MYSQL_TEST
}
```

Los fixtures se limpian también si falla una aserción. Una desconexión o cierre forzado puede
impedir la limpieza; revisar los datos de prueba en ese caso antes de repetir. No hay limpieza
automática de ejecuciones antiguas ni acceso a `proyecto_nuclear`.

## Estado del alcance

- Implementado: servicio y repositorio para registrar/modificar/consultar, validaciones y pruebas.
  La ejecución real en MySQL debe informarse por separado; pruebas omitidas no son aprobadas.
- Integrado previamente: autenticación de Sofía y rutas REST de registro y consulta.
- Verificado: nueve subpruebas MySQL de RF-10 aprobadas en `proyecto_nuclear_test`, con limpieza confirmada.
- Pendiente: integración con el cierre real de Sesiones de Laura, progreso persistido y tiempo máximo.
  Progreso y Observer conservan sus pruebas aisladas. No se añaden notificaciones.


## Segunda entrega: RF-10 (hoja oficial `16 oct`, fila 11)

RF-10 permite responder y cambiar selecciones hasta finalizar la participación.
Esta etapa atiende registro, consulta y modificación del Backend. No implementa
progreso, tiempo máximo, evaluación ni notificaciones.

### Flujo y fechas

1. `registrarRespuesta()` valida IDs enteros positivos dentro del rango INT. Los
   errores de entrada son `TypeError`, traducidos a 400 por el router existente.
2. `crearServicioParticipacion().registrar()` abre una transacción y bloquea la sesión.
   Comprueba propietario, estado En curso y relación caso–escena–decisión–opción.
3. Sin fila previa, inserta la selección con `fechaRespuesta` del servidor MySQL.
   Con fila pendiente (opción y ambas fechas nulas), completa la misma fila y asigna
   la fecha inicial. La modificación real conserva esa fecha y asigna `fechaModificacion`.
   Repetir la misma opción no ejecuta UPDATE ni cambia fechas.
4. Una fila seleccionada sin fecha inicial, una pendiente con fechas o una fecha de
   modificación anterior a la respuesta produce `RESPUESTA_INCONSISTENTE` y rollback.
   No se reparan datos silenciosamente. Las fechas leídas deben ser objetos Date válidos,
   como entrega el pool compartido con su configuración actual.
5. La actualización filtra por ID, sesión y decisión; debe afectar exactamente una fila.
   El resultado solo se devuelve después del commit. No se aceptan selecciones nulas.

Estas decisiones de fechas son técnicas y provisionales, aprobadas por Valeria;
la matriz no especifica esa semántica. Son compatibles con el esquema nullable existente.
Los tiempos DATETIME pueden coincidir dentro del mismo segundo.

### Patrones e integraciones reales

- State: `participacion.service.js`, `registrar()`, consulta `ESTADOS_SESION` de Laura.
  No crea estados nuevos ni ejecuta el cierre de sesiones.
- Autenticación: `routes/participacion.routes.js` utiliza `req.usuario.id`. Esa ruta
  no invoca el Proxy compartido; no se atribuye ese patrón a esta validación.
- Contenido: reutiliza casos, escenas, decisiones y opciones de Stefanía. El router de
  Casos ya permite consultar contenido; este módulo no administra una copia.
- Observer: `eventosParticipacion.js` contiene `suscribir`, `desuscribir` y `notificar`.
  Sigue aislado del servicio en esta etapa; no se emiten eventos de finalización al responder.
- Strategy/Factory Method: existen en Notificaciones compartidas, sin integración nueva aquí.

### Concurrencia y errores

El bloqueo `FOR UPDATE` de sesión y respuesta se mantiene hasta commit/rollback;
la clave única sesión–decisión evita filas duplicadas. Cambios concurrentes se
serializan; puede prevalecer el último cambio ejecutado, sin control de versiones.
El cierre debe actualizar la misma fila de sesión con un contrato compatible.
La simulación de exclusión no certifica los bloqueos de MySQL ni la integración de cierre de Laura.

Se corrigieron validaciones repetidas de los IDs de respuesta, el UPDATE innecesario
al repetir opción y la comprobación redundante de finalización posterior a exigir En curso.
`puedeModificarRespuesta.js` se conserva sin cambios como utilidad previa, fuera del flujo real.

El router compartido mantiene 201 incluso al modificar. `RESPUESTA_INCONSISTENTE`
se traduce actualmente a 500 genérico: no tiene mapeo propio. También clasifica cualquier
TypeError como 400, lo que puede ocultar errores de programación. Esos cambios de ruta
requieren autorización independiente. No se asignan permisos nuevos en esta etapa.

### Pruebas sin MySQL

Desde `backend`, ejecutar archivos explícitos para no activar accidentalmente pruebas de escritura:

```powershell
node --test src/modules/participacion/calcularProgreso.test.js src/modules/participacion/eventosParticipacion.test.js src/modules/participacion/participacion.service.test.js src/modules/participacion/puedeModificarRespuesta.test.js src/modules/participacion/registrarRespuesta.test.js src/modules/participacion/participacion.repository.test.js src/modules/participacion/participacion.routes.test.js
```

Las HTTP montan el router real con autenticación JWT compartida y repositorio simulado;
no cargan configuración MySQL ni archivos privados. Las de repositorio usan conexiones
simuladas para comprobar SQL, parámetros y transacciones.

La suite MySQL ampliada se ejecutó por separado, con autorización, en `proyecto_nuclear_test`. Añade una opción
alternativa (18 fixtures), una fila de respuesta pendiente, cambios de selección/fechas,
una incoherencia temporal controlada y cierre concurrente de la sesión creada por la prueba.
La limpieza quedó confirmada comparando los IDs antes y después en las once tablas utilizadas,
sin registros ficticios restantes. Para futuras ejecuciones hay que comprobar permisos,
esquema y base real y contar con autorización de las escrituras y limpieza.

### Evidencia de esta etapa

- Referencia inicial: 35 pruebas aprobadas, 0 fallidas y 0 omitidas.
- Suite general: 364 pruebas aprobadas, 0 fallidas y 2 suites MySQL omitidas por defecto.
- Participación sin MySQL: 98 aprobadas, 0 fallidas y 0 omitidas. Están incluidas en las
  364 aprobadas de la suite general; no deben sumarse nuevamente.
- La primera ejecución ampliada tuvo 84 aprobadas y 1 fallo de carga HTTP por ausencia local
  de `jsonwebtoken`. Se restauraron dependencias ya declaradas sin cambiar manifiesto ni lockfile.
- Suite MySQL de RF-10, ejecutada por separado: nueve subpruebas aprobadas, cero fallidas
  y cero omitidas. Node informa diez pruebas aprobadas porque cuenta también la contenedora.
- Se verificaron persistencia, modificación, fechas y concurrencia controlada en MySQL,
  con limpieza confirmada de los 18 fixtures y las dos respuestas creadas.
- Los resultados de conexiones simuladas no certifican persistencia ni bloqueos reales.
- La prueba MySQL de cierre usa una transacción controlada; no invoca el cierre real de Laura.
  Su integración con Sesiones sigue pendiente de verificación; RF-10 no se declara totalmente integrado.

## RF-11: progreso integrado en Participación

Fuente: hoja oficial `16 oct`, RF-11 (fila 12), y confirmación de Stefanía:
el recorrido actual es lineal, sin ramificaciones ni asignación individual de preguntas.
Todas las decisiones del caso asociado a la sesión son aplicables. Seleccionar una opción
cambia la consecuencia narrativa y la explicación, no la siguiente pregunta.

### Persistencia y cálculo

- `participacion.repository.js`, `obtenerSesion()`: obtiene el caso mediante
  `SesionSimulacion.actividad_id → ActividadProgramada.caso_id`.
- `obtenerDecisionesAplicables(casoId)`: consulta `Decision → Escena → Caso`, ordenando
  primero por escena y luego por pregunta. Es el punto para adaptar la aplicabilidad
  si en el futuro el equipo incorpora recorridos distintos; no hay ramificación nueva aquí.
- `consultarRespuestasParaProgreso(sesionId, casoId)`: limita las filas a esa sesión y caso,
  admite opciones nulas y exige que una opción seleccionada pertenezca a su decisión.
  No consulta corrección, puntuación ni explicaciones.
- `calcularProgreso()`: recibe los IDs aplicables y las respuestas; cuenta cada decisión
  una sola vez. Son pendientes las decisiones sin fila o con opción nula.
  No se infiere aplicabilidad a partir de lo que el estudiante ya respondió.

Se conserva la API anterior `calcularProgreso(total, respondidas)`. La entrada por colecciones
acepta Array o Set de IDs y un Array de respuestas con `decisionId/opcionId` o sus nombres SQL.
Un recorrido desconocido (`null` o `undefined`) devuelve `estadoRecorrido: 'indeterminado'`
y cantidades nulas. Un conjunto conocido vacío devuelve cantidades cero, sin afirmar finalización.
No se calcula porcentaje ni calificación.

### Servicio, transacción y HTTP

`crearServicioParticipacion().consultarProgreso(sesionId, estudianteId)` comprueba propietario
y consulta los datos dentro de una transacción con bloqueo de sesión. Permite consulta propia
también después de finalizar, sin modificar el estado. No concede consultas docentes nuevas.

`registrar()` mantiene las validaciones, el bloqueo y las reglas de RF-10. Tras insertar,
modificar o repetir una selección, calcula progreso con la misma conexión y lo devuelve
únicamente después del commit. Si la consulta de progreso falla, se revierte la operación;
no se responde éxito sin progreso ni se oculta el error.

El resultado conserva `id`, `sesionId`, `decisionId` y `opcionId`, y añade `progreso`:

```json
{
  "id": 10,
  "sesionId": 1,
  "decisionId": 2,
  "opcionId": 3,
  "progreso": {
    "estadoRecorrido": "determinado",
    "totalPreguntas": 2,
    "preguntasRespondidas": 1,
    "preguntasPendientes": 1,
    "decisionesPendientesIds": [5]
  }
}
```

El router existente ya entrega ese objeto como `data` y mantiene HTTP 201. La consulta de
respuestas existente conserva su formato. No se modificó `routes/participacion.routes.js`:
el endpoint dedicado GET de progreso queda pendiente de autorización específica.

Tener cero pendientes no finaliza la sesión. La integración con el cierre real de Laura
continúa pendiente, y no se agregan temporizadores, evaluación, eventos ni notificaciones.

### Verificación de esta integración

- Referencia inicial: 173 pruebas de Participación aprobadas, sin MySQL.
- Regresión integrada: 184 aprobadas, 0 fallidas y 0 omitidas, incluidas las pruebas HTTP
  del router existente con persistencia simulada.
- Suite general sin activar MySQL: 450 aprobadas, 0 fallidas y 2 suites MySQL omitidas.
  Las 184 de Participación están incluidas en esas 450; no se suman nuevamente.
- Se prueban consulta propia/ajena/inexistente, IDs, pendientes nulas y sin fila,
  conjuntos de distintos tamaños, consulta finalizada, modificación sin aumento,
  rollback ante fallo de progreso y entrega posterior al commit.
- Las consultas parametrizadas, filtros y orden se verifican con conexiones simuladas.
- Esta versión integrada no se ha probado con escrituras MySQL. Las nueve subpruebas reales
  documentadas en RF-10 corresponden a la versión anterior y no certifican esta integración.
