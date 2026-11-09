import { Router } from 'express';
import { autenticar } from '../modules/acceso/autenticar.middleware.js';
import { registrarRespuesta as validarRespuesta } from '../modules/participacion/registrarRespuesta.js';

const ESTADOS_HTTP = {
  ENTRADA_INVALIDA: 400,
  SESION_NO_EXISTE: 404,
  SESION_AJENA: 403,
  ESTADO_NO_PERMITIDO: 409,
  OPCION_INVALIDA: 422,
  RESPUESTA_DUPLICADA: 409,
  RESPUESTA_NO_MODIFICABLE: 409
};

function errorEntrada(mensaje) {
  return Object.assign(new Error(mensaje), { codigo: 'ENTRADA_INVALIDA' });
}

function validarCuerpo(datos) {
  // Solo los errores de esta validación de entrada reciben el código público de HTTP 400.
  try {
    return validarRespuesta(datos);
  } catch (error) {
    if (error instanceof TypeError) throw errorEntrada(error.message);
    throw error;
  }
}

function validarSesionId(valor) {
  const id = Number(valor);
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
    throw errorEntrada('El identificador debe ser un entero positivo válido para INT de MySQL.');
  }
  return id;
}

function responder(res, error) {
  const status = ESTADOS_HTTP[error?.codigo] ?? 500;
  if (status >= 500) {
    console.error('Error interno en participación.');
    return res.status(500).json({ error: 'Ocurrió un error interno al procesar la solicitud.' });
  }

  // Conserva el formato anterior de los errores de entrada, sin añadir campos.
  if (status === 400) return res.status(400).json({ error: error.message });
  return res.status(status).json({ error: error.message, codigo: error.codigo });
}

export function crearRutasParticipacion(obtenerServicio) {
  const router = Router();

  router.post('/respuestas', autenticar, async (req, res) => {
    try {
      const entrada = validarCuerpo(req.body);
      const servicio = await obtenerServicio();
      const data = await servicio.registrar(entrada, req.usuario.id);
      return res.status(201).json({ data });
    } catch (error) {
      return responder(res, error);
    }
  });

  router.get('/sesiones/:sesionId/respuestas', autenticar, async (req, res) => {
    try {
      const sesionId = validarSesionId(req.params.sesionId);
      const servicio = await obtenerServicio();
      const data = await servicio.consultar(sesionId, req.usuario.id);
      return res.status(200).json({ data });
    } catch (error) {
      return responder(res, error);
    }
  });

  router.get('/sesiones/:sesionId/progreso', autenticar, async (req, res) => {
    try {
      const sesionId = validarSesionId(req.params.sesionId);
      const servicio = await obtenerServicio();
      const data = await servicio.consultarProgreso(sesionId, req.usuario.id);
      return res.status(200).json({ data });
    } catch (error) {
      return responder(res, error);
    }
  });

  return router;
}

let servicioPorDefecto;

async function obtenerServicioPorDefecto() {
  if (!servicioPorDefecto) {
    const { pool } = await import('../config/database.js');
    const { crearRepositorioParticipacion } = await import('../modules/participacion/participacion.repository.js');
    const { crearServicioParticipacion } = await import('../modules/participacion/participacion.service.js');
    servicioPorDefecto = crearServicioParticipacion(crearRepositorioParticipacion(pool));
  }

  return servicioPorDefecto;
}

export default crearRutasParticipacion(obtenerServicioPorDefecto);
