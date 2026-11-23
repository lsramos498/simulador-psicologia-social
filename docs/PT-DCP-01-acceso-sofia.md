# PT-DCP-01 — Aporte Sofía Gallego (módulo Acceso y permisos)

Filas para consolidar en el plan de pruebas del segundo corte, con el mismo formato del aporte del módulo Casos.
**Solo se registran resultados de pruebas realmente ejecutadas el 8 de noviembre de 2026.**

Comandos ejecutados (en `backend`):

```bash
npm test
# Prueba con MySQL real, en una base de pruebas aparte (proyecto_nuclear_test):
set LUMINA_MYSQL_TEST=1
set DB_NAME=proyecto_nuclear_test
node --test tests/acceso.mysql.test.js
```

Resultado global:

- `npm test` (todo el backend): **333** pruebas, **331** aprobadas, **0** fallidas, 2 omitidas (las dos pruebas con MySQL real, que se activan aparte).
- Módulo de acceso: **183** pruebas en 18 archivos, 182 aprobadas, 0 fallidas, 1 omitida (la de MySQL real).
- Prueba con MySQL real del módulo de acceso: **5** pruebas, **5** aprobadas, 0 fallidas.

### Actualización del 19 de noviembre de 2026 (después de integrar develop)

- Se restauró `requiereRol(ESTUDIANTE)` en `POST /api/sesiones/actividades/:actividadId/iniciar`: se había perdido al resolver conflictos del merge (commit `1c1c985`). Lo verifica E2E-46.
- La prueba de punta a punta se adaptó al flujo actual: el docente inicia la actividad por la API y así se preparan las sesiones de los estudiantes.
- Pruebas para las rutas nuevas de estudiantes en administración (CP-ADM-07 y CP-ADM-08, CP-E2E-06).
- `npm test`: **446** pruebas, **443** aprobadas, **0** fallidas, 3 omitidas (las de MySQL real). Con MySQL real: **11** de **11**.
- Punta a punta: **59** comprobaciones, **59** correctas, 0 fallidas.

### Actualización del 14 de noviembre de 2026 (cierre del módulo)

Se corrigieron dos fallos del módulo (ver CP-ACC-11, CP-JWT-03 y CP-ERR-02) y se agregó una prueba de punta a punta con el servidor encendido y MySQL real (`scripts/e2e-acceso.mjs`, filas CP-E2E-01 a CP-E2E-05).

```bash
npm test
set LUMINA_MYSQL_TEST=1
node --test tests/acceso.mysql.test.js
set LUMINA_MYSQL_TEST=
# con el servidor encendido en otra terminal (npm start):
npm run test:e2e:acceso
```

- `npm test` (todo el backend): **397** pruebas, **395** aprobadas, **0** fallidas, 2 omitidas (las de MySQL real).
- Prueba con MySQL real del módulo de acceso: **5** pruebas, **5** aprobadas.
- Punta a punta (servidor + MySQL real): **55** comprobaciones, **55** correctas, 0 fallidas.
- Colección de Postman (newman): **17** peticiones y **26** aserciones, 0 fallidas.

Tipos de prueba: **unitaria** (función aislada, base de datos simulada), **integrada HTTP** (petición real a la API con `supertest`) e **integrada MySQL** (persistencia real dentro de una transacción que se deshace al final).

---

## Casos de prueba (módulo Acceso y permisos)

