/**
 * Ejecuta la colección Postman completa con Newman.
 * Carga ADMIN_* desde backend/.env sin imprimir secretos.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const backend = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(backend, '.env') });

const collection = path.join(root, 'lumina-proyecto-completo.postman_collection.json');
const newmanCli = path.join(backend, 'node_modules', 'newman', 'bin', 'newman.js');

const adminCorreo = process.env.ADMIN_CORREO || 'admin@unihumboldt.edu.co';
const adminContrasena = process.env.ADMIN_CONTRASENA;
if (!adminContrasena) {
  console.error('Falta ADMIN_CONTRASENA en backend/.env');
  process.exit(1);
}

const args = [
  newmanCli,
  'run',
  collection,
  '--reporters',
  'cli',
  '--timeout-request',
  '30000',
  '--env-var',
  `baseUrl=${process.env.API_URL || 'http://127.0.0.1:3000'}`,
  '--env-var',
  `adminCorreo=${adminCorreo}`,
  '--env-var',
  `adminContrasena=${adminContrasena}`,
  '--env-var',
  'docenteCorreo=docente.casos@unihumboldt.edu.co',
  '--env-var',
  'docenteContrasena=Docente1234',
  '--env-var',
  'estudianteCorreo=estudiante.flujo@unihumboldt.edu.co'
];

console.log('Newman: Lumina - Proyecto completo');
const result = spawnSync(process.execPath, args, {
  cwd: backend,
  stdio: 'inherit',
  env: { ...process.env, ACCESO_CODIGO_EN_PANTALLA: 'true' }
});

process.exit(result.status ?? 1);
