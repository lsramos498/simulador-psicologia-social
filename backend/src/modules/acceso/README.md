# Acceso y permisos

Responsable: Sofía Gallego.
Requisitos (hoja «16 oct»): RF-01, RF-02, RF-03 y RF-20.

## Decisiones del equipo

| Tema | Decisión |
|---|---|
| Ingreso del estudiante | Correo institucional + código de autorización. El código se genera al programar la actividad y llega en el correo de la convocatoria (RF-20, RF-21). |
| Ingreso de docente y administrador | Correo institucional + contraseña. Solo se guarda el hash. |
| Roles | `Administrador`, `Docente` y `Estudiante`. Las diferencias se resuelven con permisos, no con roles nuevos. |
| Permisos | Se asignan a los roles (`RolPermiso`). Permiso confirmado por los requisitos: `CREAR_CASOS`. Los demás nombres están pendientes de acordar. |
| Estudiantes | Deben existir antes, estar activos y tener el rol `Estudiante`. No se crean automáticamente. |
| Códigos | Se guardan con hash (HMAC-SHA256), nunca en texto plano. |
| Ventana de acceso | Entre `fechaInicio` y `fechaFin` de `ActividadProgramada`, sujeta a confirmación con la profesora (RF-22). |
| Token de sesión | JWT con duración de 1 hora. |
| Cierre de sesión | El cliente elimina el token. El servidor lo acepta hasta que vence; la invalidación inmediata requeriría una lista de revocación. |
| Primer administrador | Seed con datos tomados de variables de entorno: crea los 3 roles, el catálogo inicial de permisos y el administrador. |

## Variables de entorno

Se agregan en `backend/.env` (nunca en Git). Los valores de ejemplo están en `.env.example`.

| Variable | Uso |
|---|---|
| `CODIGO_AUTORIZACION_SECRETO` | Clave para el hash de los códigos (mínimo 32 caracteres). |
| `JWT_SECRETO` | Clave para firmar los tokens (mínimo 32 caracteres). |
| `JWT_EXPIRACION` | Duración del token (`1h`). |
| `ADMIN_CORREO`, `ADMIN_NOMBRES`, `ADMIN_APELLIDOS`, `ADMIN_CONTRASENA` | Datos del primer administrador para el seed. Después de ejecutarlo, se deja `ADMIN_CONTRASENA` vacía. |

Para generar una clave: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Datos iniciales (seed)

```
npm run db:seed
```

Crea los roles `Administrador`, `Docente` y `Estudiante`, el catálogo inicial de permisos
(`CREAR_CASOS`) y el primer administrador con su contraseña en hash. No asigna permisos a los
roles: eso lo hace después el administrador. Se puede ejecutar varias veces sin duplicar datos
y no cambia la contraseña de un administrador que ya existe.

## Endpoints

### `POST /api/acceso/estudiantes/ingreso` (RF-01, RF-20)

```json
{ "correo": "estudiante@unihumboldt.edu.co", "codigo": "ABCD2345" }
```

```
correo + código → hash del código → convocatoria en MySQL → reglas (estado, ventana, sesión)
→ roles y permisos (MySQL) → ¿tiene el rol Estudiante? → token JWT
```

| Respuesta | Cuándo |
|---|---|
| `200` `{ token, usuario: { id, roles, actividadId } }` | Correo y código correctos, convocatoria vigente |
| `400` | Falta el correo o el código |
| `401` | Correo o código no válidos (mismo mensaje en ambos casos) |
| `403` | Estudiante retirado o bloqueado, cuenta inactiva, fuera de la ventana, sesión finalizada o sin rol `Estudiante` |
| `404` | La actividad del código no existe |
| `429` | 5 códigos incorrectos seguidos para ese correo: bloqueo de 15 minutos |
| `500` | Error interno (sin detalles para el cliente) |

### `POST /api/acceso/ingreso` (docentes y administradores)

```json
{ "correo": "docente@unihumboldt.edu.co", "contrasena": "..." }
```

```
correo + contraseña → buscar usuario (MySQL) → verificar hash (scrypt)
→ ¿cuenta activa? → roles y permisos (MySQL) → ¿Docente o Administrador? → token JWT
```

| Respuesta | Cuándo |
|---|---|
| `200` `{ token, usuario: { id, roles, permisos } }` | Credenciales correctas |
| `400` | Falta el correo o la contraseña |
| `401` | Correo o contraseña no válidos (mismo mensaje en ambos casos) |
| `403` | Cuenta inactiva, o el usuario no es docente ni administrador (los estudiantes usan su código) |
| `429` | 5 contraseñas incorrectas seguidas para ese correo: bloqueo de 15 minutos |
| `500` | Error interno |

### Administración: `/api/acceso/admin/...` (RF-03)

Todas exigen token (`401`) y el rol `Administrador` (`403`).

