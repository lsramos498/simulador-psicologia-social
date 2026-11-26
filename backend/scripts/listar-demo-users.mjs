import 'dotenv/config';
import { pool } from '../src/config/database.js';

const [filas] = await pool.execute(
  `SELECT u.id, u.correoInstitucional AS correo, u.nombres, u.apellidos, r.nombre AS rol
   FROM Usuario u
   INNER JOIN UsuarioRol ur ON ur.usuario_id = u.id
   INNER JOIN Rol r ON r.id = ur.rol_id
   ORDER BY r.nombre, u.id
   LIMIT 30`
);
console.table(filas);
await pool.end();
