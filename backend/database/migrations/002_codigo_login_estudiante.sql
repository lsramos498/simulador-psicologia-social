-- Códigos OTP de inicio de sesión del estudiante (distintos del código de convocatoria).
USE proyecto_nuclear;

CREATE TABLE IF NOT EXISTS CodigoLoginEstudiante (
  id INT NOT NULL AUTO_INCREMENT,
  usuario_id INT NOT NULL,
  codigoHash VARCHAR(64) NOT NULL,
  expiraEn DATETIME NOT NULL,
  usado BOOLEAN NOT NULL DEFAULT FALSE,
  fechaCreacion DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_codigo_login_hash (codigoHash),
  KEY idx_codigo_login_usuario (usuario_id),
  CONSTRAINT fk_codigo_login_usuario
    FOREIGN KEY (usuario_id) REFERENCES Usuario (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
