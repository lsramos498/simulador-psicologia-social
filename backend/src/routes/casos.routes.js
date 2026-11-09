import { Router } from 'express';
import { autenticar } from '../modules/acceso/autenticar.middleware.js';
import { ROLES, tienePermiso, tieneRol } from '../modules/acceso/autorizacion.js';
import { requierePermiso } from '../modules/acceso/autorizar.middleware.js';
import { crearServicioProtegido } from '../modules/acceso/servicioProtegido.proxy.js';
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

function datosEntrada(req) {
  return req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body
    : {};
}

function puedeVerRespuestas(usuario) {
  return tieneRol(usuario, ROLES.DOCENTE, ROLES.ADMINISTRADOR)
    || tienePermiso(usuario, 'CREAR_CASOS');
}

function ocultarRespuestasCorrectas(caso) {
  if (!caso || typeof caso !== 'object' || !Array.isArray(caso.escenas)) {
    return caso;
  }

  return {
    ...caso,
    escenas: caso.escenas.map((escena) => ({
      ...escena,
      decisiones: Array.isArray(escena.decisiones)
        ? escena.decisiones.map((decision) => ({
          ...decision,
          opciones: Array.isArray(decision.opciones)
            ? decision.opciones.map(({ esCorrecta, explicacion, fundamentoTeorico, ...opcion }) => opcion)
            : decision.opciones
        }))
        : escena.decisiones
    }))
  };
}

function entregarCaso(req, caso) {
  return puedeVerRespuestas(req.usuario) ? caso : ocultarRespuestasCorrectas(caso);
}

const docente = [autenticar, requierePermiso('CREAR_CASOS')];

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

  router.get('/', autenticar, (req, res) => ejecutar(res, async (servicio) => {
    const data = await servicio.listar(req.query.creadorId);
    return res.status(200).json({ total: data.length, data });
  }));

  router.post('/construir', ...docente, (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.construir({ ...datosEntrada(req), creadorId: req.usuario.id });
    return res.status(201).json({ data: caso });
  }));

  // Crear un caso se protege con el patrón Proxy (no con requierePermiso),
  // para no duplicar la verificación del permiso CREAR_CASOS.
  router.post('/', autenticar, (req, res) => ejecutar(res, async (servicio) => {
    const casos = crearServicioProtegido(servicio, req.usuario, { crear: 'CREAR_CASOS' });
    const caso = await casos.crear({ ...datosEntrada(req), creadorId: req.usuario.id });
    return res.status(201).json({ data: caso });
  }));

  router.get('/:id', autenticar, (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.obtener(req.params.id);
    return res.status(200).json({ data: entregarCaso(req, caso) });
  }));

  router.patch('/:id', ...docente, (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.actualizar(req.params.id, req.body, req.usuario);
    return res.status(200).json({ data: caso });
  }));

  router.post('/:id/escenas', ...docente, (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.agregarEscena(req.params.id, req.body, req.usuario);
    return res.status(201).json({ data: caso });
  }));

  router.patch('/:id/escenas/:escenaId', ...docente, (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.actualizarEscena(
      req.params.id,
      req.params.escenaId,
      req.body,
      req.usuario
    );
    return res.status(200).json({ data: caso });
  }));

  router.post('/:id/escenas/:escenaId/decisiones', ...docente, (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.agregarDecision(
      req.params.id,
      req.params.escenaId,
      req.body,
      req.usuario
    );
    return res.status(201).json({ data: caso });
  }));

  router.patch('/:id/decisiones/:decisionId', ...docente, (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.actualizarDecision(
      req.params.id,
      req.params.decisionId,
      req.body,
      req.usuario
    );
    return res.status(200).json({ data: caso });
  }));

  router.post('/:id/decisiones/:decisionId/opciones', ...docente, (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.agregarOpcion(
      req.params.id,
      req.params.decisionId,
      req.body,
      req.usuario
    );
    return res.status(201).json({ data: caso });
  }));

  router.patch('/:id/opciones/:opcionId', ...docente, (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.actualizarOpcion(
      req.params.id,
      req.params.opcionId,
      req.body,
      req.usuario
    );
    return res.status(200).json({ data: caso });
  }));

  router.post('/:id/personajes', ...docente, (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.agregarPersonaje(req.params.id, req.body, req.usuario);
    return res.status(201).json({ data: caso });
  }));

  router.post('/:id/escenas/:escenaId/personajes', ...docente, (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.asociarPersonaje(
      req.params.id,
      req.params.escenaId,
      req.body?.personajeId,
      req.usuario
    );
    return res.status(201).json({ data: caso });
  }));

  router.put('/:id/rubrica', ...docente, (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.guardarRubrica(req.params.id, req.body, req.usuario);
    return res.status(200).json({ data: caso });
  }));

  router.post('/:id/publicar', ...docente, (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.publicar(req.params.id, req.usuario);
    return res.status(200).json({ data: caso });
  }));

  router.post('/:id/archivar', ...docente, (req, res) => ejecutar(res, async (servicio) => {
    const caso = await servicio.archivar(req.params.id, req.usuario);
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
