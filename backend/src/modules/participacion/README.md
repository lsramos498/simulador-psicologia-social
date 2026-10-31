# Participación y respuestas: avance académico

Alcance: registro y consulta básica del avance grupal del 40 %. No representa el módulo completo.
Relacionado con RF-10/RF-11 según el alcance recibido; no reemplaza el documento oficial de requisitos.

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

`estudianteId` debe ser un entero positivo. Es provisional: NO constituye autenticación verificada.
En la futura API debe venir del módulo de autenticación, nunca confiar en un ID libre del cliente.

El servicio reutiliza `registrarRespuesta()` y `ESTADOS_SESION` del módulo de sesiones.
El repositorio recibe el pool existente; no modifica su configuración. Usa tablas en minúsculas
según el entorno Windows del equipo. En servidores sensibles a mayúsculas se debe comprobar
la nomenclatura física antes de integrar.

El registro comprueba propietario, estado En curso y la cadena actividad/caso/escena/decisión/opción.
Una transacción con bloqueo de sesión mantiene estado y escritura coordinados. La restricción UNIQUE
del esquema complementa el rechazo de duplicados. Devuelve el ID solo después del commit.
La consulta requiere propietario, permite sesiones finalizadas y excluye soluciones y puntuaciones.
No calcula calificaciones ni altera la sesión.

Si ya existe una fila para la sesión y decisión, incluso con opción nula, esta etapa la rechaza
como duplicada. Completar filas precreadas y modificar respuestas queda pendiente de acordar
con el módulo que las cree. La consulta muestra únicamente filas con opción seleccionada.

Errores de negocio: `SESION_NO_EXISTE`, `SESION_AJENA`, `ESTADO_NO_PERMITIDO`,
`OPCION_INVALIDA`, `RESPUESTA_DUPLICADA` en `error.codigo`. Los errores de infraestructura
se propagan; una futura capa HTTP deberá tratarlos sin exponer detalles SQL o credenciales.

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
  3 decisiones, 3 opciones, 1 actividad, 1 autorización y 1 sesión (17 filas).
  Son dependencias técnicas de claves foráneas en la base aislada, no funcionalidades ajenas.
- UPDATE del estado de esa única sesión para probar rechazo en Sin iniciar y Finalizado,
  con restauración a En curso. No se cambia ninguna sesión preexistente.
- INSERT mediante el servicio de 2 respuestas; intentos inválidos y duplicados deben fallar.
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

- Implementado: servicio y repositorio para registrar/consultar, validaciones y pruebas.
  La ejecución real en MySQL debe informarse por separado; pruebas omitidas no son aprobadas.
- Parcial: identidad provisional; progreso y Observer conservan sus pruebas en memoria.
- Pendiente: autenticación de Sofía, rutas REST, modificaciones de respuestas, progreso persistido,
  tiempo máximo y coordinación de finalización. No se añadieron eventos ni notificaciones nuevas.