| Método y ruta | Cuerpo | Qué hace |
|---|---|---|
| `GET /roles` | | Roles con sus permisos |
| `GET /permisos` | | Catálogo de permisos |
| `POST /docentes` | `{ nombres, apellidos, correo, contrasena }` | Crea un usuario con rol `Docente` (`201`; `400` si la contraseña no cumple la política; `409` si el correo existe) |
| `POST /usuarios/:id/roles` | `{ "rol": "Docente" }` | Asigna un rol existente |
| `DELETE /usuarios/:id/roles/:rol` | | Quita un rol (`409` si el administrador intenta quitarse el suyo) |
| `POST /roles/:rol/permisos` | `{ "permiso": "CREAR_CASOS" }` | Asigna un permiso del catálogo a un rol |
| `DELETE /roles/:rol/permisos/:permiso` | | Quita un permiso de un rol |

Roles o permisos que no existen responden `404`: no se crean roles ni permisos desde la API.

### Seguridad

- Mismo mensaje para "no existe" e "incorrecto", para no revelar qué correos o códigos son válidos.
- Si el correo no existe, la contraseña se compara contra un hash ficticio: la respuesta tarda lo mismo y el tiempo no delata qué correos están registrados.
- Las contraseñas se guardan con scrypt y sal aleatoria; los códigos, con HMAC-SHA256. Ninguno se devuelve en las respuestas.
- La identidad y los permisos salen del token firmado por el servidor, nunca del cuerpo de la petición.
- Un docente no puede asignarse roles ni permisos; el administrador no puede quitarse su propio rol.
- Los cambios de roles o permisos se aplican en el siguiente ingreso, porque viajan dentro del token (máximo 1 hora).
- Política de contraseñas al crear docentes: mínimo 8 caracteres, con al menos una letra y un número.
- Límite de intentos: 5 fallos seguidos (contraseña o código) bloquean ese correo 15 minutos (`429`). Un ingreso correcto reinicia la cuenta. Los contadores viven en memoria: se borran si el servidor se reinicia.
- Los errores inesperados responden `500` con un mensaje genérico; el detalle solo queda en el registro del servidor (`errores.js`).

## Uso desde otros módulos

**Proteger una ruta** (autenticación + autorización):

```js
import { autenticar } from '../modules/acceso/autenticar.middleware.js';
import { requierePermiso, requiereRol } from '../modules/acceso/autorizar.middleware.js';

router.post('/', autenticar, requierePermiso('CREAR_CASOS'), crearCaso);
router.get('/admin', autenticar, requiereRol('Administrador'), listar);
```

`autenticar` lee `Authorization: Bearer <token>` y deja `req.usuario = { id, roles, permisos }`
(los estudiantes también tienen `actividadId`). La identidad siempre sale de `req.usuario`,
nunca del cuerpo de la petición.

**Limitar al estudiante a la actividad de su código** (para la ruta de inicio de sesión del estudiante, módulo de actividades):

```js
import { requiereActividadAutorizada } from '../modules/acceso/autorizar.middleware.js';

router.post('/:id/sesiones', autenticar, requiereActividadAutorizada(), iniciarSesion);
```

Si el usuario es Estudiante y la actividad de la ruta (`req.params.id` por defecto) no es la `actividadId`
de su token, responde `403`. Docentes y administradores pasan; su control lo hace el módulo de actividades.
Integración con la ruta de inicio de sesión del estudiante: pendiente de coordinar con Laura.

**Proteger una operación de negocio** (patrón Proxy):

```js
import { crearServicioProtegido } from '../modules/acceso/servicioProtegido.proxy.js';

const casos = crearServicioProtegido(casosService, req.usuario, { crearCaso: 'CREAR_CASOS' });
await casos.crearCaso(datos); // 401 sin usuario, 403 sin permiso
```

Cada operación se protege con el middleware o con el proxy, no con ambos.

**Generar códigos al programar una actividad** (módulo de actividades):

```js
import { crearCodigoAutorizacion } from '../modules/acceso/codigos.js';

const { codigo, codigoHash } = crearCodigoAutorizacion();
// codigo → correo del estudiante (RF-21)
// codigoHash → EstudianteAutorizado.codigoAutorizacion
```

## Componentes

