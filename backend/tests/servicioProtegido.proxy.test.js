import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { ROLES } from '../src/modules/acceso/autorizacion.js';
import { crearServicioProtegido } from '../src/modules/acceso/servicioProtegido.proxy.js';

// Usuarios ficticios solo para pruebas
const docenteCreador = { id: 2, roles: [ROLES.DOCENTE], permisos: ['CREAR_CASOS'] };
const docenteSinPermiso = { id: 3, roles: [ROLES.DOCENTE], permisos: [] };

// Servicio real de ejemplo: registra cuántas veces fue llamado.
function crearServicioFalso() {
  const llamadas = [];
  return {
    llamadas,
    crearCaso(datos) {
      llamadas.push(datos);
      return { id: 1, ...datos };
    },
    eliminarTodo() {
      llamadas.push('eliminarTodo');
    }
  };
}

const permisos = { crearCaso: 'CREAR_CASOS' };

function esperarError(fn, statusCode) {
  assert.throws(fn, (error) => {
    assert.equal(error.statusCode, statusCode);
    return true;
  });
}

// ---------- Pruebas unitarias del proxy ----------

test('delega en el servicio real cuando el usuario tiene el permiso', () => {
  const real = crearServicioFalso();
  const proxy = crearServicioProtegido(real, docenteCreador, permisos);

  const resultado = proxy.crearCaso({ titulo: 'Caso de prueba' });

  assert.deepEqual(resultado, { id: 1, titulo: 'Caso de prueba' });
  assert.deepEqual(real.llamadas, [{ titulo: 'Caso de prueba' }]);
});

test('rechaza con 403 y NO llama al servicio real si falta el permiso', () => {
  const real = crearServicioFalso();
  const proxy = crearServicioProtegido(real, docenteSinPermiso, permisos);

  esperarError(() => proxy.crearCaso({ titulo: 'X' }), 403);
  assert.equal(real.llamadas.length, 0);
});

test('rechaza con 401 y NO llama al servicio real si no hay usuario', () => {
  const real = crearServicioFalso();
  const proxy = crearServicioProtegido(real, null, permisos);

  esperarError(() => proxy.crearCaso({ titulo: 'X' }), 401);
  assert.equal(real.llamadas.length, 0);
});

test('solo expone las operaciones configuradas', () => {
  const proxy = crearServicioProtegido(crearServicioFalso(), docenteCreador, permisos);
  assert.equal(proxy.eliminarTodo, undefined);
});

test('no permite agregar operaciones al proxy después de crearlo', () => {
  const proxy = crearServicioProtegido(crearServicioFalso(), docenteCreador, permisos);
  assert.throws(() => {
    proxy.crearCaso = () => 'saltarse la seguridad';
  }, TypeError);
});

test('detecta una configuración con una operación que no existe', () => {
  assert.throws(
    () => crearServicioProtegido(crearServicioFalso(), docenteCreador, { publicarCaso: 'CREAR_CASOS' }),
    /no tiene la operación/
  );
});

test('detecta una operación configurada sin permiso', () => {
  assert.throws(
    () => crearServicioProtegido(crearServicioFalso(), docenteCreador, { crearCaso: '' }),
    /requiere el nombre de un permiso/
  );
});

test('funciona con servicios asíncronos (por ejemplo, consultas a MySQL)', async () => {
  const real = { crearCaso: async (datos) => ({ id: 7, ...datos }) };
  const proxy = crearServicioProtegido(real, docenteCreador, permisos);

  const resultado = await proxy.crearCaso({ titulo: 'Async' });
  assert.deepEqual(resultado, { id: 7, titulo: 'Async' });
});

test('conserva el contexto (this) de servicios escritos como clase', () => {
  class ServicioCasos {
    constructor() {
      this.siguienteId = 42;
    }
    crearCaso(datos) {
      return { id: this.siguienteId, ...datos };
    }
  }
  const proxy = crearServicioProtegido(new ServicioCasos(), docenteCreador, permisos);
  assert.equal(proxy.crearCaso({ titulo: 'Clase' }).id, 42);
});

// ---------- Integración: cómo se usaría en una ruta ----------

function crearAppDePrueba(usuario) {
  const real = crearServicioFalso();
  const app = express();
  app.use(express.json());
  app.post('/casos', (req, res) => {
    try {
      const casos = crearServicioProtegido(real, usuario, permisos);
      res.status(201).json({ data: casos.crearCaso(req.body) });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });
  return { app, real };
}

test('ruta con proxy: docente con permiso crea el caso (201)', async () => {
  const { app, real } = crearAppDePrueba(docenteCreador);
  const res = await request(app).post('/casos').send({ titulo: 'Nuevo' }).expect(201);
  assert.equal(res.body.data.titulo, 'Nuevo');
  assert.equal(real.llamadas.length, 1);
});

test('ruta con proxy: docente sin permiso recibe 403 y no se crea nada', async () => {
  const { app, real } = crearAppDePrueba(docenteSinPermiso);
  const res = await request(app).post('/casos').send({ titulo: 'Nuevo' }).expect(403);
  assert.match(res.body.error, /permiso/);
  assert.equal(real.llamadas.length, 0);
});
