import { Router } from 'express';
import { crearRepositorioCasos } from '../modules/casos/casos.repository.js';
import { crearServicioCasos } from '../modules/casos/casos.service.js';

function responder(res, error) {
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  const cuerpo = {
    error: status >= 500
      ? 'Ocurrió un error interno al procesar la solicitud.'
      : error.message
  };

  if (error?.codigo && status < 500) {
    cuerpo.codigo = error.codigo;
  }
  if (Array.isArray(error?.errores)) {
    cuerpo.errores = error.errores;
  }
  if (status >= 500) {
    console.error('Error en casos:', error?.code || error?.message);
  }

  return res.status(status).json(cuerpo);
}

export function crearRutasCasos(obtenerServicio) {
  if (typeof obtenerServicio !== 'function') {
    throw new TypeError('Se requiere una función que entregue el servicio de casos.');
  }

  const router = Router();

  async function ejecutar(res, accion) {
    try {
      const servicio = await obtenerServicio();
      return await accion(servicio);
    } catch (error) {
      return responder(res, error);
    }
  }

  router.get('/', (req, res) => ejecutar(res, async (servicio) => {
    const data = await servicio.listar(req.query.creadorId);
    return res.status(200).json({ total: data.length, data });
  }));

  router.post('/construir', (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.construir(req.body);
    return res.status(201).json({ data: caso });
  }));

  router.post('/', (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.crear(req.body);
    return res.status(201).json({ data: caso });
  }));

  router.get('/:id', (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.obtener(req.params.id);
    return res.status(200).json({ data: caso });
  }));

  router.patch('/:id', (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.actualizar(req.params.id, req.body);
    return res.status(200).json({ data: caso });
  }));

  router.post('/:id/escenas', (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.agregarEscena(req.params.id, req.body);
    return res.status(201).json({ data: caso });
  }));

  router.post('/:id/escenas/:escenaId/decisiones', (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.agregarDecision(req.params.id, req.params.escenaId, req.body);
    return res.status(201).json({ data: caso });
  }));

  router.post('/:id/decisiones/:decisionId/opciones', (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.agregarOpcion(req.params.id, req.params.decisionId, req.body);
    return res.status(201).json({ data: caso });
  }));

  router.post('/:id/personajes', (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.agregarPersonaje(req.params.id, req.body);
    return res.status(201).json({ data: caso });
  }));

  router.post('/:id/escenas/:escenaId/personajes', (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.asociarPersonaje(
      req.params.id,
      req.params.escenaId,
      req.body?.personajeId
    );
    return res.status(201).json({ data: caso });
  }));

  router.put('/:id/rubrica', (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.guardarRubrica(req.params.id, req.body);
    return res.status(200).json({ data: caso });
  }));

  router.post('/:id/publicar', (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.publicar(req.params.id);
    return res.status(200).json({ data: caso });
  }));

  router.post('/:id/archivar', (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.archivar(req.params.id);
    return res.status(200).json({ data: caso });
  }));

  return router;
}

let servicioPorDefecto;

async function obtenerServicioPorDefecto() {
  if (!servicioPorDefecto) {
    const { pool } = await import('../config/database.js');
    servicioPorDefecto = crearServicioCasos(crearRepositorioCasos(pool));
  }
  return servicioPorDefecto;
}

export default crearRutasCasos(obtenerServicioPorDefecto);
