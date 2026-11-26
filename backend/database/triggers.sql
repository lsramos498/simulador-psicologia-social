-- =====================================================
-- DISPARADORES (TRIGGERS) — Proyecto Nuclear / Lumina
-- MySQL 8. Ejecutar sobre proyecto_nuclear (o _test).
-- =====================================================

USE proyecto_nuclear;

-- Auditoría de cambios de estado de casos
CREATE TABLE IF NOT EXISTS AuditoriaCaso (
  id INT NOT NULL AUTO_INCREMENT,
  caso_id INT NOT NULL,
  estadoAnterior VARCHAR(20) NULL,
  estadoNuevo VARCHAR(20) NOT NULL,
  fechaCambio DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_auditoria_caso (caso_id),
  CONSTRAINT fk_auditoria_caso
    FOREIGN KEY (caso_id) REFERENCES Caso (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Historial de cambios de estado del caso (llenado por trigger).';

-- Auditoría de cambios de estado de actividades
CREATE TABLE IF NOT EXISTS AuditoriaActividad (
  id INT NOT NULL AUTO_INCREMENT,
  actividad_id INT NOT NULL,
  estadoAnterior VARCHAR(20) NULL,
  estadoNuevo VARCHAR(20) NOT NULL,
  fechaCambio DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_auditoria_actividad (actividad_id),
  CONSTRAINT fk_auditoria_actividad
    FOREIGN KEY (actividad_id) REFERENCES ActividadProgramada (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Historial de cambios de estado de la actividad (llenado por trigger).';

-- Auditoría de cambios de estado de sesiones
CREATE TABLE IF NOT EXISTS AuditoriaSesion (
  id INT NOT NULL AUTO_INCREMENT,
  sesion_id INT NOT NULL,
  estadoAnterior VARCHAR(20) NULL,
  estadoNuevo VARCHAR(20) NOT NULL,
  fechaCambio DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_auditoria_sesion (sesion_id),
  CONSTRAINT fk_auditoria_sesion
    FOREIGN KEY (sesion_id) REFERENCES SesionSimulacion (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Historial de cambios de estado de la sesión (llenado por trigger).';

DROP TRIGGER IF EXISTS trg_usuario_fecha_actualizacion;
DROP TRIGGER IF EXISTS trg_usuario_correo_minusculas_ins;
DROP TRIGGER IF EXISTS trg_usuario_correo_minusculas_upd;
DROP TRIGGER IF EXISTS trg_caso_fecha_actualizacion;
DROP TRIGGER IF EXISTS trg_caso_auditoria_estado;
DROP TRIGGER IF EXISTS trg_caso_no_eliminar_publicado;
DROP TRIGGER IF EXISTS trg_caso_publicar_requiere_escena;
DROP TRIGGER IF EXISTS trg_sesion_marcar_inicio;
DROP TRIGGER IF EXISTS trg_sesion_marcar_fin;
DROP TRIGGER IF EXISTS trg_sesion_transicion_estado;
DROP TRIGGER IF EXISTS trg_sesion_auditoria_estado;
DROP TRIGGER IF EXISTS trg_respuesta_solo_en_curso;
DROP TRIGGER IF EXISTS trg_respuesta_update_solo_en_curso;
DROP TRIGGER IF EXISTS trg_respuesta_fecha_modificacion;
DROP TRIGGER IF EXISTS trg_respuesta_registrar_interaccion;
DROP TRIGGER IF EXISTS trg_respuesta_update_interaccion;
DROP TRIGGER IF EXISTS trg_actividad_caso_publicado;
DROP TRIGGER IF EXISTS trg_actividad_tiempo_limite;
DROP TRIGGER IF EXISTS trg_actividad_auditoria_estado;
DROP TRIGGER IF EXISTS trg_notificacion_fechas_estado;
DROP TRIGGER IF EXISTS trg_autorizacion_marcar_consumida;
DROP TRIGGER IF EXISTS trg_evaluacion_sesion_finalizada;
DROP TRIGGER IF EXISTS trg_asistencia_sincronizar_fecha;
DROP TRIGGER IF EXISTS trg_espacio_codigo_mayusculas;
DROP TRIGGER IF EXISTS trg_codigo_login_expira_default;
DROP TRIGGER IF EXISTS trg_codigo_login_no_reutilizar;
DROP TRIGGER IF EXISTS trg_sesion_defaults_insert;
DROP TRIGGER IF EXISTS trg_actividad_fechas_validas;
DROP TRIGGER IF EXISTS trg_caso_no_editar_publicado;
DROP TRIGGER IF EXISTS trg_escena_orden_positivo;

DELIMITER $$

-- =====================================================
-- USUARIO
-- =====================================================

-- 1) Al actualizar usuario, guarda fechaActualizacion
CREATE TRIGGER trg_usuario_fecha_actualizacion
BEFORE UPDATE ON Usuario
FOR EACH ROW
BEGIN
  SET NEW.fechaActualizacion = NOW();
END$$

-- 2) Normaliza correo a minúsculas al insertar
CREATE TRIGGER trg_usuario_correo_minusculas_ins
BEFORE INSERT ON Usuario
FOR EACH ROW
BEGIN
  SET NEW.correoInstitucional = LOWER(TRIM(NEW.correoInstitucional));
END$$

-- 3) Normaliza correo a minúsculas al actualizar
CREATE TRIGGER trg_usuario_correo_minusculas_upd
BEFORE UPDATE ON Usuario
FOR EACH ROW
BEGIN
  SET NEW.correoInstitucional = LOWER(TRIM(NEW.correoInstitucional));
END$$

-- =====================================================
-- CASO
-- =====================================================

-- 4) Al actualizar caso, guarda fechaActualizacion
CREATE TRIGGER trg_caso_fecha_actualizacion
BEFORE UPDATE ON Caso
FOR EACH ROW
BEGIN
  SET NEW.fechaActualizacion = NOW();
END$$

-- 5) Si cambia el estado del caso, audita en AuditoriaCaso
CREATE TRIGGER trg_caso_auditoria_estado
AFTER UPDATE ON Caso
FOR EACH ROW
BEGIN
  IF NOT (OLD.estado <=> NEW.estado) THEN
    INSERT INTO AuditoriaCaso (caso_id, estadoAnterior, estadoNuevo, fechaCambio)
    VALUES (NEW.id, OLD.estado, NEW.estado, NOW());
  END IF;
END$$

-- 6) No se puede eliminar un caso Publicado
CREATE TRIGGER trg_caso_no_eliminar_publicado
BEFORE DELETE ON Caso
FOR EACH ROW
BEGIN
  IF OLD.estado = 'Publicado' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'No se puede eliminar un caso Publicado. Archívelo primero.';
  END IF;
