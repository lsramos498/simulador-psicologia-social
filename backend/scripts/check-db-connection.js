import 'dotenv/config';
import { pool } from '../src/config/database.js';

try {
  const [databaseRows] = await pool.query(
    'SELECT DATABASE() AS databaseName, VERSION() AS mysqlVersion'
  );

  const [tableRows] = await pool.query(`
    SELECT COUNT(*) AS totalTables
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
  `);

  console.log('Conexión a MySQL exitosa.');
  console.log('Base de datos:', databaseRows[0].databaseName);
  console.log('Versión de MySQL:', databaseRows[0].mysqlVersion);
  console.log('Cantidad de tablas:', tableRows[0].totalTables);

} catch (error) {
  console.error('Error de conexión:', error.code || error.message);
  process.exitCode = 1;

} finally {
  await pool.end();
}
