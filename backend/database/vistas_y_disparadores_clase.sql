-- =====================================================
-- Vistas y disparadores al estilo de la clase
-- (ejemplo del profesor + equivalentes en Lumina)
-- =====================================================

USE proyecto_nuclear;

-- -----------------------------------------------------
-- EJEMPLO DEL PROFESOR: estudiante / programa
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS programa (
  id_programa INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  PRIMARY KEY (id_programa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS estudiante (
  id_estudiante INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  id_programa INT NULL,
  semestre INT NULL,
  PRIMARY KEY (id_estudiante),
  CONSTRAINT fk_estudiante_programa
    FOREIGN KEY (id_programa) REFERENCES programa (id_programa)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO programa (id_programa, nombre)
SELECT 1, 'Software' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM programa WHERE id_programa = 1);

INSERT INTO programa (id_programa, nombre)
SELECT 2, 'Sistemas' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM programa WHERE id_programa = 2);

INSERT INTO estudiante (nombre, id_programa, semestre)
SELECT 'Ana', 1, 2 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM estudiante WHERE nombre = 'Ana');

INSERT INTO estudiante (nombre, id_programa, semestre)
SELECT 'Luis', 1, 3 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM estudiante WHERE nombre = 'Luis');

INSERT INTO estudiante (nombre, id_programa, semestre)
SELECT 'Marta', 2, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM estudiante WHERE nombre = 'Marta');

INSERT INTO estudiante (nombre, id_programa, semestre)
SELECT 'Pedro', NULL, 4 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM estudiante WHERE nombre = 'Pedro');

DROP VIEW IF EXISTS v_estudiante_programa;
CREATE VIEW v_estudiante_programa AS
SELECT e.nombre AS estudiante,
       p.nombre AS programa
FROM estudiante e
LEFT JOIN programa p
  ON p.id_programa = e.id_programa;

DROP TRIGGER IF EXISTS tg_semestre_inicial;

DELIMITER $$

-- Disparador exacto del ejemplo de clase:
-- si un estudiante se inserta sin semestre (NULL), queda en semestre 1
CREATE TRIGGER tg_semestre_inicial
BEFORE INSERT ON estudiante
FOR EACH ROW
BEGIN
  IF NEW.semestre IS NULL THEN
    SET NEW.semestre = 1;
  END IF;
END$$

DELIMITER ;

-- -----------------------------------------------------
-- EQUIVALENTES EN LUMINA (mismo patrón de la clase)
-- -----------------------------------------------------

DROP VIEW IF EXISTS v_usuario_rol;
CREATE VIEW v_usuario_rol AS
SELECT
  CONCAT(u.nombres, ' ', u.apellidos) AS usuario,
  r.nombre AS rol
FROM Usuario u
LEFT JOIN UsuarioRol ur ON ur.usuario_id = u.id
LEFT JOIN Rol r ON r.id = ur.rol_id;

DROP VIEW IF EXISTS v_estudiante_actividad;
CREATE VIEW v_estudiante_actividad AS
SELECT
  CONCAT(u.nombres, ' ', u.apellidos) AS estudiante,
  ap.id AS actividad_id,
  c.titulo AS caso,
  ea.estado AS estado_autorizacion
FROM Usuario u
LEFT JOIN EstudianteAutorizado ea ON ea.estudiante_id = u.id
LEFT JOIN ActividadProgramada ap ON ap.id = ea.actividad_id
LEFT JOIN Caso c ON c.id = ap.caso_id;

DROP TRIGGER IF EXISTS tg_sesion_intento_inicial;
DROP TRIGGER IF EXISTS tg_actividad_intentos_inicial;
DROP TRIGGER IF EXISTS tg_notificacion_estado_inicial;

DELIMITER $$

-- Si la sesión se inserta sin numeroIntento (NULL), queda en 1
CREATE TRIGGER tg_sesion_intento_inicial
BEFORE INSERT ON SesionSimulacion
FOR EACH ROW
BEGIN
  IF NEW.numeroIntento IS NULL THEN
    SET NEW.numeroIntento = 1;
  END IF;
END$$

-- Si la actividad se inserta sin intentosPermitidos (NULL), queda en 1
CREATE TRIGGER tg_actividad_intentos_inicial
BEFORE INSERT ON ActividadProgramada
FOR EACH ROW
BEGIN
  IF NEW.intentosPermitidos IS NULL THEN
    SET NEW.intentosPermitidos = 1;
  END IF;
END$$

-- Si la notificación se inserta sin estado (NULL), queda Pendiente
CREATE TRIGGER tg_notificacion_estado_inicial
BEFORE INSERT ON Notificacion
FOR EACH ROW
BEGIN
  IF NEW.estado IS NULL THEN
    SET NEW.estado = 'Pendiente';
  END IF;
END$$

DELIMITER ;
