import { Router } from 'express';
import { crearRepositorioAcceso } from '../modules/acceso/acceso.repository.js';
import { crearServicioAcceso } from '../modules/acceso/acceso.service.js';

/**
 * Rutas del módulo de acceso (Sofía Gallego — acceso y permisos).
 *
 *   POST /api/acceso/estudiantes/ingreso
 *   body: { "correo": "...", "codigo": "..." }
 *   200 → { token, usuario }        400 → faltan datos
 *   401 → correo o código inválidos 403 → no autorizado ahora
 *   404 → convocatoria inexistente  500 → error interno
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
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      // No se envían detalles internos al cliente.
      console.error('Error en ingreso de estudiante:', error.code || error.message);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  return router;
}

// La conexión a MySQL se carga solo cuando llega la primera petición,
// así las pruebas que no usan la base de datos no necesitan un .env.
let servicioPorDefecto;

async function obtenerServicioPorDefecto() {
  if (!servicioPorDefecto) {
    const { pool } = await import('../config/database.js');
    servicioPorDefecto = crearServicioAcceso(crearRepositorioAcceso(pool));
  }
  return servicioPorDefecto;
}

export default crearRutasAcceso(obtenerServicioPorDefecto);