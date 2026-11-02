import test from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioCasos } from '../src/modules/casos/casos.service.js';

function repositorioBase(extra = {}) {
  const repo = {
    async obtenerUsuarioActivo(id) {
      return id === 5 ? { id } : null;
    },
    async enTransaccion(operacion) {
      return operacion(repo);
    },
    ...extra
  };
  return repo;
}

test('crea un caso solo si el docente está activo', async () => {
  let guardado = null;
  const servicio = crearServicioCasos(repositorioBase({
    async insertarCaso(caso) {
      guardado = caso;
      return 10;
    },
    async obtenerCompleto(id) {
      return { id, ...guardado, estado: 'Borrador', escenas: [], personajes: [], rubrica: null };
    }
  }));

  const creado = await servicio.crear({
    creadorId: 5,
    titulo: 'Caso de aula',
    desarrolloSituacional: 'Hay una discusión.',
    contextoHistoria: 'Curso de psicología social.',
    tiempoEstimadoSegundos: 480
  });

  assert.equal(creado.id, 10);
  assert.equal(guardado.estado, undefined);
  assert.equal(guardado.titulo, 'Caso de aula');
});

test('no crea un caso si el docente no existe', async () => {
  const servicio = crearServicioCasos(repositorioBase());

  await assert.rejects(
    () => servicio.crear({
      creadorId: 9,
      titulo: 'Caso',
      desarrolloSituacional: 'Desarrollo',
      contextoHistoria: 'Contexto',
      tiempoEstimadoSegundos: 120
    }),
    (error) => error.codigo === 'CREADOR_NO_EXISTE'
  );
});

test('no publica un borrador incompleto', async () => {
  let actualizo = false;
  const servicio = crearServicioCasos(repositorioBase({
    async obtenerCompleto() {
      return { id: 1, estado: 'Borrador', escenas: [], rubrica: null };
    },
    async actualizarEstado() {
      actualizo = true;
      return 1;
    }
  }));

  await assert.rejects(() => servicio.publicar(1), (error) => {
    assert.equal(error.statusCode, 422);
    assert.ok(error.errores.length >= 2);
    return true;
  });
  assert.equal(actualizo, false);
});

test('no modifica un caso publicado', async () => {
  const servicio = crearServicioCasos(repositorioBase({
    async obtenerPorId() {
      return { id: 3, estado: 'Publicado' };
    }
  }));

  await assert.rejects(
    () => servicio.agregarEscena(3, {
      nombre: 'Nueva',
      contexto: 'Contexto de la escena',
      orden: 1,
      esFinal: false
    }),
    (error) => error.statusCode === 409
  );
});

test('construir persiste el agregado armado con el builder', async () => {
  let agregado = null;
  const servicio = crearServicioCasos(repositorioBase({
    async guardarCasoCompleto(caso) {
      agregado = caso;
      return { id: 15, estado: 'Borrador', ...caso };
    }
  }));

  const creado = await servicio.construir({
    creadorId: 5,
    titulo: 'Presión de grupo',
    desarrolloSituacional: 'El grupo insiste en una decisión.',
    contextoHistoria: 'Redes sociales del curso.',
    tiempoEstimadoSegundos: 600,
    personajes: [],
    escenas: [],
    rubrica: null
  });

  assert.equal(creado.id, 15);
  assert.equal(agregado.titulo, 'Presión de grupo');
  assert.equal(agregado.creadorId, 5);
});