| ID | Requisito | Módulo | Objetivo | Precondiciones | Pasos | Datos de entrada | Resultado esperado | Resultado obtenido | Veredicto | Evidencias | Defectos / observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CP-ACC-01 | RF-01, RF-20 | Acceso | Ingreso del estudiante con correo y código | Estudiante autorizado en una convocatoria vigente (repositorio simulado) | `POST /api/acceso/estudiantes/ingreso` | Correo institucional y código válidos | 200 con JWT del estudiante y su `actividadId` | 200 con token | **Aprobado** | `acceso.ingreso.test.js`; EV-01 | — |
| CP-ACC-12 | RF-10, RF-20 | Acceso / Casos | El estudiante solo consulta el caso de su actividad | Estudiante con `actividadId` en el token; casos de su actividad y de otra | `GET /api/casos/:id` de su caso y de otro; `GET /api/casos`; estudiante sin actividad; actividad inexistente; docente y admin; consulta que falla; sin token | Token de estudiante, docente y admin | 200 con su caso; 403 en otro caso sin consultar el servicio; listado solo con su caso; 403; 403; docente y admin ven todo; 500 sin detalles; 401 | Igual a lo esperado | **Aprobado** | `acceso.caso-autorizado.test.js` | Corregido el 22/11: antes cualquier estudiante autenticado veía cualquier caso. Verificado también con servidor y MySQL real |
| CP-ACC-11B | RF-01, RF-20 | Acceso | Reenviar el código sin exponerlo | Estudiante convocado; servicio de correo con SMTP real, en modo demo o fallando | `POST /api/acceso/estudiantes/enviar-codigo` con correo convocado, no convocado, inactivo, sin correo; 6 solicitudes seguidas; sin servicio de correo | Correos de prueba | 200 genérico igual para todos; el código solo va al correo y nunca en la respuesta; no se reemplaza si el correo no salió; 429 en la 6.ª; 400; 503 igual para cualquier correo | Igual a lo esperado | **Aprobado** | `acceso.enviar-codigo.test.js` | Corregido el 19/11: antes la respuesta devolvía el código cuando el correo no salía por SMTP real |
| CP-ACC-02 | RF-02, RF-03 | Acceso | Ingreso del docente con correo y contraseña | Docente activo con contraseña en hash | `POST /api/acceso/ingreso` | Correo y contraseña válidos | 200 con token; la respuesta no incluye el hash | 200, sin hash | **Aprobado** | `acceso.ingreso-docente.test.js`; colección Postman | — |
| CP-ACC-03 | RF-03 | Acceso | Ingreso del administrador | Administrador creado con `npm run db:seed` | `POST /api/acceso/ingreso` | Credenciales del administrador | 200 con rol Administrador | 200 | **Aprobado** | `acceso.ingreso-docente.test.js`; colección Postman | — |
| CP-ACC-04 | RF-01 | Acceso | Rechazar datos incompletos | — | Ingreso sin correo, sin código o sin contraseña | Cuerpo incompleto | 400 | 400 | **Aprobado** | `acceso.ingreso.test.js`, `acceso.ingreso-docente.test.js` | — |
| CP-ACC-05 | RF-02 | Acceso | Rechazar contraseña incorrecta | Docente existente | `POST /api/acceso/ingreso` | Contraseña errada | 401 | 401 | **Aprobado** | `acceso.ingreso-docente.test.js` | — |
| CP-ACC-06 | RF-02 | Acceso | Usuario inexistente sin revelar qué correos existen | — | `POST /api/acceso/ingreso` | Correo no registrado | 401 con el mismo mensaje que contraseña incorrecta | 401, mismo mensaje | **Aprobado** | `acceso.ingreso-docente.test.js` | — |
| CP-ACC-07 | RF-01, RF-02 | Acceso | Rechazar cuentas inactivas | Usuario con `activo = 0` | Ingreso de docente y de estudiante | Cuenta inactiva | 403 | 403 | **Aprobado** | `acceso.ingreso-docente.test.js`, `codigos.test.js` | — |
| CP-ACC-08 | RF-01 | Acceso | El estudiante solo entra con código | Usuario con rol Estudiante | `POST /api/acceso/ingreso` | Correo de estudiante y contraseña | 403 (API) / 401 (colección, usuario sin contraseña) | 403 / 401 | **Aprobado** | `acceso.ingreso-docente.test.js`; colección Postman | — |
| CP-ACC-09 | RF-02 | Acceso | Bloqueo tras intentos fallidos con contraseña | Docente existente | 5 contraseñas incorrectas y luego la correcta | Contraseña errada ×5 | 429 aunque la sexta sea correcta | 429 | **Aprobado** | `acceso.ingreso-docente.test.js`, `limiteIntentos.test.js` | Observación: refuerzo de seguridad pedido por la coordinación; no está en la hoja del 16 de octubre |
| CP-ACC-11 | RF-01, RF-02 | Acceso | Los fallos viejos vencen | Límite de 5 fallos en 15 minutos | 4 fallos, pasar un día, 1 fallo más | Reloj simulado | No bloquea; solo bloquean 5 fallos seguidos dentro de la ventana | No bloquea / bloquea dentro de la ventana | **Aprobado** | `limiteIntentos.test.js` | Defecto corregido el 14/11: antes los fallos no vencían y 4 errores un día más 1 otro día bloqueaban la cuenta |
| CP-ACC-10 | RF-01, RF-20 | Acceso | Bloqueo tras intentos fallidos con código | — | 5 códigos incorrectos para el mismo correo | Código errado ×5 | 429 en el sexto intento | 429 | **Aprobado** | `acceso.ingreso.test.js` | Misma observación de CP-ACC-09 |
| CP-JWT-01 | RF-02 | Acceso | Firma y verificación del token | `JWT_SECRETO` configurado | Firmar y verificar un JWT | Usuario con roles y permisos | Conserva id, roles y permisos; dura 1 hora | Correcto | **Aprobado** | `autenticacion.test.js` | — |
| CP-JWT-02 | RF-02 | Acceso | Rechazar token alterado, sin firma, de otra clave o vencido | — | Verificar tokens inválidos | Token modificado, `alg: none`, otra clave, vencido | 401 | 401 | **Aprobado** | `autenticacion.test.js` | — |
| CP-JWT-03 | RF-02 | Acceso | Formato estricto del encabezado | — | Llamar `/perfil` con `bearer <token>` y con `Bearer <token> extra` | Encabezados distintos | 200 (el esquema no distingue mayúsculas) / 401 (partes de más) | 200 / 401 | **Aprobado** | `autenticacion.test.js` | Corregido el 14/11: antes se aceptaban partes de más y se rechazaba `bearer` en minúscula |
| CP-AUT-01 | RF-02 | Acceso | Rutas protegidas sin autenticación | — | Llamar rutas de administración, casos, actividades y participación sin token | Sin `Authorization` | 401 | 401 | **Aprobado** | `autorizacion.test.js`, `administracion.routes.test.js`, `rutas.montadas.test.js`; colección Postman | — |
| CP-AUT-02 | RF-02 | Acceso | Restricción por rol | Docente y estudiante autenticados | Llamar rutas de administrador | Token de docente o estudiante | 403 | 403 | **Aprobado** | `autorizacion.test.js`, `administracion.routes.test.js`; colección Postman | — |
| CP-AUT-03 | RF-02 | Acceso | Permiso por operación | Docente con y sin `CREAR_CASOS` | Crear caso | Token con y sin permiso | 201 con permiso, 403 sin permiso | 201 / 403 | **Aprobado** | `autorizacion.test.js`, `autenticacion.test.js` | — |
| CP-AUT-04 | RF-02 | Acceso | Usuario sin roles | Usuario sin registros en `UsuarioRol` | Evaluar reglas e ingresar | Usuario sin roles | Sin acceso; 403 al ingresar | 403 | **Aprobado** | `autorizacion.test.js`, `acceso.ingreso-docente.test.js` | — |
| CP-AUT-05 | RF-01, RF-20 | Acceso | El estudiante solo accede a la actividad de su código | Token de estudiante con `actividadId` 5 | `POST /actividades/:id/sesiones` (ruta de ejemplo) con la actividad 5, la 8 y una inválida; sin token; con docente | Tokens de estudiante y docente | 201 en su actividad; 403 en otra o inválida, sin ejecutar la ruta; 401 sin token; el docente pasa | Igual a lo esperado | **Aprobado** | `actividadAutorizada.test.js` | Integrado en develop (PR #10): la ruta `POST /api/sesiones/actividades/:actividadId/iniciar` usa `requiereRol(ESTUDIANTE)` y `requiereActividadAutorizada`. Verificado de punta a punta (CP-E2E-05). El 19/11 se restauró `requiereRol`, que se había perdido en un merge |
| CP-ADM-01 | RF-03 | Acceso | Crear docente | Administrador autenticado | `POST /api/acceso/admin/docentes` | Nombres, apellidos, correo, contraseña | 201 con rol Docente; contraseña guardada en hash y no devuelta | 201, sin contraseña | **Aprobado** | `administracion.service.test.js`, `administracion.routes.test.js`; colección Postman | — |
| CP-ADM-02 | RF-03 | Acceso | Validar datos del docente | Administrador autenticado | Crear docente sin datos, con correo inválido o repetido | Datos incompletos / correo existente | 400 / 409 | 400 / 409 | **Aprobado** | `administracion.service.test.js`; colección Postman | — |
| CP-ADM-03 | RF-03 | Acceso | Política de contraseñas al crear docentes | Administrador autenticado | Crear docente con contraseñas débiles | `corta1`, `sinnumeros` | 400 y no se crea el usuario | 400, sin usuario | **Aprobado** | `administracion.service.test.js`, `contrasenas.test.js` | Observación: refuerzo de seguridad pedido por la coordinación; no está en la hoja del 16 de octubre |
| CP-ADM-04 | RF-03 | Acceso | Asignar y quitar roles | Administrador autenticado | Asignar y quitar el rol Docente | Usuario y rol | 200; rol inexistente 404 | 200 / 404 | **Aprobado** | `administracion.routes.test.js` | — |
| CP-ADM-05 | RF-02, RF-03 | Acceso | Asignar y quitar permisos | Administrador autenticado | Dar y quitar `CREAR_CASOS` al rol Docente | Rol y permiso | Aparece y desaparece; permiso inexistente 404 | Correcto / 404 | **Aprobado** | `administracion.service.test.js`, `administracion.routes.test.js`; colección Postman | — |
| CP-ADM-07 | RF-03, RF-04 | Acceso | Crear estudiante | Administrador autenticado | `POST /api/acceso/admin/estudiantes` con datos válidos, incompletos, correo inválido, muy largos y repetidos | Nombres, apellidos y correo | 201 con rol Estudiante y sin hash; hash aleatorio con el que ninguna contraseña entra; 400; 400; 400; 409 sin crear | Igual a lo esperado | **Aprobado** | `administracion.service.test.js`, `administracion.routes.test.js` | Rutas agregadas por Stefanía en el PR #12; pruebas agregadas el 19/11 |
| CP-ADM-08 | RF-03 | Acceso | Listar estudiantes y restricciones | Administrador, docente y estudiante autenticados | `GET /api/acceso/admin/estudiantes`; crear y listar con docente, estudiante y sin token | — | 200 solo con estudiantes y sin contraseñas; 403 para docente y estudiante; 401 sin token | Igual a lo esperado | **Aprobado** | `administracion.service.test.js`, `administracion.routes.test.js` | — |
| CP-ADM-06 | RF-03 | Acceso | Restricciones de administración | Docente y administrador autenticados | Docente intenta darse permisos; administrador intenta quitarse su rol | — | 403 / 409 | 403 / 409 | **Aprobado** | `administracion.routes.test.js`; colección Postman | — |
| CP-COD-01 | RF-20 | Acceso | Generar códigos de autorización | — | Generar códigos sucesivos | — | 8 caracteres, sin caracteres confusos, distintos entre sí | Correcto | **Aprobado** | `codigos.test.js` | — |
| CP-COD-02 | RF-20 | Acceso | Guardar solo el hash del código | `CODIGO_AUTORIZACION_SECRETO` configurado | Hashear un código | Código | HMAC-SHA256 de 64 caracteres que no contiene el código | Correcto | **Aprobado** | `codigos.test.js` | — |
| CP-COD-03 | RF-01, RF-20 | Acceso | Rechazar código incorrecto o de otro estudiante | — | Ingresar con código inexistente o ajeno | Código errado / de otra persona | 401 | 401 | **Aprobado** | `codigos.test.js`, `acceso.ingreso.test.js`; colección Postman | — |
| CP-COD-04 | RF-01, RF-20 | Acceso | Restricciones según convocatoria y sesión | Convocatoria con fechas y sesión | Ingresar retirado, bloqueado, antes del inicio, después del fin o con sesión finalizada | — | 403 | 403 | **Aprobado** | `codigos.test.js`, `acceso.ingreso.test.js` | Umbral de ingreso tardío (RF-22) pendiente de la docente |
| CP-PRX-01 | RF-02 | Acceso | Proxy con usuario autorizado | Usuario con `CREAR_CASOS` | Llamar `crear` a través del proxy | Datos del caso | Delega en el servicio real | Delegó | **Aprobado** | `servicioProtegido.proxy.test.js` | — |
| CP-PRX-02 | RF-02 | Acceso | Proxy con usuario no autorizado o sin autenticar | — | Llamar sin permiso y sin usuario | — | 403 / 401 y el servicio real no se ejecuta | 403 / 401, 0 llamadas | **Aprobado** | `servicioProtegido.proxy.test.js` | — |
| CP-PRX-03 | RF-02 | Acceso | Solo operaciones configuradas | — | Usar una operación no configurada; agregar una después de crear el proxy | — | No existe; no se puede agregar (`Object.freeze`) | Correcto | **Aprobado** | `servicioProtegido.proxy.test.js` | — |
| CP-PRX-04 | RF-02 | Acceso / Casos | Proxy en la ruta real de crear casos | App de prueba con servicio de casos simulado | `POST /api/casos` | Docente con y sin permiso, estudiante, sin token | 201 / 403 / 403 / 401; en los rechazos el servicio no se ejecuta | Igual a lo esperado | **Aprobado** | `casos.proxy.test.js` | Aplicación acordada con Stefanía el 08/11 |
| CP-ERR-01 | RF-02 | Acceso | Errores sin información sensible | Falla simulada de la base de datos | Provocar un error interno | Error con SQL y nombres de tablas | 500 con mensaje genérico | 500 genérico | **Aprobado** | `errores.test.js`, `acceso.ingreso.test.js` | — |
| CP-ERR-02 | RF-02 | Acceso | Falta de configuración no se reporta como error del cliente | Servidor sin `JWT_SECRETO` | Llamar una ruta protegida con un token | Token válido | 500 con mensaje genérico | 500 genérico | **Aprobado** | `autenticacion.test.js` | Corregido el 14/11: antes respondía 401 y ocultaba el error de configuración |
| CP-SQL-01 | RF-01, RF-03, RF-20 | Acceso | Persistencia real en MySQL | Base `proyecto_nuclear_test` con el esquema; usuario `lumina_app` con SELECT, INSERT, UPDATE, DELETE | Seed; administrador crea docente y le da `CREAR_CASOS`; ingreso del docente; ingreso del estudiante con código | Datos de prueba creados por la prueba | Todo funciona con persistencia real y se deshace al final | 5/5 aprobadas | **Aprobado** | `acceso.mysql.test.js`; EV-02 | — |
| CP-E2E-01 | RF-01, RF-02, RF-03 | Acceso | Ingreso real y tokens | Servidor encendido; MySQL real con seed | E2E-01 a E2E-09 | Credenciales válidas, inválidas, tipos inválidos, 6 intentos | 200 con JWT HS256 de 1 hora sin hash; 401 con el mismo mensaje; 400; 429 en el 6.º intento | Igual a lo esperado | **Aprobado** | `scripts/e2e-acceso.mjs` | — |
| CP-E2E-02 | RF-02 | Acceso | Tokens inválidos y rutas sin token | Servidor encendido | E2E-10 a E2E-16 | Sin token, esquema `Basic`, token alterado, `alg: none`, vencido, otra clave; rutas de casos, actividades, sesiones y participación | 401 en todos los casos | 401 | **Aprobado** | `scripts/e2e-acceso.mjs` | — |
| CP-E2E-03 | RF-02, RF-03 | Acceso / Casos | Administración, permisos y Proxy | Administrador del seed | E2E-17 a E2E-32 | Docente sin y con `CREAR_CASOS` | 403 en `POST /api/casos` sin permiso; 403 con el token anterior al cambio; 201 al volver a ingresar; 403 en rutas de administrador; 409, 400, 404 según el caso; 403 con la cuenta inactiva | Igual a lo esperado | **Aprobado** | `scripts/e2e-acceso.mjs` | Los cambios de permisos se aplican al volver a ingresar (viajan en el token) |
| CP-E2E-04 | RF-01, RF-20 | Acceso | Código del estudiante con MySQL real | Convocatorias vigente, futura y con estudiante retirado | E2E-33 a E2E-40 | Código propio, ajeno, inexistente, futuro, retirado | Hash guardado; 200 con `actividadId`; 401 / 401 / 403 / 403; 401 con contraseña | Igual a lo esperado | **Aprobado** | `scripts/e2e-acceso.mjs` | Requiere la misma zona horaria en Node.js y MySQL (ver README de acceso) |
| CP-E2E-05 | RF-01, RF-02, RF-20 | Acceso / todos | Un usuario no ejecuta operaciones que no le corresponden | Dos estudiantes, un docente | E2E-41 a E2E-50 | Tokens de estudiante y docente | Estudiante: 403 en administración, crear y editar casos, actividad ajena, sesión ajena, cerrar y programar actividades; 200 en su propia actividad. Docente: 403 en la ruta de sesión del estudiante | Igual a lo esperado | **Aprobado** | `scripts/e2e-acceso.mjs` | — |
| CP-E2E-06 | RF-03 | Acceso | Estudiantes creados por la API | Servidor encendido; administrador y docente | E2E-51 a E2E-54 | Estudiante nuevo | 201 sin hash; aparece en el listado; 403 para el docente; 401 si intenta entrar con contraseña | Igual a lo esperado | **Aprobado** | `scripts/e2e-acceso.mjs` | — |

## Observaciones

- La política de contraseñas (CP-ADM-03) y el límite de intentos (CP-ACC-09, CP-ACC-10) se agregaron como refuerzo de seguridad solicitado por la coordinación. No aparecen en la hoja de requisitos del 16 de octubre.
- Integración: Node.js y MySQL deben usar la misma zona horaria; si difieren, el ingreso del estudiante responde 403 "La actividad todavía no ha comenzado" con fechas creadas con `NOW()` (la prueba de punta a punta lo avisa).
- `Usuario.contrasenaHash` sigue siendo `NOT NULL` en el esquema. Resuelto sin cambiar el esquema: `POST /api/acceso/admin/estudiantes` guarda un hash aleatorio que nadie conoce (CP-ADM-07).
- CP-06 a CP-10 de la plantilla oficial: pendiente de recibir su definición para asignar estos casos a esa numeración.

## Evidencia de ejecución

- Fecha: 2026-11-08
- Entorno: Node.js, `node --test`, MySQL 8.0 (prueba con MySQL real)
- Rama: `feature/sofia-acceso-mejoras`
- Responsable: Sofía Gallego Bedoya
- Capturas: EV-01 (`npm test`), EV-02 (prueba con MySQL real), EV-03 (colección de Postman)

Actualización del cierre:

- Fecha: 2026-11-14
- Entorno: Node.js, `node --test`, MySQL 8.0, servidor encendido (`npm start`)
- Rama: `feature/sofia-acceso-cierre`
- Capturas: EV-04 (`npm test`), EV-05 (`npm run test:e2e:acceso`)

Actualización después de integrar develop:

- Fecha: 2026-11-19
- Rama: `feature/sofia-acceso-integracion`
- Capturas: EV-06 (`npm test`), EV-07 (`npm run test:e2e:acceso`)