END$$

-- 7) Para publicar, el caso debe tener al menos una escena
CREATE TRIGGER trg_caso_publicar_requiere_escena
BEFORE UPDATE ON Caso
FOR EACH ROW
BEGIN
  DECLARE total_escenas INT DEFAULT 0;

  IF NEW.estado = 'Publicado' AND (OLD.estado IS NULL OR OLD.estado <> 'Publicado') THEN
    SELECT COUNT(*) INTO total_escenas FROM Escena WHERE caso_id = NEW.id;
    IF total_escenas < 1 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No se puede publicar un caso sin al menos una escena.';
    END IF;
  END IF;
END$$

-- =====================================================
-- SESIÓN
-- =====================================================

-- 8) Valida transición de estado de la sesión
CREATE TRIGGER trg_sesion_transicion_estado
BEFORE UPDATE ON SesionSimulacion
FOR EACH ROW
BEGIN
  IF NOT (OLD.estado <=> NEW.estado) THEN
    IF OLD.estado = 'Sin iniciar' AND NEW.estado NOT IN ('En curso', 'Finalizado') THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Desde Sin iniciar solo se permite En curso o Finalizado.';
    END IF;
    IF OLD.estado = 'En curso' AND NEW.estado <> 'Finalizado' THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Desde En curso solo se permite pasar a Finalizado.';
    END IF;
    IF OLD.estado = 'Finalizado' THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Una sesión Finalizado no puede cambiar de estado.';
    END IF;
  END IF;
END$$

-- 9) Marca inicio al pasar a En curso
CREATE TRIGGER trg_sesion_marcar_inicio
BEFORE UPDATE ON SesionSimulacion
FOR EACH ROW
BEGIN
  IF NEW.estado = 'En curso'
     AND (OLD.estado IS NULL OR OLD.estado <> 'En curso')
     AND NEW.inicio IS NULL THEN
    SET NEW.inicio = NOW();
  END IF;
