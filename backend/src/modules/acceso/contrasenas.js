import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Contraseñas de docentes y administradores (Sofía Gallego — acceso y permisos).
 * Decisión del equipo: ingresan con correo institucional + contraseña,
 * y en Usuario.contrasenaHash se guarda solo el hash, nunca la contraseña.
 *
 * Se usa scrypt (incluido en Node, sin dependencias nuevas): es un algoritmo
 * lento a propósito, para que adivinar contraseñas por fuerza bruta sea costoso.
 * Cada contraseña lleva una "sal" aleatoria: la misma contraseña produce
 * hashes distintos en usuarios distintos.
 *
 * Formato guardado (cabe en VARCHAR(255)):
 *   scrypt$N$r$p$salBase64$hashBase64
 *
 * La política de contraseñas (longitud mínima, etc.) queda pendiente del equipo.
 */

const scryptAsync = promisify(scrypt);

const PREFIJO = 'scrypt';
const PARAMETROS = Object.freeze({ N: 16384, r: 8, p: 1 });
const LONGITUD_SAL = 16;
const LONGITUD_HASH = 64;
const LONGITUD_MAXIMA = 1024; // evita que una contraseña gigante sature el servidor

function validarContrasena(contrasena) {
  if (typeof contrasena !== 'string' || contrasena.length === 0) {
    throw new TypeError('Se requiere la contraseña');
  }

  if (contrasena.length > LONGITUD_MAXIMA) {
    throw new TypeError('La contraseña es demasiado larga');
  }
}

/**
 * Calcula el hash que se guarda en Usuario.contrasenaHash.
 * Es asíncrona porque scrypt tarda (a propósito) unos milisegundos.
 */
export async function hashearContrasena(contrasena) {
  validarContrasena(contrasena);

  const { N, r, p } = PARAMETROS;
  const sal = randomBytes(LONGITUD_SAL);
  const hash = await scryptAsync(contrasena, sal, LONGITUD_HASH, { N, r, p });

  return [PREFIJO, N, r, p, sal.toString('base64'), hash.toString('base64')].join('$');
}

/**
 * Comprueba una contraseña escrita contra el hash guardado.
 * Devuelve true o false; nunca revela por qué falló.
 */
export async function verificarContrasena(contrasena, hashGuardado) {
  if (typeof contrasena !== 'string' || contrasena.length === 0 || contrasena.length > LONGITUD_MAXIMA) {
    return false;
  }

  if (typeof hashGuardado !== 'string') {
    return false;
  }

  const partes = hashGuardado.split('$');
  if (partes.length !== 6 || partes[0] !== PREFIJO) {
    return false;
  }

  const [, textoN, textoR, textoP, salBase64, hashBase64] = partes;
  const N = Number(textoN);
  const r = Number(textoR);
  const p = Number(textoP);

  if (![N, r, p].every(Number.isInteger)) {
    return false;
  }

  const sal = Buffer.from(salBase64, 'base64');
  const esperado = Buffer.from(hashBase64, 'base64');

  if (sal.length === 0 || esperado.length === 0) {
    return false;
  }

  try {
    // Se usan los parámetros guardados: si algún día se aumentan,
    // los hashes antiguos se siguen pudiendo verificar.
    const calculado = await scryptAsync(contrasena, sal, esperado.length, { N, r, p });
    return timingSafeEqual(calculado, esperado);
  } catch {
    return false;
  }
}