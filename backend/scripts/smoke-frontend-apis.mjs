import 'dotenv/config';
import request from 'supertest';
import app from '../src/app.js';

const login = await request(app)
  .post('/api/acceso/ingreso')
  .send({
    correo: process.env.ADMIN_CORREO || 'admin@unihumboldt.edu.co',
    contrasena: process.env.ADMIN_CONTRASENA || 'replace_with_strong_password'
  });

console.log('login', login.status, login.body?.usuario);
if (login.status !== 200) process.exit(1);

const token = login.body.token;
const est = await request(app)
  .get('/api/acceso/estudiantes')
  .set('Authorization', `Bearer ${token}`);
console.log('estudiantes', est.status, (est.body?.data || []).map((e) => ({
  id: e.id,
  correo: e.correo
})));

const notif = await request(app)
  .get('/api/notificaciones')
  .set('Authorization', `Bearer ${token}`);
console.log('notificaciones admin', notif.status, Array.isArray(notif.body?.data));

if (est.status !== 200) process.exit(1);
console.log('OK');
process.exit(0);
