/**
 * Rutas HTTP del módulo Casos (Stefanía Díaz — casos académicos).
 * RF-05 a RF-09: crear, editar, publicar y archivar casos. RF-17: rúbrica.
 * Se monta en `/api/casos`.
 *
 * Esta capa solo traduce HTTP ⇄ servicio: autentica con JWT, comprueba permisos,
 * llama al servicio y convierte los errores de dominio en respuestas JSON.
 * Las reglas de negocio viven en casos.service.js.
 *
 * Seguridad:
 *  - `autenticar`: exige un token válido y deja el usuario en `req.usuario`.
 *  - `requierePermiso('CREAR_CASOS')`: protege las rutas de edición.
 *  - `POST /` usa el patrón Proxy de protección (acceso/servicioProtegido.proxy.js)
 *    en lugar de un middleware, para no duplicar la verificación de CREAR_CASOS.
 *  - Ocultar respuestas: un estudiante que consulta `GET /:id` no recibe
 *    `esCorrecta`, `explicacion` ni `fundamentoTeorico` (ver
 *    `ocultarRespuestasCorrectas`); si no, vería las respuestas antes de resolver.
 */
import { Router } from 'express';
import { autenticar } from '../modules/acceso/autenticar.middleware.js';
import { ROLES, tienePermiso, tieneRol } from '../modules/acceso/autorizacion.js';
import { requierePermiso } from '../modules/acceso/autorizar.middleware.js';
import { crearServicioProtegido } from '../modules/acceso/servicioProtegido.proxy.js';
import { crearRepositorioCasos } from '../modules/casos/casos.repository.js';
import { crearServicioCasos } from '../modules/casos/casos.service.js';

/**
 * Convierte un error en la respuesta JSON estándar `{ error, codigo?, errores? }`.
 * Los errores 5xx nunca exponen el mensaje interno (puede contener datos de la
 * base de datos); solo se registra en consola el código técnico.
 * @param {import('express').Response} res
 * @param {Error & { statusCode?: number, codigo?: string, errores?: string[] }} error
 */
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

/**
 * Devuelve el cuerpo JSON solo si es un objeto; si no (nulo, lista, texto) devuelve {}.
 * Evita que `{ ...req.body }` falle o mezcle datos inesperados.
 */
function datosEntrada(req) {
  return req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body
    : {};
}

/**
 * Indica si el usuario puede ver las respuestas correctas: docentes,
 * administradores o quien tenga el permiso CREAR_CASOS. Un estudiante no.
 * @param {{ roles?: string[], permisos?: string[] }} usuario  El de `req.usuario`.
 * @returns {boolean}
 */
function puedeVerRespuestas(usuario) {
  return tieneRol(usuario, ROLES.DOCENTE, ROLES.ADMINISTRADOR)
    || tienePermiso(usuario, 'CREAR_CASOS');
}

/**
 * Devuelve una copia del caso sin `esCorrecta`, `explicacion` ni
 * `fundamentoTeorico` en cada opción. No modifica el caso original, que el
 * servicio puede estar reutilizando. Si el caso no tiene escenas, lo devuelve igual.
 * @param {object} caso  Caso completo.
 * @returns {object} Caso apto para mostrarse a un estudiante.
 */
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

/** Entrega el caso completo a docentes/admins o la versión sin respuestas al resto. */
function entregarCaso(req, caso) {
  return puedeVerRespuestas(req.usuario) ? caso : ocultarRespuestasCorrectas(caso);
}

// Middlewares comunes de las rutas de edición: sesión válida + permiso CREAR_CASOS.
const docente = [autenticar, requierePermiso('CREAR_CASOS')];

/**
 * Crea el router de casos. Recibe una función que entrega el servicio (en vez
 * del servicio directo) para crearlo de forma perezosa: así importar este
 * archivo no abre la conexión a MySQL y las pruebas pueden inyectar un servicio falso.
 *
 * Endpoints (todos requieren autenticación):
 *  - GET    /                              Lista (filtros `estado`, `creadorId`).
 *  - POST   /                              Crea borrador básico (Proxy, CREAR_CASOS).
 *  - POST   /construir                     Crea caso completo con Builder.
 *  - GET    /:id                           Detalle (oculta respuestas a estudiantes).
 *  - PATCH  /:id                           Edita datos básicos.
 *  - POST   /:id/escenas                   Agrega escena.
 *  - PATCH  /:id/escenas/:escenaId         Edita escena.
 *  - POST   /:id/escenas/:escenaId/decisiones   Agrega pregunta.
 *  - PATCH  /:id/decisiones/:decisionId    Edita pregunta.
 *  - POST   /:id/decisiones/:decisionId/opciones  Agrega opción.
 *  - PATCH  /:id/opciones/:opcionId        Edita opción.
 *  - POST   /:id/personajes                Agrega personaje.
 *  - POST   /:id/escenas/:escenaId/personajes   Asocia personaje a escena.
 *  - PUT    /:id/rubrica                   Guarda rúbrica (RF-17).
 *  - POST   /:id/publicar                  Publica el caso.
 *  - POST   /:id/archivar                  Archiva el caso.
 *
 * @param {() => Promise<object>|object} obtenerServicio  Entrega el servicio de casos.
 * @returns {import('express').Router}
 * @throws {TypeError} Si `obtenerServicio` no es una función.
 */
export function crearRutasCasos(obtenerServicio) {
  if (typeof obtenerServicio !== 'function') {
    throw new TypeError('Se requiere una función que entregue el servicio de casos.');
  }

  const router = Router();

    /**
     * Ejecuta una acción con el servicio y centraliza el manejo de errores:
     * cualquier excepción se convierte en respuesta con `responder`, así cada
     * ruta queda sin try/catch repetido.
     */
  async function ejecutar(res, accion) {
    try {
      const servicio = await obtenerServicio();
      return await accion(servicio);
    } catch (error) {
      return responder(res, error);
    }
  }

  router.get('/', autenticar, (req, res) => ejecutar(res, async (servicio) => {
    const data = await servicio.listar({
      creadorId: req.query.creadorId,
      estado: req.query.estado
    });
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

/**
 * Crea (una sola vez) el servicio real con el pool de MySQL. Se importa el
 * pool de forma dinámica para no conectar a la base de datos al cargar el módulo.
 */
async function obtenerServicioPorDefecto() {
  if (!servicioPorDefecto) {
    const { pool } = await import('../config/database.js');
    servicioPorDefecto = crearServicioCasos(crearRepositorioCasos(pool));
  }
  return servicioPorDefecto;
}

// Router listo para montar en app.js con el servicio real.
export default crearRutasCasos(obtenerServicioPorDefecto);
