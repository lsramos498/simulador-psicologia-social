/**
 * Borra todas las actividades programadas y datos asociados (sesiones, convocatorias, etc.).
 * No toca casos, usuarios ni rúbricas.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  charset: 'utf8mb4',
  multipleStatements: true
});

const sql = `
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM ResultadoCriterio;
DELETE FROM Evaluacion;
DELETE FROM RespuestaEstudiante;
DELETE FROM RegistroInteraccion;
DELETE FROM Notificacion;
DELETE FROM SesionSimulacion;
DELETE FROM Asistencia;
DELETE FROM AutorizacionRepeticion;
DELETE FROM EstudianteAutorizado;
DELETE FROM ActividadProgramada;
SET FOREIGN_KEY_CHECKS = 1;
`;

const conn = await pool.getConnection();
try {
  await conn.query(sql);
  const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM ActividadProgramada');
  console.log('Actividades restantes:', n);
  console.log('Limpieza de actividades completada.');
} finally {
  conn.release();
  await pool.end();
}
