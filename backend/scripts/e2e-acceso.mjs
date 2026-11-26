import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { pool } from '../src/config/database.js';
import { crearCodigoAutorizacion } from '../src/modules/acceso/codigos.js';

/**
 * Pruebas HTTP de punta a punta del módulo de Acceso (Sofía Gallego).
 * Servidor real + MySQL real: autenticación, tokens JWT, roles, permisos,
 * Proxy y que un usuario no ejecute operaciones que no le corresponden.
 *
 * Uso (con el servidor encendido en otra terminal, `npm start`):
 *   npm run test:e2e:acceso
 *
 * Variables (backend/.env):
 *   - E2E_ADMIN_CORREO y E2E_ADMIN_CONTRASENA: un administrador existente.
 *     Si no están, usa ADMIN_CORREO y ADMIN_CONTRASENA (las del seed).
 *   - E2E_URL: dirección del servidor (por defecto http://localhost:PORT).
 *
 * IMPORTANTE: úsalo con una base de PRUEBAS. Crea usuarios, un caso y
 * actividades con un sufijo único, y quita y vuelve a dar CREAR_CASOS al
 * rol Docente para probar el Proxy. Al final el rol Docente queda con
 * CREAR_CASOS.
 */

const BASE = process.env.E2E_URL || `http://localhost:${process.env.PORT || 3000}`;
const ADMIN = {
  correo: process.env.E2E_ADMIN_CORREO || process.env.ADMIN_CORREO,
  contrasena: process.env.E2E_ADMIN_CONTRASENA || process.env.ADMIN_CONTRASENA
};

if (!ADMIN.correo || !ADMIN.contrasena) {
  console.error('Faltan E2E_ADMIN_CORREO y E2E_ADMIN_CONTRASENA (o ADMIN_CORREO y ADMIN_CONTRASENA) en .env');
  process.exit(1);
}

const resultados = [];
const sufijo = Date.now();

async function insertar(sql, valores = []) {
  const [resultado] = await pool.execute(sql, valores);
  return resultado.insertId;
}

async function http(metodo, ruta, { token, body, encabezado } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (encabezado !== undefined) headers.Authorization = encabezado;
  else if (token) headers.Authorization = `Bearer ${token}`;
  const respuesta = await fetch(BASE + ruta, {
    method: metodo,
    headers,
    body: body && metodo !== 'GET' ? JSON.stringify(body) : undefined
  });
  let datos = null;
  try { datos = await respuesta.json(); } catch { /* sin cuerpo JSON */ }
  return { status: respuesta.status, datos };
}

function caso(id, descripcion, esperado, obtenido) {
  const ok = Array.isArray(esperado) ? esperado.includes(obtenido) : esperado === obtenido;
  resultados.push({ id, descripcion, esperado, obtenido, ok });
}

try {
  await http('GET', '/api/health');
} catch {
  console.error(`No hay servidor en ${BASE}. Enciéndelo con "npm start" en otra terminal.`);
  process.exit(1);
}

// ---------- 1. Autenticación ----------
let r = await http('POST', '/api/acceso/ingreso', { body: ADMIN });
caso('E2E-01', 'Administrador ingresa con credenciales válidas', 200, r.status);
const tokAdmin = r.datos?.token;
if (!tokAdmin) {
  console.error('El administrador no pudo ingresar: revisa E2E_ADMIN_CORREO y E2E_ADMIN_CONTRASENA.');
  process.exit(1);
}
caso('E2E-02', 'La respuesta trae token y no trae contraseña ni hash', true,
  !/contrasena|hash/i.test(JSON.stringify(r.datos)));
const datosToken = jwt.decode(tokAdmin);
caso('E2E-03', 'Token HS256, vence en 1 hora, trae sub y roles', true,
  jwt.decode(tokAdmin, { complete: true }).header.alg === 'HS256'
  && datosToken.exp - datosToken.iat === 3600
  && Boolean(datosToken.sub)
  && datosToken.roles.includes('Administrador'));

