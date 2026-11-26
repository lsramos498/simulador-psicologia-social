import 'dotenv/config';
import { pool } from '../src/config/database.js';
import { ejecutarSeedInicial } from '../src/modules/acceso/seed.js';

// Uso: npm run db:seed
// Lee los datos del administrador inicial desde backend/.env.

const admin = {
  correo: process.env.ADMIN_CORREO,
  nombres: process.env.ADMIN_NOMBRES,
  apellidos: process.env.ADMIN_APELLIDOS,
  contrasena: process.env.ADMIN_CONTRASENA
};

const conexion = await pool.getConnection();

try {
  const resultado = await ejecutarSeedInicial(conexion, admin);

  console.log('Seed inicial completado.');
  console.log('Roles:', resultado.roles.join(', '));
  console.log('Permisos:', resultado.permisos.join(', '));
  console.log(
    resultado.adminCreado
      ? `Administrador creado con id ${resultado.adminId}.`
      : `El administrador ya existía (id ${resultado.adminId}); no se modificó.`
  );
  console.log('Recomendación: borra ADMIN_CONTRASENA de tu .env ahora que ya se usó.');

} catch (error) {
  console.error('Error en el seed:', error.code || error.message);
  process.exitCode = 1;

} finally {
  conexion.release();
  await pool.end();
}