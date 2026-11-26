import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCIONES_CAMBIO_ESTUDIANTE,
  NotificacionConvocatoriaStrategy,
  NotificacionCambioEstudianteStrategy,
  NotificacionComentarioDocenteStrategy
} from './notificaciones.strategy.js';

const convocatoria = new NotificacionConvocatoriaStrategy();
const cambios = new NotificacionCambioEstudianteStrategy();
const comentarioDocenteMail = new NotificacionComentarioDocenteStrategy();
const datosConvocatoria = {
  destinatario: 'estudiante@universidad.edu.co',
  caso: {
    titulo: 'Conflicto social',
    desarrolloSituacional: 'Desarrollo del caso',
    contextoHistoria: 'Contexto de la historia'
  },
  mensajePersonalizado: 'Prepárate para participar.',
  urlAcceso: 'https://lumina.edu.co/actividad/10',
  codigoAutorizacion: 'ABC23456',
  docenteCorreo: 'docente.casos@unihumboldt.edu.co',
  docenteNombre: 'Docente Casos'
};
test('Genera correctamente un correo de convocatoria', () => {
  const resultado = convocatoria.crearMensaje(datosConvocatoria);

  assert.equal(
    resultado.to,
    'estudiante@universidad.edu.co'
  );

  assert.equal(
    resultado.subject,
    '✨ Convocatoria Lumina: Conflicto social'
  );

  assert.match(resultado.text, /ABC23456/);
  assert.match(resultado.text, /Prepárate para participar/);
  assert.match(resultado.text, /código de sesión/i);
  assert.match(resultado.html, /lumina\.edu\.co/);
  assert.match(resultado.html, /código de inicio de sesión/i);
  assert.match(resultado.html, /LUMINA|cid:lumina-portada/);
  assert.equal(resultado.replyTo, 'docente.casos@unihumboldt.edu.co');
  assert.match(resultado.text, /Docente Casos/);
  assert.match(resultado.text, /Remitente técnico: Lumina/);
  assert.ok(Array.isArray(resultado.attachments));
});

test('La convocatoria sin docente no exige Reply-To', () => {
  const { docenteCorreo, docenteNombre, ...sinDocente } = datosConvocatoria;
  const resultado = convocatoria.crearMensaje(sinDocente);
  assert.equal(resultado.replyTo, undefined);
});
test('Protege el contenido HTML de datos no confiables', () => {
  const resultado = convocatoria.crearMensaje({
    ...datosConvocatoria,
    caso: {
      titulo: '<script>alert("prueba")</script>',
      desarrolloSituacional: '<b>Contenido</b>',
      contextoHistoria: 'Contexto de prueba'
    }
  });

  assert.equal(
    resultado.html.includes('<script>'),
    false
  );

  assert.match(resultado.html, /&lt;script&gt;/);
  assert.match(resultado.html, /&lt;b&gt;Contenido&lt;\/b&gt;/);
});
test('Genera una notificación cuando un estudiante es agregado', () => {
  const resultado = cambios.crearMensaje({
    destinatario: 'estudiante@universidad.edu.co',
    casoTitulo: 'Conflicto social',
    accion: ACCIONES_CAMBIO_ESTUDIANTE.AGREGADO
  });

  assert.equal(
    resultado.to,
    'estudiante@universidad.edu.co'
  );

  assert.match(resultado.subject, /Actualización Lumina/);
  assert.match(resultado.text, /Has sido agregado/);
  assert.match(resultado.html, /Has sido agregado/);
});

test('Genera una notificación cuando un estudiante es retirado', () => {
  const resultado = cambios.crearMensaje({
    destinatario: 'estudiante@universidad.edu.co',
    casoTitulo: 'Conflicto social',
    accion: ACCIONES_CAMBIO_ESTUDIANTE.RETIRADO
  });

  assert.match(resultado.text, /Has sido retirado/);
});
test('Rechaza correos electrónicos inválidos', () => {
  assert.throws(
    () => convocatoria.crearMensaje({
      ...datosConvocatoria,
      destinatario: 'correo-invalido'
    }),
    TypeError
  );
});

test('Rechaza URL de acceso con protocolo inseguro', () => {
  assert.throws(
    () => convocatoria.crearMensaje({
      ...datosConvocatoria,
      urlAcceso: 'javascript:alert(1)'
    }),
    TypeError
  );
});

test('Rechaza acciones de cambio no definidas', () => {
  assert.throws(
    () => cambios.crearMensaje({
      destinatario: 'estudiante@universidad.edu.co',
      casoTitulo: 'Conflicto social',
      accion: 'MODIFICADO'
    }),
    TypeError
  );
});

test('Rechaza títulos de caso vacíos', () => {
  assert.throws(
    () => convocatoria.crearMensaje({
      ...datosConvocatoria,
      caso: { titulo: '   ' }
    }),
    TypeError
  );
});

test('Genera correo de comentario docente con título y retroalimentación', () => {
  const resultado = comentarioDocenteMail.crearMensaje({
    destinatario: 'estudiante@universidad.edu.co',
    casoTitulo: 'Conflicto en sala de espera',
    comentarioDocente: 'Muy buen cierre de la intervención.',
    retroalimentacionGeneral: 'Respondiste con criterio ético.',
    nota: 4,
    casoId: 41,
    docenteCorreo: 'docente.casos@unihumboldt.edu.co',
    docenteNombre: 'Docente Casos',
    estudianteNombre: 'Ana Pérez'
  });

  assert.equal(resultado.to, 'estudiante@universidad.edu.co');
  assert.match(resultado.subject, /Conflicto en sala de espera/);
  assert.match(resultado.text, /Muy buen cierre/);
  assert.match(resultado.text, /Respondiste con criterio ético/);
  assert.match(resultado.html, /Comentario del docente/);
  assert.match(resultado.html, /Conflicto en sala de espera/);
  assert.doesNotMatch(resultado.html, /Ver mi resultado/);
  assert.equal(resultado.replyTo, 'docente.casos@unihumboldt.edu.co');
  assert.ok(Array.isArray(resultado.attachments));
});
