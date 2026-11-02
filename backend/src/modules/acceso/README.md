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

Para generar una clave: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Endpoint

### `POST /api/acceso/estudiantes/ingreso`

```json
{ "correo": "estudiante@unihumboldt.edu.co", "codigo": "ABCD2345" }
```

| Respuesta | Cuándo |
|---|---|
| `200` `{ token, usuario: { id, roles, actividadId } }` | Correo y código correctos, convocatoria vigente |
| `400` | Falta el correo o el código |
| `401` | Correo o código no válidos (mismo mensaje en ambos casos) |
| `403` | Estudiante retirado o bloqueado, cuenta inactiva, fuera de la ventana, sesión finalizada o sin rol `Estudiante` |
| `404` | La actividad del código no existe |
| `500` | Error interno (sin detalles para el cliente) |

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
| `contrasenas.js` | Hash y verificación de contraseñas con scrypt |
| `tokens.js` | Firmar y verificar JWT |
| `autenticar.middleware.js` | Llena `req.usuario` a partir del token |
| `acceso.repository.js` | Consultas MySQL (solo lectura) |
| `acceso.service.js` | Ingreso del estudiante: repositorio → reglas → token |

Las pruebas están en `backend/tests/` y se ejecutan con `npm test`. No usan MySQL ni datos reales.

## Pendiente

- Nombres del catálogo de permisos.
- Seed del primer administrador.
- Ingreso de docente y administrador (ruta).
- Administración de docentes, roles y permisos (RF-03).
- Umbral de ingreso tardío (RF-22), con la profesora.
- `Usuario.contrasenaHash` opcional en el esquema (Stefanía).