END$$

-- 10) Marca fin al pasar a Finalizado
CREATE TRIGGER trg_sesion_marcar_fin
BEFORE UPDATE ON SesionSimulacion
FOR EACH ROW
BEGIN
  IF NEW.estado = 'Finalizado'
     AND (OLD.estado IS NULL OR OLD.estado <> 'Finalizado')
     AND NEW.fin IS NULL THEN
    SET NEW.fin = NOW();
  END IF;
END$$

-- 11) Audita cambio de estado de sesión
CREATE TRIGGER trg_sesion_auditoria_estado
AFTER UPDATE ON SesionSimulacion
FOR EACH ROW
BEGIN
  IF NOT (OLD.estado <=> NEW.estado) THEN
    INSERT INTO AuditoriaSesion (sesion_id, estadoAnterior, estadoNuevo, fechaCambio)
    VALUES (NEW.id, OLD.estado, NEW.estado, NOW());
  END IF;
END$$

-- =====================================================
-- RESPUESTAS
-- =====================================================

-- 12) Solo insertar respuestas si la sesión está En curso
CREATE TRIGGER trg_respuesta_solo_en_curso
BEFORE INSERT ON RespuestaEstudiante
FOR EACH ROW
BEGIN
  DECLARE estado_sesion VARCHAR(20);

  SELECT estado INTO estado_sesion
  FROM SesionSimulacion
  WHERE id = NEW.sesion_id;

  IF estado_sesion IS NULL OR estado_sesion <> 'En curso' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Solo se pueden registrar respuestas en sesiones En curso.';
  END IF;

  IF NEW.fechaRespuesta IS NULL THEN
    SET NEW.fechaRespuesta = NOW();
  END IF;
END$$

-- 13) Cambiar la opción elegida solo si la sesión sigue En curso
--     (permite actualizar esCorrecta/puntuacion al calificar una sesión Finalizado)
CREATE TRIGGER trg_respuesta_update_solo_en_curso
BEFORE UPDATE ON RespuestaEstudiante
FOR EACH ROW
BEGIN
  DECLARE estado_sesion VARCHAR(20);

  IF NOT (OLD.opcion_id <=> NEW.opcion_id) THEN
    SELECT estado INTO estado_sesion
    FROM SesionSimulacion
    WHERE id = NEW.sesion_id;

    IF estado_sesion IS NULL OR estado_sesion <> 'En curso' THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Solo se pueden cambiar opciones en sesiones En curso.';
    END IF;
  END IF;
END$$

-- 14) Al modificar una respuesta, pone fechaModificacion
CREATE TRIGGER trg_respuesta_fecha_modificacion
BEFORE UPDATE ON RespuestaEstudiante
FOR EACH ROW
BEGIN
  SET NEW.fechaModificacion = NOW();
END$$

-- 15) Cada respuesta nueva deja evento en RegistroInteraccion
CREATE TRIGGER trg_respuesta_registrar_interaccion
AFTER INSERT ON RespuestaEstudiante
FOR EACH ROW
BEGIN
  INSERT INTO RegistroInteraccion (
    sesion_id, escena_id, decision_id, opcion_id,
    momento, duracionSegundos, tipoEvento, detalle
  )
  VALUES (
    NEW.sesion_id, NULL, NEW.decision_id, NEW.opcion_id,
    COALESCE(NEW.fechaRespuesta, NOW()), NULL,
    'RespuestaRegistrada',
    CONCAT('Respuesta id=', NEW.id, ' en decision_id=', NEW.decision_id)
  );
END$$

-- 16) Cada cambio de opción deja evento en RegistroInteraccion
CREATE TRIGGER trg_respuesta_update_interaccion
AFTER UPDATE ON RespuestaEstudiante
FOR EACH ROW
BEGIN
  IF NOT (OLD.opcion_id <=> NEW.opcion_id) THEN
    INSERT INTO RegistroInteraccion (
      sesion_id, escena_id, decision_id, opcion_id,
      momento, duracionSegundos, tipoEvento, detalle
    )
    VALUES (
      NEW.sesion_id, NULL, NEW.decision_id, NEW.opcion_id,
      COALESCE(NEW.fechaModificacion, NOW()), NULL,
      'RespuestaModificada',
      CONCAT('Respuesta id=', NEW.id, ' cambio opcion ', IFNULL(OLD.opcion_id, 'NULL'), ' -> ', IFNULL(NEW.opcion_id, 'NULL'))
    );
  END IF;
