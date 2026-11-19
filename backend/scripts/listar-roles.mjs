import 'dotenv/config';
import { pool } from '../src/config/database.js';
const [r] = await pool.execute(
  `SELECT u.id, u.correoInstitucional AS correo, r.nombre AS rol
   FROM Usuario u
   JOIN UsuarioRol ur ON ur.usuario_id = u.id
   JOIN Rol r ON r.id = ur.rol_id
   ORDER BY u.id, r.nombre`
);
console.table(r);
await pool.end();
