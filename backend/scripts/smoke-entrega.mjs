/**
 * Smoke E2E de entrega: login → caso → actividad → notificar → sesión estudiante.
 */
import 'dotenv/config';
import request from 'supertest';
import app from '../src/app.js';

function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

const adminCorreo = process.env.ADMIN_CORREO || 'admin@unihumboldt.edu.co';
const adminPass = process.env.ADMIN_CONTRASENA || 'replace_with_strong_password';

console.log('1) Login docente/admin…');
const login = await request(app).post('/api/acceso/ingreso').send({
  correo: adminCorreo,
  contrasena: adminPass
});
ok(login.status === 200, `login falló: ${login.status} ${JSON.stringify(login.body)}`);
ok(login.body.token, 'sin token');
const token = login.body.token;
console.log('   OK', login.body.usuario?.nombres, login.body.usuario?.roles);

console.log('2) Listar estudiantes (docente)…');
const est = await request(app)
  .get('/api/acceso/estudiantes')
  .set('Authorization', `Bearer ${token}`);
ok(est.status === 200, `estudiantes: ${est.status}`);
const estudiante = (est.body.data || [])[0];
ok(estudiante?.id, 'no hay estudiantes en BD');
console.log('   OK estudiante', estudiante.id, estudiante.correo);

console.log('3) Listar casos publicados…');
const casos = await request(app)
  .get('/api/casos?estado=Publicado')
  .set('Authorization', `Bearer ${token}`);
ok(casos.status === 200, `casos: ${casos.status}`);
let caso = (casos.body.data || []).find((c) => c.rubricaId);
if (!caso) {
  console.log('   No hay publicado con rúbrica; construyo uno…');
  const creado = await request(app)
    .post('/api/casos/construir')
    .set('Authorization', `Bearer ${token}`)
    .send({
      titulo: `Smoke entrega ${Date.now()}`,
      desarrolloSituacional: 'Conflicto breve para prueba de entrega.',
      contextoHistoria: 'Barrio El Roble, mediación comunitaria.',
      tiempoEstimadoSegundos: 600,
      personajes: [
        { nombre: 'Ana', rolSocial: 'Vecina', edad: 34, descripcion: 'Habitante' },
        { nombre: 'Luis', rolSocial: 'Vecino', edad: 40, descripcion: 'Habitante' }
      ],
      escenas: [
        {
          nombre: 'Calle del barrio',
          orden: 1,
          contexto: 'Ruido y tensión',
          esFinal: true,
          personajes: ['Ana', 'Luis'],
          decisiones: [
            {
              pregunta: '¿Qué hacés primero?',
              orden: 1,
              opciones: [
                {
                  texto: 'Escuchar a ambas partes',
                  esCorrecta: true,
                  explicacion: 'Contrasta versiones',
                  orden: 1
                },
                {
                  texto: 'Ignorar el conflicto',
                  esCorrecta: false,
                  explicacion: 'No interviene',
                  orden: 2
                }
              ]
            }
          ]
        }
      ],
      rubrica: {
        nombre: 'Rúbrica smoke',
        descripcion: 'Prueba',
        criterios: [
          {
            nombre: 'Escucha',
            ponderacion: 100,
            puntajeMaximo: 4,
            niveles: [
              { nombre: 'Básico', descripcion: 'Poco', puntaje: 1, orden: 1 },
              { nombre: 'Alto', descripcion: 'Bien', puntaje: 4, orden: 2 }
            ]
          }
        ]
      }
    });
  ok(creado.status === 201 || creado.status === 200, `construir: ${creado.status} ${JSON.stringify(creado.body)}`);
  caso = creado.body.data;
  const pub = await request(app)
    .post(`/api/casos/${caso.id}/publicar`)
    .set('Authorization', `Bearer ${token}`);
  ok(pub.status === 200, `publicar: ${pub.status} ${JSON.stringify(pub.body)}`);
  caso = pub.body.data || { ...caso, estado: 'Publicado', rubricaId: caso.rubrica?.id || caso.rubricaId };
}
ok(caso.rubricaId || caso.rubrica?.id, 'caso sin rubricaId');
const rubricaId = caso.rubricaId || caso.rubrica?.id;
const casoId = caso.id;
console.log('   OK caso', casoId, 'rubrica', rubricaId);

console.log('4) Espacio académico…');
let espacios = await request(app)
  .get('/api/espacios')
  .set('Authorization', `Bearer ${token}`);
ok(espacios.status === 200, `espacios: ${espacios.status}`);
let espacio = (espacios.body.data || [])[0];
if (!espacio) {
  const creEsp = await request(app)
    .post('/api/espacios')
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre: 'Smoke práctica', codigo: `SMK-${Date.now().toString().slice(-5)}` });
  ok(creEsp.status === 201, `crear espacio: ${creEsp.status}`);
  espacio = creEsp.body.data;
}
console.log('   OK espacio', espacio.id);

const inicio = new Date(Date.now() - 60_000);
const fin = new Date(Date.now() + 2 * 60 * 60_000);
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

console.log('5) Crear actividad + notificar…');
const act = await request(app)
  .post('/api/actividades')
  .set('Authorization', `Bearer ${token}`)
  .send({
    casoId,
    espacioAcademicoId: espacio.id,
    rubricaId,
    fechaInicio: fmt(inicio),
    fechaFin: fmt(fin),
    tiempoLimiteSegundos: 900,
    intentosPermitidos: 2,
    lugar: 'Aula smoke',
    mensajePersonalizado: 'Convocatoria de prueba de entrega Lumina.',
    estudiantesIds: [estudiante.id]
  });
