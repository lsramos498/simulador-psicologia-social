import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const c = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

const [r] = await c.query(
  `SELECT TRIGGER_NAME AS disparador,
          EVENT_OBJECT_TABLE AS tabla,
          ACTION_TIMING AS momento,
          EVENT_MANIPULATION AS evento
     FROM information_schema.TRIGGERS
    WHERE TRIGGER_SCHEMA = DATABASE()
    ORDER BY tabla, momento, disparador`
);
console.table(r);
console.log('Total:', r.length);
await c.end();