| Archivo | Responsabilidad |
|---|---|
| `autorizacion.js` | Reglas puras: `tieneRol`, `tienePermiso`, constantes `ROLES` |
| `autorizar.middleware.js` | `requiereRol`, `requierePermiso` (401 / 403) |
| `servicioProtegido.proxy.js` | Patrón Proxy de protección de operaciones |
| `codigos.js` | Generar, hashear y verificar códigos; reglas de acceso del estudiante |
| `contrasenas.js` | Hash y verificación de contraseñas con scrypt; política de contraseñas |
| `limiteIntentos.js` | Bloqueo temporal tras varios ingresos fallidos |
| `errores.js` | Errores HTTP del módulo y respuesta segura de errores (sin detalles internos) |
| `tokens.js` | Firmar y verificar JWT |
| `autenticar.middleware.js` | Llena `req.usuario` a partir del token |
| `acceso.repository.js` | Consultas MySQL (solo lectura) |
| `acceso.service.js` | Ingreso del estudiante y de docentes/administradores: repositorio → reglas → token |
| `administracion.repository.js` | Escrituras MySQL de RF-03 (crear docente en transacción, roles, permisos) |
| `administracion.service.js` | Reglas de RF-03 |
| `routes/acceso.routes.js`, `routes/administracion.routes.js` | Rutas HTTP del módulo |
| `seed.js` + `scripts/seed-inicial.js` | Datos iniciales: roles, permisos y primer administrador |

## Patrones de diseño

| Patrón | Dónde | Problema que resuelve |
|---|---|---|
| **Proxy** (de protección) | `servicioProtegido.proxy.js` | Controla el acceso a una operación de negocio (por ejemplo, crear casos) antes de delegarla al servicio real. El servicio real no necesita saber nada de seguridad. Expone solo las operaciones configuradas y no se puede modificar después de creado. |
| **Chain of Responsibility** | `autenticar` → `requiereRol` / `requierePermiso` → ruta (en administración, `router.use(autenticar, requiereRol('Administrador'))` protege todas las rutas) | Cada eslabón revisa una sola cosa (identidad, luego permiso) y decide si pasa la petición al siguiente o la detiene con 401 o 403. Separa autenticación de autorización. |
| **Repository** | `acceso.repository.js`, `administracion.repository.js` | Aísla el SQL. Las reglas de negocio y el servicio no saben que existe MySQL; solo piden datos. |
| **Inyección de dependencias** | `crearServicioAcceso(repositorio, { reloj })`, `crearRepositorioAcceso(pool)`, `crearRutasAcceso(obtenerServicio)` | Cada pieza recibe lo que necesita en vez de crearlo. Por eso las pruebas pueden usar un pool falso o fijar la fecha actual sin tocar el código. |
| **Factory** (funciones fábrica) | `crearRepositorioAcceso`, `crearServicioAcceso`, `crearServicioProtegido`, `crearRutasAcceso` | Construyen objetos ya configurados con sus dependencias y validan que lo recibido sea correcto. |

Decisión: cada operación se protege con el middleware **o** con el proxy, no con ambos,
para no duplicar la verificación de permisos.

## Pruebas

| Tipo | Archivos | Qué comprueban |
|---|---|---|
| Unitarias | `autorizacion`, `codigos`, `contrasenas`, `limiteIntentos`, `errores`, `servicioProtegido.proxy`, `seed`, `acceso.repository`, `administracion.service`, `administracion.repository` | Cada función aislada; MySQL se reemplaza por un pool, una conexión o un repositorio falso |
| Integración (HTTP) | `acceso.ingreso`, `acceso.ingreso-docente`, `administracion.routes`, `autenticacion`, `autorizacion` (rutas) | Varias piezas juntas a través de peticiones HTTP con `supertest` |
| Integración (MySQL real) | `acceso.mysql` | Seed, creación de docente, permisos, ingreso de docente y de estudiante contra la base real |

```
npm test                                  # todas (la de MySQL real se salta)
node --test --experimental-test-coverage  # con reporte de cobertura
```

La prueba con MySQL real se activa a propósito y usa la base del `.env`. Todo ocurre dentro
de una transacción que se deshace al final, así que no deja datos guardados:

```
set LUMINA_MYSQL_TEST=1
node --test tests/acceso.mysql.test.js
```

## Colección de Postman

`acceso.postman_collection.json` tiene 17 peticiones con pruebas (ingreso del administrador,
administración RF-03, ingreso del docente e ingreso del estudiante). Guarda los tokens
automáticamente entre peticiones.

Con el servidor encendido (`npm run dev`) y el seed ejecutado, desde la raíz del proyecto:

```
npx --yes newman@6 run backend/src/modules/acceso/acceso.postman_collection.json --env-var "adminCorreo=..." --env-var "adminContrasena=..."
```

También se puede importar en Postman y escribir `adminCorreo` y `adminContrasena` en *Current value*.
La ejecución crea un docente de demostración con un correo único.

## Pendiente

- Nombres del resto del catálogo de permisos (hoy solo `CREAR_CASOS`).
- Guardar el límite de intentos fuera de la memoria si el sistema llega a usar varios servidores.
- Pantallas del frontend (cuando exista el proyecto de React).
- Umbral de ingreso tardío (RF-22), con la profesora.
- `Usuario.contrasenaHash` opcional en el esquema (Stefanía).
