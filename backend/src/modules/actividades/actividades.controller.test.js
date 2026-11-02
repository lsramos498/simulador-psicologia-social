import test from 'node:test';
import assert from 'node:assert/strict';
import { crearControladorActividades } from './actividades.controller.js';

function crearRespuesta() {
  return {
    statusCode: null,
    body: null,

    status(codigo) {
      this.statusCode = codigo;
      return this;
    },

    json(datos) {
      this.body = datos;
      return this;
    }
  };
}

function crearServicio({
  resultadoCrear = null,
  resultadoConsulta = null,
  errorCrear = null,
  errorConsulta = null
} = {}) {
  const llamadas = {
    crear: [],
    consultarPorId: []
  };

  const servicio = {
    async crear(datos, docenteId) {
      llamadas.crear.push({ datos, docenteId });

      if (errorCrear) {
        throw errorCrear;
      }

      return resultadoCrear;
    },

    async consultarPorId(id) {
      llamadas.consultarPorId.push(id);

      if (errorConsulta) {
        throw errorConsulta;
      }

      return resultadoConsulta;
    }
  };

  return { servicio, llamadas };
}

test('Rechaza un servicio incompleto', () => {
  assert.throws(
    () => crearControladorActividades(null),
    TypeError
  );

  assert.throws(
    () => crearControladorActividades({
      crear() {}
    }),
    TypeError
  );
});

test('Rechaza la creación sin docente autenticado', async () => {
  const { servicio, llamadas } = crearServicio();
  const controlador = crearControladorActividades(servicio);
  const res = crearRespuesta();

  await controlador.crear({
    body: { casoId: 10 }
  }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(llamadas.crear.length, 0);
});

test('Crea una actividad usando el docente autenticado', async () => {
  const resultado = {
    id: 50,
    casoId: 10,
    docenteId: 7,
    fechaInicio: '2026-11-01 08:00:00',
    estudiantesAutorizados: [
      {
        id: 90,
        estudianteId: 12,
        codigoAutorizacion: 'CODIGO-PRIVADO'
      }
    ]
  };

  const { servicio, llamadas } = crearServicio({
    resultadoCrear: resultado
  });

  const controlador = crearControladorActividades(servicio);
  const res = crearRespuesta();

  const datos = {
    casoId: 10,
    espacioAcademicoId: 2,
    rubricaId: 5,
    estudiantesIds: [12]
  };

  await controlador.crear({
    usuario: { id: 7 },
    body: datos
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.id, 50);

  assert.deepEqual(llamadas.crear[0], {
    datos,
    docenteId: 7
  });
});

test('No expone los códigos de autorización en la respuesta', async () => {
  const { servicio } = crearServicio({
    resultadoCrear: {
      id: 50,
      docenteId: 7,
      estudiantesAutorizados: [
        {
          estudianteId: 12,
          codigoAutorizacion: 'CODIGO-PRIVADO'
        }
      ]
    }
  });

  const controlador = crearControladorActividades(servicio);
  const res = crearRespuesta();

  await controlador.crear({
    usuario: { id: 7 },
    body: {}
  }, res);

  assert.equal(res.statusCode, 201);

  const respuestaJson = JSON.stringify(res.body);

  assert.equal(
    respuestaJson.includes('CODIGO-PRIVADO'),
    false
  );

  assert.equal(
    Object.hasOwn(res.body.data, 'estudiantesAutorizados'),
    false
  );
});

test('Devuelve los errores de validación del servicio', async () => {
  const error = Object.assign(
    new Error('El caso no está publicado.'),
    { statusCode: 400 }
  );

  const { servicio } = crearServicio({
    errorCrear: error
  });

  const controlador = crearControladorActividades(servicio);
  const res = crearRespuesta();

  await controlador.crear({
    usuario: { id: 7 },
    body: {}
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'El caso no está publicado.');
});

test('Oculta los detalles de errores internos', async () => {
  const error = new Error('Detalle interno de la base de datos.');

  const { servicio } = crearServicio({
    errorCrear: error
  });

  const controlador = crearControladorActividades(servicio);
  const res = crearRespuesta();

  await controlador.crear({
    usuario: { id: 7 },
    body: {}
  }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(
    res.body.error,
    'Ocurrió un error interno al procesar la solicitud.'
  );
});

test('Rechaza consultas sin autenticación', async () => {
  const { servicio, llamadas } = crearServicio();
  const controlador = crearControladorActividades(servicio);
  const res = crearRespuesta();

  await controlador.consultarPorId({
    params: { id: '50' }
  }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(llamadas.consultarPorId.length, 0);
});

test('Permite consultar una actividad al docente responsable', async () => {
  const actividad = {
    id: 50,
    docenteId: 7,
    casoTitulo: 'Caso de prueba'
  };

  const { servicio, llamadas } = crearServicio({
    resultadoConsulta: actividad
  });

  const controlador = crearControladorActividades(servicio);
  const res = crearRespuesta();

  await controlador.consultarPorId({
    usuario: { id: 7 },
    params: { id: '50' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, actividad);
  assert.deepEqual(llamadas.consultarPorId, [50]);
});

test('Rechaza la consulta de una actividad de otro docente', async () => {
  const { servicio } = crearServicio({
    resultadoConsulta: {
      id: 50,
      docenteId: 8
    }
  });

  const controlador = crearControladorActividades(servicio);
  const res = crearRespuesta();

  await controlador.consultarPorId({
    usuario: { id: 7 },
    params: { id: '50' }
  }, res);

  assert.equal(res.statusCode, 403);
  assert.equal(
    res.body.error,
    'No tiene autorización para consultar esta actividad.'
  );
});

test('Devuelve el error 404 cuando la actividad no existe', async () => {
  const error = Object.assign(
    new Error('La actividad no existe.'),
    { statusCode: 404 }
  );

  const { servicio } = crearServicio({
    errorConsulta: error
  });

  const controlador = crearControladorActividades(servicio);
  const res = crearRespuesta();

  await controlador.consultarPorId({
    usuario: { id: 7 },
    params: { id: '999' }
  }, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, 'La actividad no existe.');
});
