/**
 * Corrige textos con U+FFFD ya guardados en MySQL (títulos, preguntas, rúbricas).
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { repararTextoUtf8 } from '../src/utils/textoUtf8.js';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  charset: 'utf8mb4'
});

async function repararTabla(conn, tabla, idCol, campos) {
  const cols = ['id', ...campos].join(', ');
  const [filas] = await conn.query(`SELECT ${cols} FROM ${tabla}`);
  let n = 0;
  for (const fila of filas) {
    const sets = [];
    const vals = [];
    for (const campo of campos) {
      const original = fila[campo];
      if (typeof original !== 'string') continue;
      const limpio = repararTextoUtf8(original);
      if (limpio !== original) {
        sets.push(`${campo} = ?`);
        vals.push(limpio);
      }
    }
    if (!sets.length) continue;
    vals.push(fila.id);
    await conn.execute(`UPDATE ${tabla} SET ${sets.join(', ')} WHERE ${idCol} = ?`, vals);
    n += 1;
    console.log(`OK ${tabla}#${fila.id}`);
  }
  return n;
}

const conn = await pool.getConnection();
try {
  const total =
    (await repararTabla(conn, 'Caso', 'id', [
      'titulo',
      'desarrolloSituacional',
      'contextoHistoria'
    ])) +
    (await repararTabla(conn, 'Decision', 'id', ['pregunta', 'ayuda'])) +
    (await repararTabla(conn, 'Escena', 'id', ['nombre', 'contexto'])) +
    (await repararTabla(conn, 'Rubrica', 'id', ['nombre', 'descripcion'])) +
    (await repararTabla(conn, 'OpcionDecision', 'id', ['texto', 'consecuencia'])) +
    (await repararTabla(conn, 'Personaje', 'id', [
      'nombre',
      'rolSocial',
      'perfil',
      'pautasComportamiento'
    ]));

  console.log('filas reparadas', total);

  const [check] = await conn.query(
    `SELECT id, titulo FROM Caso WHERE titulo LIKE CONCAT('%', CHAR(0xEF, 0xBF, 0xBD), '%') OR titulo LIKE '%Título:%' LIMIT 10`
  );
  console.log('casos aún sucios', check);
} finally {
  conn.release();
  await pool.end();
}
