import { ROLES, tienePermiso, tieneRol } from './autorizacion.js';

/**
 * Middlewares de autorización para proteger rutas.
 * Deben usarse DESPUÉS del middleware de autenticación,
 * que es el encargado de llenar req.usuario.
 *
 *   401 → no hay usuario autenticado (no sabemos quién es)
 *   403 → sabemos quién es, pero no tiene autorización
 *
 * Los middlewares comparten el mismo eslabón de la cadena; solo cambia
 * la regla que deciden (rol, permiso o actividad) y el mensaje del 403.
 */

function crearEslabonAutorizacion(estaAutorizado, mensajeProhibido) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Debe autenticarse para continuar' });
    }

    if (!estaAutorizado(req.usuario, req)) {
      return res.status(403).json({ error: mensajeProhibido });
    }

    return next();
  };
}

export function requiereRol(...rolesPermitidos) {
  // Falla al definir la ruta, no en cada petición
  if (rolesPermitidos.length === 0) {
    throw new TypeError('requiereRol necesita al menos un rol');
  }

  return crearEslabonAutorizacion(
    (usuario) => tieneRol(usuario, ...rolesPermitidos),
    'No tiene el rol requerido para esta operación'
  );
}

export function requierePermiso(permiso) {
  // Falla al definir la ruta, no en cada petición
  if (!permiso || typeof permiso !== 'string') {
    throw new TypeError('requierePermiso necesita el nombre del permiso');
  }

  return crearEslabonAutorizacion(
    (usuario) => tienePermiso(usuario, permiso),
    'No tiene permiso para realizar esta operación'
  );
}

/**
 * RF-01 / RF-20: un estudiante solo puede entrar a la actividad de su código.
 * Su token trae la actividadId de la convocatoria con la que ingresó; si la
 * ruta pide otra actividad, responde 403.
 *
 * Docentes y administradores pasan: sus restricciones (por ejemplo, ser el
 * dueño de la actividad) las aplica el módulo de actividades.
 *
 *   router.post('/:id/sesiones', autenticar, requiereActividadAutorizada(), iniciarSesion);
 *
 * obtenerActividadId indica de dónde sale la actividad de la ruta
 * (por defecto, req.params.id).
 */
export function requiereActividadAutorizada(obtenerActividadId = (req) => req.params?.id) {
  if (typeof obtenerActividadId !== 'function') {
    throw new TypeError('requiereActividadAutorizada necesita una función que entregue la actividad');
  }

  // Login OTP de sesión: el JWT no fija actividadId; se valida convocatoria en BD.
  // Login legacy (código de actividad): actividadId del token debe coincidir.
  return async (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Debe autenticarse para continuar' });
    }

    if (!tieneRol(req.usuario, ROLES.ESTUDIANTE)) {
      return next();
    }

    const actividadPedida = Number(obtenerActividadId(req));
    if (!Number.isInteger(actividadPedida) || actividadPedida <= 0) {
      return res.status(403).json({ error: 'No está autorizado para esta actividad' });
    }

    if (Number(req.usuario.actividadId) === actividadPedida) {
      return next();
    }

    try {
      const { pool } = await import('../../config/database.js');
      const consulta = pool.execute(
        `SELECT 1 AS ok
           FROM EstudianteAutorizado
          WHERE actividad_id = ?
            AND estudiante_id = ?
            AND estado = 'Autorizado'
          LIMIT 1`,
        [actividadPedida, Number(req.usuario.id)]
      );
      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timeout-autorizacion-actividad')), 2500);
      });
      const [filas] = await Promise.race([consulta, timeout]);
      if (filas.length > 0) {
        return next();
      }
    } catch {
      return res.status(403).json({ error: 'No está autorizado para esta actividad' });
    }

    return res.status(403).json({ error: 'No está autorizado para esta actividad' });
  };
}

/**
 * RF-10 / RF-20: un estudiante solo puede consultar el caso de SU actividad
 * (la actividadId que trae su token desde el ingreso con código).
 *
 *   router.get('/:id', autenticar, requiereCasoDeSuActividad(buscarCasoDeActividad), verCaso);
 *
 * - buscarCasoDeActividad(actividadId) → id del caso de esa actividad (o null).
 * - obtenerCasoPedido(req) indica qué caso pide la ruta (por defecto req.params.id).
 * Si la ruta no pide un caso concreto (por ejemplo, el listado), deja en
 * req.casoAutorizadoId el caso permitido para que la ruta filtre.
 *
 * Docentes y administradores pasan: sus reglas las aplica el módulo de casos.
 * Responde 401 sin usuario, 403 si el caso no es el de su actividad y 500
 * (sin detalles) si falla la consulta.
 */
export function requiereCasoDeSuActividad(
  buscarCasoDeActividad,
  obtenerCasoPedido = (req) => req.params?.id
) {
  // Falla al definir la ruta, no en cada petición
  if (typeof buscarCasoDeActividad !== 'function' || typeof obtenerCasoPedido !== 'function') {
    throw new TypeError('requiereCasoDeSuActividad necesita funciones para buscar y leer el caso');
  }

  return async (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Debe autenticarse para continuar' });
    }
    if (!tieneRol(req.usuario, ROLES.ESTUDIANTE)) {
      return next();
    }

    const actividadId = Number(req.usuario.actividadId);
    if (!Number.isInteger(actividadId) || actividadId <= 0) {
      return res.status(403).json({ error: 'No está autorizado para este caso' });
    }

    let casoPermitido;
    try {
      casoPermitido = Number(await buscarCasoDeActividad(actividadId));
    } catch (error) {
      console.error('No se pudo verificar el caso del estudiante:', error?.message);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
    if (!Number.isInteger(casoPermitido) || casoPermitido <= 0) {
      return res.status(403).json({ error: 'No está autorizado para este caso' });
    }

    const pedido = obtenerCasoPedido(req);
    if (pedido !== undefined && Number(pedido) !== casoPermitido) {
      return res.status(403).json({ error: 'No está autorizado para este caso' });
    }

    req.casoAutorizadoId = casoPermitido;
    return next();
  };
}
