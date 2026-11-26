-- =====================================================
-- DEMO RÁPIDA DE DISPARADORES (para mostrar al profesor)
-- Requiere: schema + triggers.sql ya aplicados.
-- =====================================================

USE proyecto_nuclear;

-- 1) Listar todos los triggers del esquema
SELECT TRIGGER_NAME AS disparador,
       EVENT_OBJECT_TABLE AS tabla,
       ACTION_TIMING AS momento,
       EVENT_MANIPULATION AS evento
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = DATABASE()
ORDER BY tabla, momento, disparador;

-- 2) Normalización: correo a minúsculas (trg_usuario_correo_minusculas_ins)
--    (ajusta el id/correo si choca con un usuario existente)
-- INSERT INTO Usuario (nombres, apellidos, correoInstitucional, contrasenaHash, activo, fechaCreacion)
-- VALUES ('Demo', 'Trigger', 'DEMO.TRIGGER@UNI.EDU.CO', 'hash-demo', TRUE, NOW());
-- SELECT correoInstitucional FROM Usuario WHERE correoInstitucional LIKE '%demo.trigger%';
-- Esperado: demo.trigger@uni.edu.co

-- 3) Integridad: no evaluar sesión que no esté Finalizado
--    (debe FALLAR con mensaje del trigger trg_evaluacion_sesion_finalizada)
-- INSERT INTO Evaluacion (sesion_id, notaFinal, fechaEvaluacion)
-- VALUES (999999, 4.5, NOW());

-- 4) OTP: no reactivar un código ya usado (trg_codigo_login_no_reutilizar)
-- UPDATE CodigoLoginEstudiante SET usado = FALSE WHERE usado = TRUE LIMIT 1;
-- Esperado: error SQLSTATE 45000

-- 5) Auditoría de caso: al cambiar estado se llena AuditoriaCaso
-- UPDATE Caso SET estado = 'Archivado' WHERE id = <id_de_prueba> AND estado = 'Publicado';
-- SELECT * FROM AuditoriaCaso ORDER BY id DESC LIMIT 5;

-- 6) Ejemplo de clase (si aplicaste vistas_y_disparadores_clase.sql)
-- INSERT INTO estudiante (nombre, id_programa, semestre) VALUES ('PruebaTrigger', 1, NULL);
-- SELECT nombre, semestre FROM estudiante WHERE nombre = 'PruebaTrigger';
-- Esperado: semestre = 1
