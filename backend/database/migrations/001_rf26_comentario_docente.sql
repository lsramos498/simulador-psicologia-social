-- Ejecutar una vez en una base existente, antes de desplegar RF-26.
-- Las evaluaciones existentes conservan sus valores y el comentario queda en NULL.
ALTER TABLE Evaluacion ADD COLUMN comentarioDocente TEXT NULL;
