/**
 * Aplica triggers.sql y vistas_y_disparadores_clase.sql con mysql2 (.env).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backend, '.env') });

const onlyCore = process.argv.includes('--core');
const files = [
  path.join(backend, 'database', 'triggers.sql'),
  ...(onlyCore ? [] : [path.join(backend, 'database', 'vistas_y_disparadores_clase.sql')])
];

/** Parte el SQL respetando DELIMITER $$ ... DELIMITER ; */
function splitStatements(sql) {
  const cleaned = sql
    .replace(/^USE\s+\w+\s*;/gim, '')
    .replace(/^\s*--.*$/gm, '');

  const statements = [];
  let delimiter = ';';
  let buffer = '';
  const lines = cleaned.split(/\r?\n/);

  for (const line of lines) {
    const delimMatch = line.match(/^\s*DELIMITER\s+(\S+)\s*$/i);
    if (delimMatch) {
      if (buffer.trim()) {
        statements.push(buffer.trim());
        buffer = '';
      }
      delimiter = delimMatch[1];
      continue;
    }
    buffer += `${line}\n`;
    if (delimiter === ';') {
      if (buffer.includes(';')) {
        const parts = buffer.split(';');
        buffer = parts.pop();
        for (const part of parts) {
          if (part.trim()) statements.push(part.trim());
        }
      }
    } else if (buffer.includes(delimiter)) {
      const parts = buffer.split(delimiter);
      buffer = parts.pop();
      for (const part of parts) {
        if (part.trim()) statements.push(part.trim());
      }
    }
  }
  if (buffer.trim()) statements.push(buffer.trim());
  return statements;
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'proyecto_nuclear',
  multipleStatements: false
});

try {
  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.warn('No existe', file);
      continue;
    }
    const sql = fs.readFileSync(file, 'utf8');
    const stmts = splitStatements(sql);
    let ok = 0;
    for (const stmt of stmts) {
      try {
        await conn.query(stmt);
        ok += 1;
      } catch (err) {
        const isClassFile = file.includes('vistas_y_disparadores_clase');
        console.error('Fallo en', path.basename(file), ':', err.message);
        console.error(stmt.slice(0, 180).replace(/\s+/g, ' '), '…');
        if (isClassFile) {
          console.warn('Aviso: el archivo de clase requiere privilegios extra (VIEW/TRIGGER). Los triggers de Lumina ya están en triggers.sql.');
          break;
        }
        throw err;
      }
    }
    console.log(`OK ${path.basename(file)} (${ok} sentencias)`);
  }

  const [rows] = await conn.query(
    `SELECT COUNT(*) AS total
       FROM information_schema.TRIGGERS
      WHERE TRIGGER_SCHEMA = DATABASE()`
  );
  console.log('Triggers en', process.env.DB_NAME, ':', rows[0].total);
} finally {
  await conn.end();
}
