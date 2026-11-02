## Datos iniciales (seed)

```
npm run db:seed
```

Crea los roles `Administrador`, `Docente` y `Estudiante`, el catálogo inicial de permisos
(`CREAR_CASOS`) y el primer administrador con su contraseña en hash. Toma los datos de
`ADMIN_CORREO`, `ADMIN_NOMBRES`, `ADMIN_APELLIDOS` y `ADMIN_CONTRASENA` del `.env`; después
de ejecutarlo se deja `ADMIN_CONTRASENA` vacía. No asigna permisos a los roles: eso lo hace
después el administrador. Se puede ejecutar varias veces sin duplicar datos y no cambia la
contraseña de un administrador que ya existe.

## Patrones de diseño

| Patrón | Dónde | Problema que resuelve |
|---|---|---|
| **Proxy** (de protección) | `servicioProtegido.proxy.js` | Controla el acceso a una operación de negocio (por ejemplo, crear casos) antes de delegarla al servicio real. El servicio real no necesita saber nada de seguridad. Expone solo las operaciones configuradas y no se puede modificar después de creado. |
| **Chain of Responsibility** | `autenticar` → `requiereRol` / `requierePermiso` → ruta | Cada eslabón revisa una sola cosa (identidad, luego permiso) y decide si pasa la petición al siguiente o la detiene con 401 o 403. Separa autenticación de autorización. |
| **Repository** | `acceso.repository.js` | Aísla el SQL. Las reglas de negocio y el servicio no saben que existe MySQL; solo piden datos. |
| **Inyección de dependencias** | `crearServicioAcceso(repositorio, { reloj })`, `crearRepositorioAcceso(pool)`, `crearRutasAcceso(obtenerServicio)` | Cada pieza recibe lo que necesita en vez de crearlo. Por eso las pruebas pueden usar un pool falso o fijar la fecha actual sin tocar el código. |
| **Factory** (funciones fábrica) | `crearRepositorioAcceso`, `crearServicioAcceso`, `crearServicioProtegido`, `crearRutasAcceso` | Construyen objetos ya configurados con sus dependencias y validan que lo recibido sea correcto. |

Decisión: cada operación se protege con el middleware **o** con el proxy, no con ambos,
para no duplicar la verificación de permisos.

## Pruebas

| Tipo | Archivos | Qué comprueban |
|---|---|---|
| Unitarias | `autorizacion`, `codigos`, `contrasenas`, `servicioProtegido.proxy`, `seed`, `acceso.repository` | Cada función aislada; MySQL se reemplaza por un pool o una conexión falsa |
| Integración | `acceso.ingreso`, `autenticacion` (rutas), `autorizacion` (rutas) | Varias piezas juntas a través de peticiones HTTP con `supertest` |

```
npm test                                  # todas las pruebas
node --test --experimental-test-coverage  # con reporte de cobertura
```

## Pendiente

- Nombres del catálogo de permisos.
- Ingreso de docente y administrador (ruta).
- Administración de docentes, roles y permisos (RF-03).
- Umbral de ingreso tardío (RF-22), con la profesora.
- `Usuario.contrasenaHash` opcional en el esquema (Stefanía).