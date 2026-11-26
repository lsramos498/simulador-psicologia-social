import { Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = 'https://github.com/lsramos498/simulador-psicologia-social';

const border = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
const borders = { top: border, bottom: border, left: border, right: border };

function cell(text, bold = false) {
  return new TableCell({
    borders,
    width: { size: 2340, type: WidthType.DXA },
    children: [new Paragraph({
      children: [new TextRun({ text, bold, size: 18, font: 'Calibri' })]
    })]
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 160 },
    ...opts,
    children: [new TextRun({ text, size: 22, font: 'Calibri', ...opts.run })]
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { after: 80 },
    indent: { left: 360 },
    children: [new TextRun({ text: `• ${text}`, size: 22, font: 'Calibri' })]
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, font: 'Calibri' })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, font: 'Calibri' })]
  });
}

const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: 'Informe de avance del Backend — Lumina', bold: true, size: 36, font: 'Calibri' })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: 'Del 40 % al 70 % (Segundo corte — Proyecto Nuclear II)', size: 26, font: 'Calibri', italics: true })]
      }),

      p('Proyecto: Simulador de Psicología Social — plataforma Lumina'),
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({ text: 'Repositorio: ', size: 22, font: 'Calibri', bold: true }),
          new ExternalHyperlink({
            children: [new TextRun({ text: REPO, style: 'Hyperlink', size: 22, font: 'Calibri', color: '0563C1', underline: {} })],
            link: REPO
          })
        ]
      }),
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({ text: 'Enlace del repositorio: ', size: 22, font: 'Calibri', bold: true }),
          new TextRun({ text: REPO, size: 22, font: 'Calibri', color: '0563C1' })
        ]
      }),
      p('Rama de integración: develop'),
      p('Periodo: entrega del ~40 % → entrega del mínimo ~70 % (noviembre 2026)'),
      p('Equipo: Laura Ramos, Stefanía Díaz, Sofía Gallego, Valeria Tobar'),

      h1('1. Resumen ejecutivo'),
      p('El equipo construyó el Backend de Lumina sobre Node.js, Express y MySQL, con API REST, autenticación JWT, módulos por responsabilidad, patrones de diseño justificados y pruebas automatizadas.'),
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({ text: 'El código está en: ', size: 22, font: 'Calibri' }),
          new ExternalHyperlink({
            children: [new TextRun({ text: REPO, style: 'Hyperlink', size: 22, font: 'Calibri', color: '0563C1', underline: {} })],
            link: REPO
          })
        ]
      }),
      p('Estado actual: el Backend supera el umbral del 70 % mínimo en funcionalidades principales implementadas, integradas y con evidencia de pruebas. Persisten pendientes hacia el 100 % (evaluación/calificación completa, RF-22, consolidación documental conjunta, etc.).'),

      h1('2. Organización del trabajo'),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        rows: [
          new TableRow({ children: [cell('Integrante', true), cell('Módulo', true), cell('Requisitos', true), cell('Patrón', true)] }),
          new TableRow({ children: [cell('Sofía Gallego'), cell('Acceso y permisos'), cell('RF-01, 02, 03, 20'), cell('Proxy')] }),
          new TableRow({ children: [cell('Stefanía Díaz'), cell('Casos y rúbricas'), cell('RF-05 a 09, parte RF-17'), cell('Builder')] }),
          new TableRow({ children: [cell('Laura Ramos'), cell('Actividades, sesiones, notificaciones'), cell('RF-04, 18, 19, 21'), cell('State (+ Strategy/Factory)')] }),
          new TableRow({ children: [cell('Valeria Tobar'), cell('Participación y respuestas'), cell('RF-10, RF-11'), cell('Observer')] })
        ]
      }),
      p('Convención Git: main (estable), develop (integración), feature/... (trabajo individual) y pull requests con revisión entre compañeras.'),

      h1('3. Lo que hizo cada una'),

      h2('3.1 Sofía Gallego — Acceso y permisos'),
      p('Responsabilidad: autenticación, autorización, roles/permisos y protección de operaciones.'),
      bullet('Ingreso de estudiantes con correo + código de autorización (hash HMAC), JWT y actividad de la convocatoria (RF-01, RF-20).'),
      bullet('Ingreso de docentes/administradores con correo + contraseña (scrypt).'),
      bullet('Administración RF-03: crear docentes, roles, permisos y seed inicial.'),
      bullet('Middlewares autenticar, requiereRol, requierePermiso y requiereActividadAutorizada.'),
      bullet('Política de contraseñas y límite de intentos de ingreso.'),
      bullet('Patrón Proxy en POST /api/casos.'),
      bullet('Documentación, Postman, pruebas y PT-DCP-01; PR #6 mergeado en develop.'),
      p('Evidencia: backend/src/modules/acceso/, rutas /api/acceso.'),

      h2('3.2 Stefanía Díaz — Casos académicos y rúbricas'),
      p('Responsabilidad: estructura y ciclo de vida de casos situacionales, escenarios, preguntas, opciones, explicaciones, validación/publicación y rúbricas.'),
      bullet('Modelo, validación y persistencia MySQL del agregado Caso.'),
      bullet('Creación con Builder (POST /api/casos/construir) y edición PATCH de escenas, preguntas y opciones.'),
      bullet('Asociación de rúbricas (ponderaciones = 100) — parte de RF-17.'),
      bullet('Publicación solo si la estructura cumple reglas; archivo; solo borrador editable.'),
      bullet('Permisos CREAR_CASOS; solo creador o administrador gestiona el caso.'),
      bullet('Pruebas, arquitectura, antipatrones, PT-DCP-01 y sustentación; PR #8 y #9 en develop.'),
      p('Evidencia: backend/src/modules/casos/, rutas /api/casos.'),

      h2('3.3 Laura Ramos — Actividades, sesiones y notificaciones'),
      p('Responsabilidad: programación de actividades, ciclo de vida de sesiones, coordinación; canal de correo.'),
      bullet('Bootstrap de la API y conexión MySQL.'),
      bullet('Actividades programadas: crear, consultar, iniciar, cerrar; transiciones y cierre automático.'),
      bullet('Sesiones con patrón State: Sin iniciar → En curso → Finalizado.'),
      bullet('Notificaciones con Strategy y Factory Method; transporte SMTP (RF-21).'),
      bullet('Coordinación de merges e integración del equipo.'),
      p('Evidencia: backend/src/modules/actividades/, sesiones/, notificaciones/.'),

      h2('3.4 Valeria Tobar — Participación y respuestas'),
      p('Responsabilidad: registro/modificación de respuestas, consulta, progreso; notificaciones internas.'),
      bullet('Registro y consulta de respuestas con persistencia MySQL (RF-10/RF-11).'),
      bullet('Validación de propietario, estado En curso y cadena caso/escena/decisión/opción.'),
      bullet('Cálculo de progreso y exposición HTTP.'),
      bullet('Patrón Observer para eventos y notificación interna.'),
      bullet('Pruebas unitarias y MySQL real (LUMINA_MYSQL_TEST=1).'),
      p('Evidencia: backend/src/modules/participacion/.'),

      h1('4. Patrones de diseño implementados'),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        rows: [
          new TableRow({ children: [cell('Patrón', true), cell('Integrante', true), cell('Archivo / uso', true), cell('Problema que resuelve', true)] }),
          new TableRow({ children: [cell('Builder'), cell('Stefanía'), cell('caso.builder.js'), cell('Armar caso complejo por pasos y validarlo')] }),
          new TableRow({ children: [cell('Proxy'), cell('Sofía'), cell('servicioProtegido.proxy.js'), cell('Exigir permiso antes de crear casos')] }),
          new TableRow({ children: [cell('State'), cell('Laura'), cell('sesion.state.js'), cell('Transiciones legales de la sesión')] }),
          new TableRow({ children: [cell('Observer'), cell('Valeria'), cell('eventosParticipacion.js'), cell('Desacoplar eventos de reacciones')] }),
          new TableRow({ children: [cell('Strategy'), cell('Laura'), cell('notificaciones.strategy.js'), cell('Variar tipo de notificación')] }),
          new TableRow({ children: [cell('Factory Method'), cell('Laura'), cell('notificaciones.factory.js'), cell('Crear estrategia concreta')] })
        ]
      }),
      p('Criterio del equipo: cada patrón resuelve una necesidad real del simulador y cuenta con pruebas.'),

      h1('5. Integración entre módulos'),
      bullet('Sofía: docente/admin inicia sesión; administración de roles.'),
      bullet('Stefanía: docente crea/valida/publica un caso con rúbrica.'),
      bullet('Laura: docente programa actividad y gestiona sesiones (State).'),
      bullet('Sofía: estudiante ingresa con código (JWT + actividadId).'),
      bullet('Valeria: estudiante registra respuestas y consulta progreso.'),
      bullet('Laura/Valeria: notificaciones (correo / internas).'),
      p('Infraestructura común: Express, pool MySQL y schema.sql.'),

      h1('6. Pruebas y evidencia'),
      bullet('Suite npm test con cientos de pruebas y 0 fallos en corridas recientes.'),
      bullet('Pruebas por módulo (casos, acceso, actividades, participación, sesiones, notificaciones).'),
      bullet('Postman del módulo de acceso.'),
      bullet('PT-DCP-01: Sofía y Stefanía ya aportaron filas; falta consolidar con Laura y Valeria.'),

      h1('7. Evolución 40 % → 70 %'),
      p('Del esqueleto API y primeras validaciones se pasó a rutas integradas, persistencia MySQL en los cuatro módulos, seguridad (roles, permisos, Proxy, dueño del caso), Builder/publicación/rúbricas, State de sesiones, Observer/progreso y notificaciones SMTP, con amplia cobertura de pruebas y PRs mergeados.'),

      h1('8. Pendientes hacia Backend completo'),
      bullet('Evaluación/calificación con rúbrica al finalizar.'),
      bullet('RF-22 (umbral de ingreso tardío) y RF de cierre del documento oficial.'),
      bullet('Merge final de ramas abiertas de Laura/Valeria si aplica.'),
      bullet('Consolidar un único PT-DCP-01 del equipo.'),
      bullet('Frontend consumiendo la API real (complementario).'),

      h1('9. Conclusión'),
      p('Entre el avance del 40 % y el del 70 %, las cuatro integrantes aportaron código de Backend real, con requisitos trazables, patrones aplicados, persistencia MySQL, control de acceso e integración en el mismo repositorio.'),
      p('El 70 % es el mínimo de la entrega, no el techo del proyecto: el equipo continúa hacia un Backend completo.'),
      new Paragraph({
        spacing: { before: 200, after: 120 },
        children: [
          new TextRun({ text: 'Repositorio del proyecto: ', size: 22, font: 'Calibri', bold: true }),
          new ExternalHyperlink({
            children: [new TextRun({ text: REPO, style: 'Hyperlink', size: 22, font: 'Calibri', color: '0563C1', underline: {} })],
            link: REPO
          })
        ]
      }),
      p('Documento elaborado a partir del estado del repositorio (noviembre 2026). Debe cotejarse con la matriz oficial de requisitos (hoja «16 de octubre»).')
    ]
  }]
});

const out = path.join(__dirname, 'INFORME-avance-40-a-70-backend-lumina.docx');
const desktop = path.join('C:\\Users\\sdiaz\\Desktop', 'INFORME-avance-40-a-70-backend-lumina.docx');
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(out, buffer);
fs.writeFileSync(desktop, buffer);
console.log('OK:', out);
console.log('OK:', desktop);