r = await http('POST', '/api/acceso/ingreso', { body: { correo: `  ${ADMIN.correo.toUpperCase()} `, contrasena: ADMIN.contrasena } });
caso('E2E-04', 'El correo se normaliza (mayúsculas y espacios)', 200, r.status);
r = await http('POST', '/api/acceso/ingreso', { body: { correo: `no-existe-${sufijo}@lumina.test`, contrasena: 'Cualquiera123!' } });
const mensajeNoExiste = r.datos?.error;
caso('E2E-05', 'Correo inexistente → 401', 401, r.status);
r = await http('POST', '/api/acceso/ingreso', { body: { correo: ADMIN.correo, contrasena: 'incorrecta' } });
caso('E2E-06', 'Contraseña incorrecta → 401 con el mismo mensaje que correo inexistente', true,
  r.status === 401 && r.datos?.error === mensajeNoExiste);
await http('POST', '/api/acceso/ingreso', { body: ADMIN }); // reinicia el contador del admin
r = await http('POST', '/api/acceso/ingreso', { body: { correo: ADMIN.correo } });
caso('E2E-07', 'Falta la contraseña → 400', 400, r.status);
r = await http('POST', '/api/acceso/ingreso', { body: { correo: ['x'], contrasena: { $ne: 1 } } });
caso('E2E-08', 'Tipos inválidos en el cuerpo → 400', 400, r.status);
const correoBloqueo = `bloqueo-${sufijo}@lumina.test`;
const estados = [];
for (let i = 0; i < 6; i += 1) {
  estados.push((await http('POST', '/api/acceso/ingreso', { body: { correo: correoBloqueo, contrasena: 'mala' } })).status);
}
caso('E2E-09', '5 fallos seguidos → el 6.º intento responde 429', '401,401,401,401,401,429', estados.join(','));

