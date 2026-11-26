import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(js|jsx|ts|tsx|css|html|json)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const files = [
  ...walk(path.join(root, 'frontend/src')),
  ...walk(path.join(root, 'backend/src'))
];

let fffd = 0;
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  const n = (t.match(/\uFFFD/g) || []).length;
  if (n) {
    fffd += n;
    console.log('SOURCE FFFD', n, path.relative(root, f));
  }
}
console.log('source fffd total', fffd);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  charset: 'utf8mb4'
});

const conn = await pool.getConnection();
const [charsetRows] = await conn.query(`
  SHOW VARIABLES WHERE Variable_name IN
  ('character_set_client','character_set_connection','character_set_results','character_set_database','collation_connection')
`);
console.log('mysql charset', charsetRows);

const [casos] = await conn.query(`
  SELECT id, titulo, LEFT(desarrolloSituacional,80) AS des, LEFT(contextoHistoria,80) AS ctx
  FROM Caso ORDER BY id DESC LIMIT 15
`);
for (const c of casos) {
  const blob = `${c.titulo || ''} ${c.des || ''} ${c.ctx || ''}`;
  const bad = /\uFFFD|T[^\w]?tulo|C[^\w]?mo /.test(blob) || /Ã.|Â./.test(blob);
  console.log(
    'caso',
    c.id,
    JSON.stringify(c.titulo),
    'hex',
    Buffer.from(String(c.titulo || ''), 'utf8').toString('hex').slice(0, 80),
    bad ? '<<BAD?' : ''
  );
}

const [decs] = await conn.query(`
  SELECT d.id, d.pregunta
  FROM Decision d
  ORDER BY d.id DESC LIMIT 20
`);
for (const d of decs) {
  console.log(
    'dec',
    d.id,
    JSON.stringify(d.pregunta),
    'hex',
    Buffer.from(String(d.pregunta || ''), 'utf8').toString('hex').slice(0, 100)
  );
}

const [rubs] = await conn.query(`
  SELECT id, caso_id, nombre FROM Rubrica ORDER BY id DESC LIMIT 10
`);
for (const r of rubs) {
  console.log('rub', r.id, r.caso_id, JSON.stringify(r.nombre));
}

conn.release();
await pool.end();
