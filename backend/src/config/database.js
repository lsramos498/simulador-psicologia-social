import 'dotenv/config';
import mysql from 'mysql2/promise';

const requiredVariables = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD'
];

const missingVariables = requiredVariables.filter(
  (name) => !process.env[name]?.trim()
);

if (missingVariables.length > 0) {
  throw new Error(
    `Faltan variables en .env: ${missingVariables.join(', ')}`
  );
}

const port = Number(process.env.DB_PORT);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('DB_PORT debe ser un puerto válido.');
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});
