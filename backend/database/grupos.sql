-- Grupos académicos (docente crea grupos y asigna estudiantes)
CREATE TABLE IF NOT EXISTS GrupoAcademico (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  codigo VARCHAR(50) NULL UNIQUE,
  docente_id INT NOT NULL,
  descripcion TEXT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fechaCreacion DATETIME NOT NULL,
  CONSTRAINT fk_grupo_docente FOREIGN KEY (docente_id) REFERENCES Usuario(id)
);

CREATE TABLE IF NOT EXISTS GrupoEstudiante (
  grupo_id INT NOT NULL,
  estudiante_id INT NOT NULL,
  fechaAsignacion DATETIME NOT NULL,
  PRIMARY KEY (grupo_id, estudiante_id),
  CONSTRAINT fk_ge_grupo FOREIGN KEY (grupo_id) REFERENCES GrupoAcademico(id) ON DELETE CASCADE,
  CONSTRAINT fk_ge_estudiante FOREIGN KEY (estudiante_id) REFERENCES Usuario(id) ON DELETE CASCADE
);
