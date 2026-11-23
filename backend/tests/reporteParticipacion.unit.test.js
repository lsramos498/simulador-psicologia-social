import test from 'node:test';
import assert from 'node:assert/strict';
import { generarReporteParticipacion } from '../src/modules/sesiones/reporteParticipacion.js';

const encabezado = '\uFEFFActividad,Caso,Estudiante,Nombres,Apellidos,Correo,Estado de participación,Intento de participación,Preguntas respondidas,Total de preguntas,Nota oficial,Intento de la nota\r\n';

test('preserva UTF-8, separadores, comillas, saltos de línea, ceros y notas decimales', () => {
  const csv = generarReporteParticipacion([{
    actividadId: 4,
    casoId: 7,
    estudianteId: 5,
    nombres: 'María, Elena',
    apellidos: 'Ruiz "Rojas"\r\nLópez',
    correo: '  =1+1',
    estado: 'En curso',
    intentoParticipacion: 2,
    preguntasRespondidas: 0,
    totalPreguntas: 3,
    notaOficial: '0.00',
    intentoNota: 1
  }]);
  assert.equal(
    csv,
    encabezado + '4,7,5,"María, Elena","Ruiz ""Rojas""\r\nLópez",\'  =1+1,En curso,2,0,3,0.00,1\r\n'
  );
});

test('sin convocados solo se exporta el encabezado', () => {
  assert.equal(generarReporteParticipacion([]), encabezado);
});

test('protege los prefijos que Excel puede interpretar como fórmulas', () => {
  for (const valor of ['=1+1', '+1', '-1', '@SUMA(A1)', '\t=1', '  =1', '＝1']) {
    const csv = generarReporteParticipacion([{ nombres: valor }]);
    assert.ok(csv.includes(`,'${valor},`));
  }
});
