import { Router } from 'express';
import { crearRepositorioAcceso } from '../modules/acceso/acceso.repository.js';
import { crearServicioAcceso } from '../modules/acceso/acceso.service.js';
import { crearRepositorioAdministracion } from '../modules/acceso/administracion.repository.js';
import { crearServicioAdministracion } from '../modules/acceso/administracion.service.js';
import { crearRutasAdministracion } from './administracion.routes.js';
import { responderErrorHttp } from '../modules/acceso/errores.js';

/**
 * Rutas del módulo de acceso (Sofía Gallego — acceso y permisos).
 *
 *   POST /api/acceso/estudiantes/ingreso
 *   body: { "correo": "...", "codigo": "..." }
 *   200 → { token, usuario }        400 → faltan datos
 *   401 → correo o código inválidos 403 → no autorizado ahora
 *   404 → convocatoria inexistente  500 → error interno
 *
 *   POST /api/acceso/ingreso   (docentes y administradores)
 *   body: { "correo": "...", "contrasena": "..." }
 *   200 → { token, usuario }        400 → faltan datos
 *   401 → correo o contraseña inválidos
 *   403 → cuenta inactiva o el usuario no es docente ni administrador
 */

function esTextoConContenido(valor) {
  return typeof valor === 'string' && valor.trim() !== '';
}

export function crearRutasAcceso(obtenerServicio) {
  const router = Router();

  router.post('/estudiantes/ingreso', async (req, res) => {
    const { correo, codigo } = req.body ?? {};

    // Validación de entrada antes de tocar la base de datos.
    if (!esTextoConContenido(correo) || !esTextoConContenido(codigo)) {
      return res.status(400).json({
        error: 'El correo institucional y el código de autorización son obligatorios'
      });
    }

    try {
      const servicio = await obtenerServicio();
      const resultado = await servicio.ingresarEstudiante({ correo, codigo });
      return res.status(200).json(resultado);
    } catch (error) {
      return responderErrorHttp(res, error, 'ingreso de estudiante');
    }
  });

  router.post('/ingreso', async (req, res) => {
    const { correo, contrasena } = req.body ?? {};

    // La contraseña no se recorta: los espacios pueden ser parte de ella.
    if (!esTextoConContenido(correo) || typeof contrasena !== 'string' || contrasena === '') {
      return res.status(400).json({
        error: 'El correo institucional y la contraseña son obligatorios'
      });
    }

    try {
      const servicio = await obtenerServicio();
      const resultado = await servicio.ingresarConContrasena({ correo, contrasena });
      return res.status(200).json(resultado);
    } catch (error) {
      return responderErrorHttp(res, error, 'ingreso con contraseña');
    }
  });

  return router;
}

// La conexión a MySQL se carga solo cuando llega la primera petición,
// así las pruebas que no usan la base de datos no necesitan un .env.
let servicioPorDefecto;
let servicioAdministracion;

async function obtenerServicioPorDefecto() {
  if (!servicioPorDefecto) {
    const { pool } = await import('../config/database.js');
    servicioPorDefecto = crearServicioAcceso(crearRepositorioAcceso(pool));
  }
  return servicioPorDefecto;
}

async function obtenerServicioAdministracion() {
  if (!servicioAdministracion) {
    const { pool } = await import('../config/database.js');
    servicioAdministracion = crearServicioAdministracion(crearRepositorioAdministracion(pool));
  }
  return servicioAdministracion;
}

const rutasAcceso = crearRutasAcceso(obtenerServicioPorDefecto);
// RF-03: rutas del administrador bajo /api/acceso/admin (no requiere tocar app.js).
rutasAcceso.use('/admin', crearRutasAdministracion(obtenerServicioAdministracion));

export default rutasAcceso;