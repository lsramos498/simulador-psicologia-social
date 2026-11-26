import 'dotenv/config';
import { pool } from '../src/config/database.js';
import { crearTransporteNotificaciones } from '../src/modules/notificaciones/notificaciones.transporte.js';
import { crearServicioNotificaciones } from '../src/modules/notificaciones/notificaciones.service.js';
import { TIPOS_NOTIFICACION } from '../src/modules/notificaciones/notificaciones.factory.js';

const [estudiantes] = await pool.execute(
  `SELECT u.id, u.correoInstitucional AS correo, u.nombres
   FROM Usuario u
   INNER JOIN UsuarioRol ur ON ur.usuario_id = u.id
   INNER JOIN Rol r ON r.id = ur.rol_id
   WHERE r.nombre = 'Estudiante'
   LIMIT 1`
);

const estudiante = estudiantes[0];
if (!estudiante) {
  console.error('No hay estudiantes en la BD.');
  process.exit(1);
}

const transporte = await crearTransporteNotificaciones(pool);
const servicio = crearServicioNotificaciones(transporte);

const resultado = await servicio.enviar(TIPOS_NOTIFICACION.CONVOCATORIA, {
  actividadId: null,
  estudianteId: estudiante.id,
  destinatario: estudiante.correo,
  caso: {
    titulo: 'Prueba de convocatoria Lumina',
    desarrolloSituacional: 'Caso de prueba para validar el envío.',
    contextoHistoria: 'Ambiente local de desarrollo.'
  },
  mensajePersonalizado: 'Este es un correo de prueba de convocatoria.',
  urlAcceso: process.env.URL_ACCESO || 'http://localhost:5173',
  codigoAutorizacion: 'TEST1234'
});

console.log('Estudiante:', estudiante);
console.log('Resultado:', resultado);
await pool.end();