ok(act.status === 201, `actividad: ${act.status} ${JSON.stringify(act.body)}`);
const actividad = act.body.data;
const codigo = actividad.codigosDeAcceso?.[0]?.codigo;
ok(codigo, 'sin código de acceso');
const notifs = actividad.notificaciones || [];
console.log('   OK actividad', actividad.id, 'código', codigo, 'notifs', notifs.length, notifs[0]?.canal, notifs[0]?.previewUrl ? 'preview' : '');

console.log('6) Iniciar actividad…');
const ini = await request(app)
  .post(`/api/actividades/${actividad.id}/iniciar`)
  .set('Authorization', `Bearer ${token}`);
ok(ini.status === 200, `iniciar: ${ini.status} ${JSON.stringify(ini.body)}`);
console.log('   OK iniciada');

console.log('7) Login estudiante con código…');
const loginEst = await request(app).post('/api/acceso/estudiantes/ingreso').send({
  correo: estudiante.correo,
  codigo
});
ok(loginEst.status === 200, `login est: ${loginEst.status} ${JSON.stringify(loginEst.body)}`);
const tokenEst = loginEst.body.token;
ok(loginEst.body.usuario?.actividadId === actividad.id, 'actividadId no coincide');
console.log('   OK estudiante token');

console.log('8) Bandeja notificaciones estudiante…');
const bandeja = await request(app)
  .get('/api/notificaciones')
  .set('Authorization', `Bearer ${tokenEst}`);
ok(bandeja.status === 200, `bandeja: ${bandeja.status}`);
ok((bandeja.body.data || []).length >= 1, 'bandeja vacía');
console.log('   OK avisos', bandeja.body.data.length);

console.log('9) Iniciar sesión de práctica…');
const ses = await request(app)
  .post(`/api/sesiones/actividades/${actividad.id}/iniciar`)
  .set('Authorization', `Bearer ${tokenEst}`);
ok(ses.status === 200, `sesión: ${ses.status} ${JSON.stringify(ses.body)}`);
const sesion = ses.body.data;
ok(sesion?.id, 'sin sesion.id');
ok(sesion.casoId || casoId, 'sin casoId');
console.log('   OK sesión', sesion.id, 'caso', sesion.casoId);

console.log('10) Obtener caso (estudiante)…');
const casoEst = await request(app)
  .get(`/api/casos/${sesion.casoId || casoId}`)
  .set('Authorization', `Bearer ${tokenEst}`);
ok(casoEst.status === 200, `caso est: ${casoEst.status}`);
const decision = casoEst.body.data?.escenas?.[0]?.decisiones?.[0];
const opcion = decision?.opciones?.[0];
ok(decision?.id && opcion?.id, 'caso sin decisión/opción');
ok(opcion.esCorrecta === undefined || typeof opcion.esCorrecta === 'boolean', 'shape opciones');
// Para estudiante suele ocultarse esCorrecta
console.log('   OK caso', casoEst.body.data.titulo, 'decision', decision.id);

console.log('11) Registrar respuesta…');
const resp = await request(app)
  .post('/api/participacion/respuestas')
  .set('Authorization', `Bearer ${tokenEst}`)
  .send({
    sesionId: sesion.id,
    decisionId: decision.id,
    opcionId: opcion.id
  });
ok(resp.status === 200 || resp.status === 201, `respuesta: ${resp.status} ${JSON.stringify(resp.body)}`);
console.log('   OK respuesta');

console.log('12) Progreso…');
const prog = await request(app)
  .get(`/api/participacion/sesiones/${sesion.id}/progreso`)
  .set('Authorization', `Bearer ${tokenEst}`);
ok(prog.status === 200, `progreso: ${prog.status}`);
console.log('   OK', prog.body.data);

console.log('13) Finalizar sesión…');
const finSes = await request(app)
  .post(`/api/sesiones/${sesion.id}/finalizar`)
  .set('Authorization', `Bearer ${tokenEst}`);
ok(finSes.status === 200, `finalizar: ${finSes.status} ${JSON.stringify(finSes.body)}`);
console.log('   OK evaluación', finSes.body.data?.evaluacion?.resultado ?? finSes.body.data);

console.log('14) Retroalimentación…');
const retro = await request(app)
  .get(`/api/participacion/sesiones/${sesion.id}/retroalimentacion`)
  .set('Authorization', `Bearer ${tokenEst}`);
ok(retro.status === 200, `retro: ${retro.status}`);
console.log('   OK items', Array.isArray(retro.body.data) ? retro.body.data.length : retro.body.data);

console.log('15) Convocatorias docente…');
const conv = await request(app)
  .get(`/api/actividades/${actividad.id}/convocatorias`)
  .set('Authorization', `Bearer ${token}`);
ok(conv.status === 200, `conv: ${conv.status}`);
ok((conv.body.data || []).length >= 1, 'sin filas de notificación');
console.log('   OK', conv.body.data.length, conv.body.data[0]?.canal, conv.body.data[0]?.estado);

console.log('\n✅ SMOKE ENTREGA OK');
process.exit(0);
