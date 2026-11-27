import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, tieneRol } from './autorizacion.js';
import { requiereRol } from './autorizar.middleware.js';

test('tieneRol reconoce roles sin distinguir mayúsculas ni espacios', () => {
  assert.equal(tieneRol({ roles: [' ADMINISTRADOR '] }, ROLES.ADMINISTRADOR), true);
  assert.equal(tieneRol({ roles: ['docente'] }, ROLES.DOCENTE), true);
  assert.equal(tieneRol({ roles: ['Estudiante'] }, ROLES.ESTUDIANTE), true);
});

test('tieneRol no concede roles que el usuario no tiene', () => {
  assert.equal(tieneRol({ roles: ['Estudiante'] }, ROLES.ADMINISTRADOR), false);
  assert.equal(tieneRol({ roles: [] }, ROLES.ADMINISTRADOR), false);
});

test('el middleware de rol admite ADMINISTRADOR y conserva el rechazo a Estudiante', () => {
  const middleware = requiereRol(ROLES.ADMINISTRADOR);
  let siguiente = false;
  const req = { usuario: { id: 9, roles: ['ADMINISTRADOR'] } };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };

  middleware(req, res, () => { siguiente = true; });
  assert.equal(siguiente, true);

  siguiente = false;
  middleware({ usuario: { id: 7, roles: ['Estudiante'] } }, res, () => { siguiente = true; });
  assert.equal(siguiente, false);
  assert.equal(res.statusCode, 403);
});
