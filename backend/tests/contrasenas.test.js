import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashearContrasena,
  validarPoliticaContrasena,
  verificarContrasena
} from '../src/modules/acceso/contrasenas.js';

// Contraseñas ficticias solo para pruebas
const CONTRASENA = 'Contrasena-de-prueba-123';

test('el hash tiene el formato esperado y cabe en VARCHAR(255)', async () => {
  const hash = await hashearContrasena(CONTRASENA);
  assert.match(hash, /^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  assert.ok(hash.length <= 255);
});

test('el hash no contiene la contraseña original', async () => {
  const hash = await hashearContrasena(CONTRASENA);
  assert.ok(!hash.includes(CONTRASENA));
});

test('la misma contraseña produce hashes distintos (sal aleatoria)', async () => {
  const hash1 = await hashearContrasena(CONTRASENA);
  const hash2 = await hashearContrasena(CONTRASENA);
  assert.notEqual(hash1, hash2);
});

test('verifica la contraseña correcta', async () => {
  const hash = await hashearContrasena(CONTRASENA);
  assert.equal(await verificarContrasena(CONTRASENA, hash), true);
});

test('rechaza una contraseña incorrecta', async () => {
  const hash = await hashearContrasena(CONTRASENA);
  assert.equal(await verificarContrasena('otra-contrasena', hash), false);
});

test('distingue mayúsculas y minúsculas', async () => {
  const hash = await hashearContrasena(CONTRASENA);
  assert.equal(await verificarContrasena(CONTRASENA.toLowerCase(), hash), false);
});

test('rechaza contraseñas vacías o que no son texto', async () => {
  const hash = await hashearContrasena(CONTRASENA);
  assert.equal(await verificarContrasena('', hash), false);
  assert.equal(await verificarContrasena(null, hash), false);
  await assert.rejects(() => hashearContrasena(''), TypeError);
  await assert.rejects(() => hashearContrasena(undefined), TypeError);
});

test('rechaza contraseñas demasiado largas', async () => {
  const gigante = 'a'.repeat(1025);
  await assert.rejects(() => hashearContrasena(gigante), /demasiado larga/);
  const hash = await hashearContrasena(CONTRASENA);
  assert.equal(await verificarContrasena(gigante, hash), false);
});

test('devuelve false con un hash guardado vacío, nulo o mal formado', async () => {
  assert.equal(await verificarContrasena(CONTRASENA, null), false);
  assert.equal(await verificarContrasena(CONTRASENA, ''), false);
  assert.equal(await verificarContrasena(CONTRASENA, 'texto-plano'), false);
  assert.equal(await verificarContrasena(CONTRASENA, 'bcrypt$1$2$3$abc$def'), false);
  assert.equal(await verificarContrasena(CONTRASENA, 'scrypt$x$8$1$abc$def'), false);
});

test('rechaza un hash con el contenido alterado', async () => {
  const hash = await hashearContrasena(CONTRASENA);
  const partes = hash.split('$');
  partes[5] = Buffer.alloc(64, 1).toString('base64');
  assert.equal(await verificarContrasena(CONTRASENA, partes.join('$')), false);
});
// ---------- Política de contraseñas ----------

test('la política acepta una contraseña con 8 caracteres, letras y números', () => {
  assert.deepEqual(validarPoliticaContrasena('Clave2026'), []);
});

test('la política rechaza contraseñas cortas, sin letras o sin números', () => {
  assert.deepEqual(validarPoliticaContrasena('Ab1'), ['al menos 8 caracteres']);
  assert.deepEqual(validarPoliticaContrasena('12345678'), ['al menos una letra']);
  assert.deepEqual(validarPoliticaContrasena('solotexto'), ['al menos un número']);
  assert.deepEqual(validarPoliticaContrasena(12345678), ['debe ser un texto']);
});