END$$

-- =====================================================
-- ACTIVIDAD PROGRAMADA
-- =====================================================

-- 17) Solo se programa actividad sobre caso Publicado
CREATE TRIGGER trg_actividad_caso_publicado
BEFORE INSERT ON ActividadProgramada
FOR EACH ROW
BEGIN
  DECLARE estado_caso VARCHAR(20);
  DECLARE tiempo_caso INT;

  SELECT estado, tiempoEstimadoSegundos
    INTO estado_caso, tiempo_caso
  FROM Caso
  WHERE id = NEW.caso_id;

  IF estado_caso IS NULL OR estado_caso <> 'Publicado' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Solo se pueden programar actividades sobre casos Publicados.';
  END IF;

  IF NEW.tiempoLimiteSegundos > tiempo_caso THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El tiempo límite de la actividad no puede superar el del caso.';
  END IF;
END$$

-- 18) Al actualizar actividad, valida tiempo límite vs caso
CREATE TRIGGER trg_actividad_tiempo_limite
BEFORE UPDATE ON ActividadProgramada
FOR EACH ROW
BEGIN
  DECLARE tiempo_caso INT;

  SELECT tiempoEstimadoSegundos INTO tiempo_caso
  FROM Caso
  WHERE id = NEW.caso_id;

  IF NEW.tiempoLimiteSegundos > tiempo_caso THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El tiempo límite de la actividad no puede superar el del caso.';
  END IF;
END$$

-- 19) Audita cambio de estado de actividad
CREATE TRIGGER trg_actividad_auditoria_estado
AFTER UPDATE ON ActividadProgramada
FOR EACH ROW
BEGIN
  IF NOT (OLD.estado <=> NEW.estado) THEN
    INSERT INTO AuditoriaActividad (actividad_id, estadoAnterior, estadoNuevo, fechaCambio)
    VALUES (NEW.id, OLD.estado, NEW.estado, NOW());
  END IF;
END$$

-- =====================================================
-- NOTIFICACIÓN / AUTORIZACIÓN / EVALUACIÓN / OTROS
-- =====================================================

-- 20) Marca fechas al cambiar estado de notificación
CREATE TRIGGER trg_notificacion_fechas_estado
BEFORE UPDATE ON Notificacion
FOR EACH ROW
BEGIN
  IF NEW.estado = 'Enviada' AND (OLD.estado IS NULL OR OLD.estado <> 'Enviada') THEN
    IF NEW.fechaEnvio IS NULL THEN
      SET NEW.fechaEnvio = NOW();
    END IF;
  END IF;

  IF NEW.estado = 'Leida' AND (OLD.estado IS NULL OR OLD.estado <> 'Leida') THEN
    IF NEW.fechaLectura IS NULL THEN
      SET NEW.fechaLectura = NOW();
    END IF;
  END IF;
END$$

-- 21) Al consumir autorización de repetición, marca consumidaEn
CREATE TRIGGER trg_autorizacion_marcar_consumida
BEFORE UPDATE ON AutorizacionRepeticion
FOR EACH ROW
BEGIN
  IF NEW.estado = 'Consumida'
     AND (OLD.estado IS NULL OR OLD.estado <> 'Consumida')
     AND NEW.consumidaEn IS NULL THEN
    SET NEW.consumidaEn = NOW();
  END IF;
END$$

-- 22) Solo se evalúa una sesión Finalizado
CREATE TRIGGER trg_evaluacion_sesion_finalizada
BEFORE INSERT ON Evaluacion
FOR EACH ROW
BEGIN
  DECLARE estado_sesion VARCHAR(20);

  SELECT estado INTO estado_sesion
  FROM SesionSimulacion
  WHERE id = NEW.sesion_id;

  IF estado_sesion IS NULL OR estado_sesion <> 'Finalizado' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Solo se puede evaluar una sesión Finalizado.';
  END IF;

  IF NEW.fechaEvaluacion IS NULL THEN
    SET NEW.fechaEvaluacion = NOW();
  END IF;
END$$

