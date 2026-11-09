import test from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioCasos } from '../src/modules/casos/casos.service.js';

const docente = { id: 5, roles: ['Docente'], permisos: ['CREAR_CASOS'] };

function repositorio(extra = {}) {
  const repo = {
    async obtenerUsuarioActivo(id) {
      return id === 5 ? { id } : null;
    },
    async enTransaccion(operacion) {
      return operacion(repo);
    },
    async obtenerPorId() {
      return { id: 1, creadorId: 5, estado: 'Borrador' };
    },
    async obtenerCompleto(id) {
      return { id, estado: 'Borrador', creadorId: 5 };
    },
    ...extra
  };
  return repo;
}

test('actualizarEscena guarda el nombre recortado en un borrador propio', async () => {
  let guardada = null;
  const servicio = crearServicioCasos(repositorio({
    async obtenerEscena() {
      return { id: 2, casoId: 1 };
    },
    async actualizarEscena(_id, escena) {
      guardada = escena;
      return 1;
    },
    async obtenerCompleto(id) {
      return { id, escenas: [{ id: 2, ...guardada }] };
    }
  }));

  const caso = await servicio.actualizarEscena(1, 2, {
    nombre: '  Pasillo  ',
    contexto: 'Antes de entrar al aula.',
    orden: 1,
    esFinal: false
  }, docente);

  assert.equal(guardada.nombre, 'Pasillo');
  assert.equal(caso.escenas[0].nombre, 'Pasillo');
});

test('actualizarEscena rechaza una escena de otro caso', async () => {
  const servicio = crearServicioCasos(repositorio({
    async obtenerEscena() {
      return { id: 2, casoId: 99 };
    },
    async actualizarEscena() {
      throw new Error('no debería actualizar');
    }
  }));

  await assert.rejects(
    () => servicio.actualizarEscena(1, 2, {
      nombre: 'Aula',
      contexto: 'Inicio',
      orden: 1,
      esFinal: false
    }, docente),
    (error) => error.codigo === 'ESCENA_NO_EXISTE'
  );
});

test('actualizarDecision exige que la pregunta pertenezca al caso', async () => {
  const servicio = crearServicioCasos(repositorio({
    async obtenerDecision() {
      return { id: 8, casoId: 3 };
    }
  }));

  await assert.rejects(
    () => servicio.actualizarDecision(1, 8, {
      pregunta: '¿Qué hace?',
      orden: 1
    }, docente),
    (error) => error.codigo === 'DECISION_NO_EXISTE'
  );
});

test('actualizarOpcion actualiza texto y explicación', async () => {
  let guardada = null;
  const servicio = crearServicioCasos(repositorio({
    async obtenerOpcion() {
      return { id: 4, decisionId: 8, casoId: 1 };
    },
    async actualizarOpcion(_id, opcion) {
      guardada = opcion;
      return 1;
    },
    async obtenerCompleto(id) {
      return { id, opciones: [guardada] };
    }
  }));

  await servicio.actualizarOpcion(1, 4, {
    texto: '  Escucha  ',
    esCorrecta: true,
    orden: 1,
    explicacion: 'Contiene el conflicto.'
  }, docente);

  assert.equal(guardada.texto, 'Escucha');
  assert.equal(guardada.explicacion, 'Contiene el conflicto.');
});