// ---------- 2. Rutas protegidas sin token o con token inválido ----------
r = await http('GET', '/api/acceso/admin/roles');
caso('E2E-10', 'Ruta protegida sin token → 401', 401, r.status);
r = await http('GET', '/api/acceso/admin/roles', { encabezado: `Basic ${tokAdmin}` });
caso('E2E-11', 'Esquema distinto de Bearer → 401', 401, r.status);
const [cabecera, cuerpo, firma] = tokAdmin.split('.');
const cuerpoAlterado = Buffer.from(JSON.stringify({ ...datosToken, roles: ['Administrador', 'Docente'], permisos: ['CREAR_CASOS'] })).toString('base64url');
r = await http('GET', '/api/acceso/admin/roles', { token: `${cabecera}.${cuerpoAlterado}.${firma}` });
caso('E2E-12', 'Token alterado (roles o permisos cambiados) → 401', 401, r.status);
const sinFirma = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${cuerpo}.`;
r = await http('GET', '/api/acceso/admin/roles', { token: sinFirma });
caso('E2E-13', 'Token con alg "none" (sin firma) → 401', 401, r.status);
const vencido = jwt.sign({ roles: ['Administrador'], permisos: [] }, process.env.JWT_SECRETO, { algorithm: 'HS256', subject: '1', expiresIn: -10 });
r = await http('GET', '/api/acceso/admin/roles', { token: vencido });
caso('E2E-14', 'Token vencido → 401 "La sesión expiró"', true, r.status === 401 && /expir/i.test(r.datos?.error ?? ''));
const otraClave = jwt.sign({ roles: ['Administrador'], permisos: [] }, `otra-clave-de-prueba-${'x'.repeat(32)}`, { algorithm: 'HS256', subject: '1', expiresIn: '1h' });
r = await http('GET', '/api/acceso/admin/roles', { token: otraClave });
caso('E2E-15', 'Token firmado con otra clave → 401', 401, r.status);
for (const [metodo, ruta] of [
  ['POST', '/api/casos'], ['GET', '/api/casos'], ['POST', '/api/actividades'],
  ['POST', '/api/sesiones/actividades/1/iniciar'], ['POST', '/api/participacion/respuestas'],
  ['GET', '/api/participacion/sesiones/1/respuestas']
]) {
  r = await http(metodo, ruta, { body: {} });
  caso('E2E-16', `Sin token ${metodo} ${ruta} → 401`, 401, r.status);
}

// ---------- 3. Administración (RF-03), roles y permisos (RF-02), Proxy ----------
r = await http('GET', '/api/acceso/admin/roles', { token: tokAdmin });
caso('E2E-17', 'Administrador lista roles', 200, r.status);
const correoDocente = `docente-${sufijo}@lumina.test`;
const claveDocente = 'Docente-Prueba-2026!';
r = await http('POST', '/api/acceso/admin/docentes', { token: tokAdmin, body: { nombres: 'Docente', apellidos: 'E2E', correo: correoDocente, contrasena: claveDocente } });
caso('E2E-18', 'Administrador crea docente (201) sin devolver contraseña ni hash', true,
  r.status === 201 && !/contrasena|hash/i.test(JSON.stringify(r.datos)));
const docenteId = r.datos?.data?.id;
r = await http('POST', '/api/acceso/admin/docentes', { token: tokAdmin, body: { nombres: 'Docente', apellidos: 'E2E', correo: correoDocente, contrasena: claveDocente } });
caso('E2E-19', 'Correo de docente repetido → 409', 409, r.status);
r = await http('POST', '/api/acceso/admin/docentes', { token: tokAdmin, body: { nombres: 'Docente', apellidos: 'E2E', correo: `debil-${sufijo}@lumina.test`, contrasena: '123' } });
caso('E2E-20', 'Contraseña débil → 400', 400, r.status);

// El Proxy se prueba con el rol Docente SIN CREAR_CASOS (404 si ya no lo tenía).
await http('DELETE', '/api/acceso/admin/roles/Docente/permisos/CREAR_CASOS', { token: tokAdmin });
r = await http('POST', '/api/acceso/ingreso', { body: { correo: correoDocente, contrasena: claveDocente } });
let tokDocente = r.datos?.token;
caso('E2E-21', 'Docente ingresa con contraseña', 200, r.status);
r = await http('GET', '/api/acceso/admin/roles', { token: tokDocente });
caso('E2E-22', 'Docente en ruta de administrador → 403', 403, r.status);
r = await http('POST', '/api/acceso/admin/docentes', { token: tokDocente, body: { nombres: 'X', apellidos: 'Y', correo: `x-${sufijo}@lumina.test`, contrasena: claveDocente } });
caso('E2E-23', 'Docente no puede crear docentes → 403', 403, r.status);
const casoNuevo = { titulo: `Caso E2E ${sufijo}`, desarrolloSituacional: 'Desarrollo', contextoHistoria: 'Contexto', tiempoEstimadoSegundos: 1800 };
r = await http('POST', '/api/casos', { token: tokDocente, body: casoNuevo });
caso('E2E-24', 'Proxy: docente SIN CREAR_CASOS → 403 en POST /api/casos', 403, r.status);
r = await http('POST', '/api/acceso/admin/roles/Docente/permisos', { token: tokAdmin, body: { permiso: 'CREAR_CASOS' } });
caso('E2E-25', 'Administrador da CREAR_CASOS al rol Docente', 201, r.status);
r = await http('POST', '/api/casos', { token: tokDocente, body: casoNuevo });
caso('E2E-26', 'Token emitido antes del cambio sigue sin el permiso → 403 (debe volver a ingresar)', 403, r.status);
r = await http('POST', '/api/acceso/ingreso', { body: { correo: correoDocente, contrasena: claveDocente } });
tokDocente = r.datos?.token;
caso('E2E-27', 'Al volver a ingresar, el token trae CREAR_CASOS', true, Boolean(jwt.decode(tokDocente ?? '')?.permisos?.includes('CREAR_CASOS')));
r = await http('POST', '/api/casos', { token: tokDocente, body: casoNuevo });
caso('E2E-28', 'Proxy: docente CON CREAR_CASOS crea el caso (201)', 201, r.status);
r = await http('DELETE', `/api/acceso/admin/usuarios/${datosToken.sub}/roles/Administrador`, { token: tokAdmin });
caso('E2E-29', 'El administrador no puede quitarse su propio rol → 409', 409, r.status);
r = await http('POST', '/api/acceso/admin/usuarios/abc/roles', { token: tokAdmin, body: { rol: 'Docente' } });
caso('E2E-30', 'Id de usuario inválido → 400', 400, r.status);
r = await http('POST', `/api/acceso/admin/usuarios/${docenteId}/roles`, { token: tokAdmin, body: { rol: 'RolInventado' } });
caso('E2E-31', 'Rol inexistente → 404', 404, r.status);
await pool.execute('UPDATE Usuario SET activo = FALSE WHERE id = ?', [docenteId]);
r = await http('POST', '/api/acceso/ingreso', { body: { correo: correoDocente, contrasena: claveDocente } });
caso('E2E-32', 'Docente inactivo no puede ingresar → 403', 403, r.status);
await pool.execute('UPDATE Usuario SET activo = TRUE WHERE id = ?', [docenteId]);
const estudianteApi = { nombres: 'Estudiante', apellidos: 'API', correo: `est-api-${sufijo}@lumina.test` };
r = await http('POST', '/api/acceso/admin/estudiantes', { token: tokAdmin, body: estudianteApi });
caso('E2E-51', 'Administrador crea estudiante (201) sin devolver contraseña ni hash', true,
  r.status === 201 && !/contrasena|hash/i.test(JSON.stringify(r.datos)));
r = await http('GET', '/api/acceso/admin/estudiantes', { token: tokAdmin });
caso('E2E-52', 'Administrador lista estudiantes e incluye el creado', true,
  r.status === 200 && r.datos?.data?.some((e) => e.correo === estudianteApi.correo));
r = await http('POST', '/api/acceso/admin/estudiantes', { token: tokDocente, body: { ...estudianteApi, correo: `x-${sufijo}@lumina.test` } });
caso('E2E-53', 'Docente no puede crear estudiantes en administración → 403', 403, r.status);
r = await http('POST', '/api/acceso/ingreso', { body: { correo: estudianteApi.correo, contrasena: 'cualquiera' } });
caso('E2E-54', 'El estudiante creado no puede entrar con contraseña → 401', 401, r.status);

// ---------- 4. Estudiantes: código de autorización (RF-01, RF-20) ----------
const [[rolEstudiante]] = await pool.execute("SELECT id FROM Rol WHERE nombre = 'Estudiante'");
async function crearEstudiante(nombre) {
  // Los estudiantes no usan contraseña; la columna es NOT NULL, se guarda un marcador.
  const id = await insertar(
    `INSERT INTO Usuario (nombres, apellidos, correoInstitucional, contrasenaHash, activo, fechaCreacion)
     VALUES ('Estudiante', ?, ?, 'sin-contrasena', TRUE, NOW())`,
    [nombre, `est-${nombre}-${sufijo}@lumina.test`]
  );
  await pool.execute('INSERT INTO UsuarioRol (usuario_id, rol_id, fechaAsignacion) VALUES (?, ?, NOW())', [id, rolEstudiante.id]);
  return id;
}
const estudiante1 = await crearEstudiante('uno');
const estudiante2 = await crearEstudiante('dos');
const espacioId = await insertar('INSERT INTO EspacioAcademico (nombre) VALUES (?)', [`Espacio E2E ${sufijo}`]);
const casoId = await insertar(
  `INSERT INTO Caso (creador_id, titulo, desarrolloSituacional, contextoHistoria, tiempoEstimadoSegundos, estado, fechaCreacion)
   VALUES (?, ?, 'Desarrollo', 'Contexto', 3600, 'Publicado', NOW())`,
  [docenteId, `Caso publicado E2E ${sufijo}`]
);
const rubricaId = await insertar('INSERT INTO Rubrica (caso_id, nombre, fechaCreacion) VALUES (?, ?, NOW())', [casoId, `Rúbrica E2E ${sufijo}`]);
async function crearActividad(inicio, fin, estado) {
  return insertar(
    `INSERT INTO ActividadProgramada (caso_id, espacioAcademico_id, docente_id, rubrica_id,
                                      fechaInicio, fechaFin, tiempoLimiteSegundos, fechaCreacion, estado)
     VALUES (?, ?, ?, ?, ${inicio}, ${fin}, 1800, NOW(), ?)`,
    [casoId, espacioId, docenteId, rubricaId, estado]
  );
}
const actividad1 = await crearActividad('DATE_SUB(NOW(), INTERVAL 1 HOUR)', 'DATE_ADD(NOW(), INTERVAL 1 HOUR)', 'Programada');
const actividad2 = await crearActividad('DATE_SUB(NOW(), INTERVAL 1 HOUR)', 'DATE_ADD(NOW(), INTERVAL 1 HOUR)', 'Programada');
const actividadFutura = await crearActividad('DATE_ADD(NOW(), INTERVAL 1 DAY)', 'DATE_ADD(NOW(), INTERVAL 2 DAY)', 'Programada');
async function autorizar(actividadId, estudianteId, estado = 'Autorizado') {
  const { codigo, codigoHash } = crearCodigoAutorizacion();
  await pool.execute(
    `INSERT INTO EstudianteAutorizado (actividad_id, estudiante_id, codigoAutorizacion, fechaAutorizacion, estado)
     VALUES (?, ?, ?, NOW(), ?)`,
    [actividadId, estudianteId, codigoHash, estado]
  );
  return codigo;
}
const codigo1 = await autorizar(actividad1, estudiante1);
const codigo2 = await autorizar(actividad2, estudiante2);
const codigoFuturo = await autorizar(actividadFutura, estudiante1);
const codigoRetirado = await autorizar(actividad2, estudiante1, 'Retirado');
// El docente inicia sus actividades por la API: así se preparan las sesiones
// de los estudiantes convocados, como en el flujo real.
for (const actividadId of [actividad1, actividad2]) {
  const inicio = await http('POST', `/api/actividades/${actividadId}/iniciar`, { token: tokDocente });
  if (inicio.status !== 200) {
    console.error(`No se pudo iniciar la actividad ${actividadId}: ${inicio.status} ${JSON.stringify(inicio.datos)}`);
  }
}
const [[guardado]] = await pool.execute(
  'SELECT codigoAutorizacion FROM EstudianteAutorizado WHERE actividad_id = ? AND estudiante_id = ?',
  [actividad1, estudiante1]
);
caso('E2E-33', 'En la base se guarda el hash del código, no el código', true,
  guardado.codigoAutorizacion !== codigo1 && /^[0-9a-f]{64}$/.test(guardado.codigoAutorizacion));

const correo1 = `est-uno-${sufijo}@lumina.test`;
r = await http('POST', '/api/acceso/estudiantes/ingreso', { body: { correo: correo1, codigo: codigo1.toLowerCase() } });
caso('E2E-34', 'Estudiante ingresa con correo + código (acepta minúsculas)', 200, r.status);
if (r.status === 403 && /todav[ií]a no ha comenzado/.test(r.datos?.error ?? '')) {
  console.warn('AVISO: MySQL y Node.js usan zonas horarias distintas. Revisa "Zona horaria" en el README de acceso.');
}
const tokEstudiante1 = r.datos?.token;
caso('E2E-35', 'El token del estudiante trae su actividadId', actividad1, jwt.decode(tokEstudiante1 ?? '')?.actividadId);
r = await http('POST', '/api/acceso/estudiantes/ingreso', { body: { correo: correo1, codigo: codigo2 } });
caso('E2E-36', 'Código de OTRO estudiante → 401', 401, r.status);
r = await http('POST', '/api/acceso/estudiantes/ingreso', { body: { correo: correo1, codigo: 'ZZZZZZZZ' } });
caso('E2E-37', 'Código inexistente → 401', 401, r.status);
r = await http('POST', '/api/acceso/estudiantes/ingreso', { body: { correo: correo1, codigo: codigoFuturo } });
caso('E2E-38', 'Actividad que todavía no empieza → 403', 403, r.status);
r = await http('POST', '/api/acceso/estudiantes/ingreso', { body: { correo: correo1, codigo: codigoRetirado } });
caso('E2E-39', 'Estudiante Retirado de la convocatoria → 403', 403, r.status);
r = await http('POST', '/api/acceso/ingreso', { body: { correo: correo1, contrasena: 'algo' } });
caso('E2E-40', 'Estudiante no puede usar el ingreso con contraseña → 401', 401, r.status);

// ---------- 5. Operaciones que no le corresponden al usuario ----------
r = await http('GET', '/api/acceso/admin/roles', { token: tokEstudiante1 });
caso('E2E-41', 'Estudiante en ruta de administrador → 403', 403, r.status);
r = await http('POST', '/api/casos', { token: tokEstudiante1, body: casoNuevo });
caso('E2E-42', 'Estudiante intenta crear caso → 403 (Proxy)', 403, r.status);
r = await http('PATCH', `/api/casos/${casoId}`, { token: tokEstudiante1, body: { titulo: 'x' } });
caso('E2E-43', 'Estudiante intenta editar caso → 403 (requierePermiso)', 403, r.status);
r = await http('POST', `/api/sesiones/actividades/${actividad2}/iniciar`, { token: tokEstudiante1 });
caso('E2E-44', 'Estudiante inicia sesión en una actividad que NO es la suya → 403', 403, r.status);
r = await http('POST', `/api/sesiones/actividades/${actividad1}/iniciar`, { token: tokEstudiante1 });
caso('E2E-45', 'Estudiante inicia sesión en SU actividad', [200, 201], r.status);
const sesionId = r.datos?.data?.id ?? r.datos?.sesion?.id;
r = await http('POST', `/api/sesiones/actividades/${actividad1}/iniciar`, { token: tokDocente });
caso('E2E-46', 'Docente en la ruta de sesión del estudiante → 403 (requiereRol)', 403, r.status);
r = await http('POST', '/api/acceso/estudiantes/ingreso', { body: { correo: `est-dos-${sufijo}@lumina.test`, codigo: codigo2 } });
const tokEstudiante2 = r.datos?.token;
r = await http('GET', `/api/participacion/sesiones/${sesionId}/respuestas`, { token: tokEstudiante2 });
caso('E2E-47', 'Otro estudiante consulta respuestas de una sesión ajena → 403', 403, r.status);
r = await http('POST', `/api/sesiones/${sesionId}/finalizar`, { token: tokEstudiante2 });
caso('E2E-48', 'Otro estudiante finaliza una sesión ajena → 403', 403, r.status);
r = await http('POST', `/api/actividades/${actividad1}/cerrar`, { token: tokEstudiante1 });
caso('E2E-49', 'Estudiante intenta cerrar una actividad → 403', 403, r.status);
const enDias = (dias) => new Date(Date.now() + dias * 86400000).toISOString().slice(0, 16);
r = await http('POST', '/api/actividades', {
  token: tokEstudiante1,
  body: { casoId, espacioAcademicoId: espacioId, rubricaId, fechaInicio: enDias(1), fechaFin: enDias(2), tiempoLimiteSegundos: 1800, estudiantesIds: [estudiante2] }
});
caso('E2E-50', 'Estudiante intenta programar una actividad → 403', 403, r.status);

// ---------- Resumen ----------
let fallidos = 0;
for (const x of resultados) {
  if (!x.ok) fallidos += 1;
  console.log(`${x.ok ? 'OK' : 'FALLA'}  ${x.id}  ${x.descripcion}  (esperado ${x.esperado}, obtenido ${x.obtenido})`);
}
console.log(`\nTotal: ${resultados.length} · correctas: ${resultados.length - fallidos} · fallidas: ${fallidos}`);
await pool.end();
process.exitCode = fallidos === 0 ? 0 : 1;