-- 23) Si cambia el estado de asistencia, actualiza fechaRegistro
CREATE TRIGGER trg_asistencia_sincronizar_fecha
BEFORE UPDATE ON Asistencia
FOR EACH ROW
BEGIN
  IF NOT (OLD.estado <=> NEW.estado) THEN
    SET NEW.fechaRegistro = NOW();
  END IF;
END$$

-- 24) Normaliza código de espacio académico a mayúsculas
CREATE TRIGGER trg_espacio_codigo_mayusculas
BEFORE INSERT ON EspacioAcademico
FOR EACH ROW
BEGIN
  IF NEW.codigo IS NOT NULL THEN
    SET NEW.codigo = UPPER(TRIM(NEW.codigo));
  END IF;
END$$

-- =====================================================
-- CODIGO LOGIN ESTUDIANTE (OTP de sesión)
-- =====================================================

-- 25) Si no trae expiración, el OTP vale 15 minutos desde ahora
CREATE TRIGGER trg_codigo_login_expira_default
BEFORE INSERT ON CodigoLoginEstudiante
FOR EACH ROW
BEGIN
  IF NEW.expiraEn IS NULL THEN
    SET NEW.expiraEn = DATE_ADD(NOW(), INTERVAL 15 MINUTE);
  END IF;
  IF NEW.fechaCreacion IS NULL THEN
    SET NEW.fechaCreacion = NOW();
  END IF;
  IF NEW.usado IS NULL THEN
    SET NEW.usado = FALSE;
  END IF;
END$$

-- 26) Un OTP ya consumido (usado=TRUE) no puede volver a FALSE
CREATE TRIGGER trg_codigo_login_no_reutilizar
BEFORE UPDATE ON CodigoLoginEstudiante
FOR EACH ROW
BEGIN
  IF OLD.usado = TRUE AND NEW.usado = FALSE THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Un código de login ya usado no se puede reactivar.';
  END IF;
END$$

-- =====================================================
-- EXTRAS (refuerzo para revisión de clase)
-- =====================================================

-- 27) Al crear sesión: estado, intento y segundos por defecto
CREATE TRIGGER trg_sesion_defaults_insert
BEFORE INSERT ON SesionSimulacion
FOR EACH ROW
BEGIN
  IF NEW.estado IS NULL OR NEW.estado = '' THEN
    SET NEW.estado = 'Sin iniciar';
  END IF;
  IF NEW.numeroIntento IS NULL OR NEW.numeroIntento < 1 THEN
    SET NEW.numeroIntento = 1;
  END IF;
  IF NEW.segundosConsumidos IS NULL OR NEW.segundosConsumidos < 0 THEN
    SET NEW.segundosConsumidos = 0;
  END IF;
END$$

-- 28) Al programar actividad: fechaFin debe ser posterior a fechaInicio
CREATE TRIGGER trg_actividad_fechas_validas
BEFORE INSERT ON ActividadProgramada
FOR EACH ROW
BEGIN
  IF NEW.fechaFin <= NEW.fechaInicio THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La fecha de finalización debe ser posterior a la de inicio.';
  END IF;
END$$

-- 29) Un caso Publicado/Archivado no cambia su contenido (solo puede cambiar de estado)
CREATE TRIGGER trg_caso_no_editar_publicado
BEFORE UPDATE ON Caso
FOR EACH ROW
BEGIN
  IF OLD.estado IN ('Publicado', 'Archivado') THEN
    IF NOT (
         OLD.titulo <=> NEW.titulo
     AND OLD.desarrolloSituacional <=> NEW.desarrolloSituacional
     AND OLD.contextoHistoria <=> NEW.contextoHistoria
     AND OLD.tiempoEstimadoSegundos <=> NEW.tiempoEstimadoSegundos
     AND OLD.creador_id <=> NEW.creador_id
    ) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No se puede editar el contenido de un caso Publicado o Archivado.';
    END IF;
  END IF;
END$$

-- 30) El orden de una escena empieza en 1
CREATE TRIGGER trg_escena_orden_positivo
BEFORE INSERT ON Escena
FOR EACH ROW
BEGIN
  IF NEW.orden IS NULL OR NEW.orden < 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El orden de la escena debe ser un entero mayor o igual a 1.';
  END IF;
END$$

DELIMITER ;
