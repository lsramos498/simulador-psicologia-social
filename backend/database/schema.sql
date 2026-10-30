-- Modelo relacional Proyecto Nuclear / Lumina
-- Simulador de Psicología Social — MySQL 8.0.16+
-- Origen del modelo: backend/database/schema.dbml (RF-01 a RF-27)
--
-- Crea la base proyecto_nuclear. Ejecutar sobre un servidor MySQL vacío
-- o después de: DROP DATABASE IF EXISTS proyecto_nuclear;
--
--   mysql -u root -p < backend/database/schema.sql

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS proyecto_nuclear
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE proyecto_nuclear;

-- =====================================================
-- 1. USUARIOS, ROLES Y PERMISOS
-- =====================================================

CREATE TABLE Usuario (
  id INT NOT NULL AUTO_INCREMENT,
  nombres VARCHAR(100) NOT NULL,
  apellidos VARCHAR(100) NOT NULL,
  correoInstitucional VARCHAR(150) NOT NULL,
  codigoInstitucional VARCHAR(50) NULL,
  contrasenaHash VARCHAR(255) NOT NULL COMMENT 'Hash seguro; nunca almacenar contraseñas en texto plano.',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fechaCreacion DATETIME NOT NULL,
  fechaActualizacion DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_usuario_correo (correoInstitucional),
  UNIQUE KEY uk_usuario_codigo (codigoInstitucional)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE Rol (
  id INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(30) NOT NULL COMMENT 'Administrador, Docente, Estudiante',
  descripcion VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_rol_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE Permiso (
  id INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(60) NOT NULL COMMENT 'Ejemplo: CREAR_CASOS',
  descripcion VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_permiso_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE UsuarioRol (
  usuario_id INT NOT NULL,
  rol_id INT NOT NULL,
  asignadoPor_id INT NULL,
  fechaAsignacion DATETIME NOT NULL,
  PRIMARY KEY (usuario_id, rol_id),
  CONSTRAINT fk_usuario_rol_usuario
    FOREIGN KEY (usuario_id) REFERENCES Usuario (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_usuario_rol_rol
    FOREIGN KEY (rol_id) REFERENCES Rol (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_usuario_rol_asignado_por
    FOREIGN KEY (asignadoPor_id) REFERENCES Usuario (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE RolPermiso (
  rol_id INT NOT NULL,
  permiso_id INT NOT NULL,
  PRIMARY KEY (rol_id, permiso_id),
  CONSTRAINT fk_rol_permiso_rol
    FOREIGN KEY (rol_id) REFERENCES Rol (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_rol_permiso_permiso
    FOREIGN KEY (permiso_id) REFERENCES Permiso (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. ORGANIZACIÓN ACADÉMICA
-- =====================================================

CREATE TABLE EspacioAcademico (
  id INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(150) NOT NULL,
  codigo VARCHAR(50) NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uk_espacio_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. DISEÑO DEL CASO SITUACIONAL
-- =====================================================

CREATE TABLE Caso (
  id INT NOT NULL AUTO_INCREMENT,
  creador_id INT NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  desarrolloSituacional TEXT NOT NULL,
  contextoHistoria TEXT NOT NULL,
  tiempoEstimadoSegundos INT NOT NULL COMMENT 'Debe ser mayor que cero.',
  estado VARCHAR(20) NOT NULL DEFAULT 'Borrador' COMMENT 'Borrador, Publicado, Archivado',
  fechaCreacion DATETIME NOT NULL,
  fechaActualizacion DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_caso_id_creador (id, creador_id),
  CONSTRAINT fk_caso_creador
    FOREIGN KEY (creador_id) REFERENCES Usuario (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_caso_tiempo CHECK (tiempoEstimadoSegundos > 0),
  CONSTRAINT chk_caso_estado CHECK (estado IN ('Borrador', 'Publicado', 'Archivado'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='descripcion, tematica y condicionesEntorno no se separan salvo que los RF definitivos les den una función distinta.';

CREATE TABLE Escena (
  id INT NOT NULL AUTO_INCREMENT,
  caso_id INT NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  contexto TEXT NOT NULL,
  `orden` INT NOT NULL,
  esFinal BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id),
  UNIQUE KEY uk_escena_caso_orden (caso_id, `orden`),
  UNIQUE KEY uk_escena_caso_id (caso_id, id),
  CONSTRAINT fk_escena_caso
    FOREIGN KEY (caso_id) REFERENCES Caso (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE Decision (
  id INT NOT NULL AUTO_INCREMENT,
  escena_id INT NOT NULL,
  pregunta TEXT NOT NULL,
  `orden` INT NOT NULL,
  ayuda TEXT NULL COMMENT 'Pista opcional; solo se muestra cuando corresponda según las reglas del simulador.',
  PRIMARY KEY (id),
  UNIQUE KEY uk_decision_escena_orden (escena_id, `orden`),
  UNIQUE KEY uk_decision_escena_id (escena_id, id),
  CONSTRAINT fk_decision_escena
    FOREIGN KEY (escena_id) REFERENCES Escena (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE OpcionDecision (
  id INT NOT NULL AUTO_INCREMENT,
  decision_id INT NOT NULL,
  texto TEXT NOT NULL,
  esCorrecta BOOLEAN NOT NULL,
  consecuencia TEXT NULL COMMENT 'Consecuencia narrativa; no sustituye la explicación pedagógica.',
  `orden` INT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_opcion_decision_orden (decision_id, `orden`),
  UNIQUE KEY uk_opcion_decision_id (decision_id, id),
  CONSTRAINT fk_opcion_decision
    FOREIGN KEY (decision_id) REFERENCES Decision (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE Retroalimentacion (
  id INT NOT NULL AUTO_INCREMENT,
  decision_id INT NULL,
  opcion_id INT NULL,
  explicacion TEXT NOT NULL,
  fundamentoTeorico TEXT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_retro_decision
    FOREIGN KEY (decision_id) REFERENCES Decision (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_retro_opcion
    FOREIGN KEY (opcion_id) REFERENCES OpcionDecision (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_retro_un_destino CHECK (
    (decision_id IS NOT NULL AND opcion_id IS NULL)
    OR (decision_id IS NULL AND opcion_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Exactamente uno entre decision_id y opcion_id. Mostrar al finalizar el intento.';

CREATE TABLE Personaje (
  id INT NOT NULL AUTO_INCREMENT,
  caso_id INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  rolSocial VARCHAR(100) NULL,
  perfil TEXT NULL,
  pautasComportamiento TEXT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_personaje_caso
    FOREIGN KEY (caso_id) REFERENCES Caso (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE EscenaPersonaje (
  escena_id INT NOT NULL,
  personaje_id INT NOT NULL,
  PRIMARY KEY (escena_id, personaje_id),
  CONSTRAINT fk_escena_personaje_escena
    FOREIGN KEY (escena_id) REFERENCES Escena (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_escena_personaje_personaje
    FOREIGN KEY (personaje_id) REFERENCES Personaje (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. RÚBRICAS, CRITERIOS Y NIVELES DE DESEMPEÑO
-- =====================================================

CREATE TABLE Rubrica (
  id INT NOT NULL AUTO_INCREMENT,
  caso_id INT NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT NULL,
  version INT NOT NULL DEFAULT 1,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  fechaCreacion DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_rubrica_caso_version (caso_id, version),
  UNIQUE KEY uk_rubrica_id_caso (id, caso_id),
  CONSTRAINT fk_rubrica_caso
    FOREIGN KEY (caso_id) REFERENCES Caso (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_rubrica_version CHECK (version >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE CriterioEvaluacion (
  id INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_criterio_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE RubricaCriterio (
  rubrica_id INT NOT NULL,
  criterio_id INT NOT NULL,
  ponderacion DECIMAL(5,2) NOT NULL COMMENT 'Peso porcentual; validar rango y suma de pesos en backend.',
  puntajeMaximo DECIMAL(8,2) NOT NULL,
  PRIMARY KEY (rubrica_id, criterio_id),
  CONSTRAINT fk_rubrica_criterio_rubrica
    FOREIGN KEY (rubrica_id) REFERENCES Rubrica (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_rubrica_criterio_criterio
    FOREIGN KEY (criterio_id) REFERENCES CriterioEvaluacion (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE NivelDesempeno (
  id INT NOT NULL AUTO_INCREMENT,
  rubrica_id INT NOT NULL,
  criterio_id INT NOT NULL,
  nombre VARCHAR(80) NOT NULL,
  descripcion TEXT NOT NULL,
  puntaje DECIMAL(8,2) NOT NULL,
  `orden` INT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_nivel_orden (rubrica_id, criterio_id, `orden`),
  UNIQUE KEY uk_nivel_id (rubrica_id, criterio_id, id),
  CONSTRAINT fk_nivel_rubrica_criterio
    FOREIGN KEY (rubrica_id, criterio_id) REFERENCES RubricaCriterio (rubrica_id, criterio_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cada nivel pertenece a un criterio dentro de una rúbrica concreta.';

-- =====================================================
-- 5. PROGRAMACIÓN Y CONVOCATORIA
-- =====================================================

CREATE TABLE ActividadProgramada (
  id INT NOT NULL AUTO_INCREMENT,
  caso_id INT NOT NULL,
  espacioAcademico_id INT NOT NULL,
  docente_id INT NOT NULL,
  rubrica_id INT NOT NULL,
  fechaInicio DATETIME NOT NULL,
  fechaFin DATETIME NOT NULL,
  tiempoLimiteSegundos INT NOT NULL,
  lugar VARCHAR(255) NULL COMMENT 'Opcional cuando no aplica un lugar físico.',
  mensajePersonalizado TEXT NULL,
  intentosPermitidos INT NOT NULL DEFAULT 1,
  fechaCreacion DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_actividad_id_caso (id, caso_id),
  UNIQUE KEY uk_actividad_id_rubrica (id, rubrica_id),
  CONSTRAINT fk_actividad_caso
    FOREIGN KEY (caso_id) REFERENCES Caso (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_actividad_espacio
    FOREIGN KEY (espacioAcademico_id) REFERENCES EspacioAcademico (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_actividad_docente
    FOREIGN KEY (docente_id) REFERENCES Usuario (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_actividad_rubrica
    FOREIGN KEY (rubrica_id) REFERENCES Rubrica (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_actividad_rubrica_caso
    FOREIGN KEY (rubrica_id, caso_id) REFERENCES Rubrica (id, caso_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_actividad_fechas CHECK (fechaFin > fechaInicio),
  CONSTRAINT chk_actividad_tiempo CHECK (tiempoLimiteSegundos > 0),
  CONSTRAINT chk_actividad_intentos CHECK (intentosPermitidos >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Caso publicado y tiempoLimiteSegundos <= Caso.tiempoEstimadoSegundos se validan en backend. La FK compuesta exige que la rúbrica sea del mismo caso.';

CREATE TABLE EstudianteAutorizado (
  id INT NOT NULL AUTO_INCREMENT,
  actividad_id INT NOT NULL,
  estudiante_id INT NOT NULL,
  codigoAutorizacion VARCHAR(100) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'Autorizado' COMMENT 'Autorizado, Retirado, Bloqueado',
  fechaAutorizacion DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_estudiante_autorizado_codigo (codigoAutorizacion),
  UNIQUE KEY uk_estudiante_autorizado_par (actividad_id, estudiante_id),
  CONSTRAINT fk_estudiante_autorizado_actividad
    FOREIGN KEY (actividad_id) REFERENCES ActividadProgramada (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_estudiante_autorizado_estudiante
    FOREIGN KEY (estudiante_id) REFERENCES Usuario (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_estudiante_autorizado_estado CHECK (estado IN ('Autorizado', 'Retirado', 'Bloqueado'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE Asistencia (
  id INT NOT NULL AUTO_INCREMENT,
  actividad_id INT NOT NULL,
  estudiante_id INT NOT NULL,
  estado VARCHAR(20) NOT NULL COMMENT 'Convocado, Presente, Ausente, Retirado',
  fechaRegistro DATETIME NOT NULL,
  observaciones TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_asistencia_par (actividad_id, estudiante_id),
  CONSTRAINT fk_asistencia_actividad
    FOREIGN KEY (actividad_id) REFERENCES ActividadProgramada (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_asistencia_estudiante
    FOREIGN KEY (estudiante_id) REFERENCES Usuario (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_asistencia_autorizado
    FOREIGN KEY (actividad_id, estudiante_id) REFERENCES EstudianteAutorizado (actividad_id, estudiante_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_asistencia_estado CHECK (estado IN ('Convocado', 'Presente', 'Ausente', 'Retirado'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='El estudiante registrado debe estar asociado a la convocatoria de esa actividad.';

-- =====================================================
-- 6. SESIONES, RESPUESTAS Y RECORRIDO
-- =====================================================

CREATE TABLE SesionSimulacion (
  id INT NOT NULL AUTO_INCREMENT,
  actividad_id INT NOT NULL,
  estudiante_id INT NOT NULL,
  numeroIntento INT NOT NULL DEFAULT 1,
  estado VARCHAR(20) NOT NULL DEFAULT 'Sin iniciar' COMMENT 'Sin iniciar, En curso, Finalizado',
  inicio DATETIME NULL,
  fin DATETIME NULL,
  segundosConsumidos INT NOT NULL DEFAULT 0,
  motivoCierre VARCHAR(30) NULL COMMENT 'Finalizacion, TiempoAgotado, CierreDocente, CierreAutomatico',
  PRIMARY KEY (id),
  UNIQUE KEY uk_sesion_intento (actividad_id, estudiante_id, numeroIntento),
  UNIQUE KEY uk_sesion_id_actividad (id, actividad_id),
  UNIQUE KEY uk_sesion_id_actividad_estudiante (id, actividad_id, estudiante_id),
  CONSTRAINT fk_sesion_actividad
    FOREIGN KEY (actividad_id) REFERENCES ActividadProgramada (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_sesion_estudiante
    FOREIGN KEY (estudiante_id) REFERENCES Usuario (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_sesion_autorizado
    FOREIGN KEY (actividad_id, estudiante_id) REFERENCES EstudianteAutorizado (actividad_id, estudiante_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_sesion_estado CHECK (estado IN ('Sin iniciar', 'En curso', 'Finalizado')),
  CONSTRAINT chk_sesion_motivo CHECK (
    motivoCierre IS NULL
    OR motivoCierre IN ('Finalizacion', 'TiempoAgotado', 'CierreDocente', 'CierreAutomatico')
  ),
  CONSTRAINT chk_sesion_intento CHECK (numeroIntento >= 1),
  CONSTRAINT chk_sesion_segundos CHECK (segundosConsumidos >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Requiere estudiante autorizado. Límite de intentos, ventana de acceso y cierre automático se validan en backend.';

CREATE TABLE RespuestaEstudiante (
  id INT NOT NULL AUTO_INCREMENT,
  sesion_id INT NOT NULL,
  decision_id INT NOT NULL,
  opcion_id INT NULL,
  fechaRespuesta DATETIME NULL,
  fechaModificacion DATETIME NULL,
  esCorrecta BOOLEAN NULL,
  puntuacionObtenida DECIMAL(8,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_respuesta_sesion_decision (sesion_id, decision_id),
  CONSTRAINT fk_respuesta_sesion
    FOREIGN KEY (sesion_id) REFERENCES SesionSimulacion (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_respuesta_decision
    FOREIGN KEY (decision_id) REFERENCES Decision (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_respuesta_opcion_decision
    FOREIGN KEY (decision_id, opcion_id) REFERENCES OpcionDecision (decision_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Una respuesta por pregunta y sesión. opcion_id queda nula hasta que se responda.';

CREATE TABLE RegistroInteraccion (
  id INT NOT NULL AUTO_INCREMENT,
  sesion_id INT NOT NULL,
  escena_id INT NULL,
  decision_id INT NULL,
  opcion_id INT NULL,
  momento DATETIME NOT NULL,
  duracionSegundos INT NULL,
  tipoEvento VARCHAR(60) NOT NULL,
  detalle TEXT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_registro_sesion
    FOREIGN KEY (sesion_id) REFERENCES SesionSimulacion (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_registro_escena
    FOREIGN KEY (escena_id) REFERENCES Escena (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_registro_decision
    FOREIGN KEY (decision_id) REFERENCES Decision (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_registro_opcion
    FOREIGN KEY (opcion_id) REFERENCES OpcionDecision (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Historial técnico del recorrido, respuestas y tiempos de la sesión.';

-- =====================================================
-- 7. EVALUACIÓN Y RESULTADOS
-- =====================================================

CREATE TABLE Evaluacion (
  id INT NOT NULL AUTO_INCREMENT,
  sesion_id INT NOT NULL,
  actividad_id INT NOT NULL,
  rubrica_id INT NOT NULL,
  evaluador_id INT NULL,
  fechaEvaluacion DATETIME NOT NULL,
  resultado DECIMAL(8,2) NOT NULL DEFAULT 0,
  retroalimentacionGeneral TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_evaluacion_sesion (sesion_id),
  UNIQUE KEY uk_evaluacion_id_rubrica (id, rubrica_id),
  CONSTRAINT fk_evaluacion_sesion
    FOREIGN KEY (sesion_id) REFERENCES SesionSimulacion (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_evaluacion_rubrica
    FOREIGN KEY (rubrica_id) REFERENCES Rubrica (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_evaluacion_evaluador
    FOREIGN KEY (evaluador_id) REFERENCES Usuario (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_evaluacion_sesion_actividad
    FOREIGN KEY (sesion_id, actividad_id) REFERENCES SesionSimulacion (id, actividad_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_evaluacion_actividad_rubrica
    FOREIGN KEY (actividad_id, rubrica_id) REFERENCES ActividadProgramada (id, rubrica_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Resultado del intento con la rúbrica aplicada. No recalcular evaluaciones históricas si la rúbrica cambia.';

CREATE TABLE ResultadoCriterio (
  evaluacion_id INT NOT NULL,
  rubrica_id INT NOT NULL COMMENT 'Garantiza que el criterio pertenezca a la rúbrica usada en la evaluación.',
  criterio_id INT NOT NULL,
  puntuacion DECIMAL(8,2) NOT NULL DEFAULT 0,
  observacion TEXT NULL,
  PRIMARY KEY (evaluacion_id, criterio_id),
  CONSTRAINT fk_resultado_evaluacion
    FOREIGN KEY (evaluacion_id) REFERENCES Evaluacion (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_resultado_evaluacion_rubrica
    FOREIGN KEY (evaluacion_id, rubrica_id) REFERENCES Evaluacion (id, rubrica_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_resultado_rubrica_criterio
    FOREIGN KEY (rubrica_id, criterio_id) REFERENCES RubricaCriterio (rubrica_id, criterio_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 8. AUTORIZACIONES EXTRA Y NOTIFICACIONES
-- =====================================================

CREATE TABLE AutorizacionRepeticion (
  id INT NOT NULL AUTO_INCREMENT,
  actividad_id INT NOT NULL,
  estudiante_id INT NOT NULL,
  autorizadoPor_id INT NOT NULL,
  fechaAutorizacion DATETIME NOT NULL,
  motivo TEXT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'Aprobada' COMMENT 'Aprobada, Rechazada, Consumida',
  consumidaEn DATETIME NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_autorizacion_actividad
    FOREIGN KEY (actividad_id) REFERENCES ActividadProgramada (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_autorizacion_estudiante
    FOREIGN KEY (estudiante_id) REFERENCES Usuario (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_autorizacion_autorizado_por
    FOREIGN KEY (autorizadoPor_id) REFERENCES Usuario (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_autorizacion_estado CHECK (estado IN ('Aprobada', 'Rechazada', 'Consumida'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Quien autoriza debe ser el docente creador del caso. La repetición excepcional no es reutilizable. Validar en backend.';

CREATE TABLE Notificacion (
  id INT NOT NULL AUTO_INCREMENT,
  usuario_id INT NOT NULL,
  actividad_id INT NULL,
  sesion_id INT NULL,
  tipo VARCHAR(40) NOT NULL COMMENT 'Convocatoria, CambioConvocatoria, Calificacion, Retroalimentacion',
  canal VARCHAR(15) NOT NULL COMMENT 'Correo, Sistema',
  asunto VARCHAR(255) NULL,
  mensaje TEXT NOT NULL,
  url VARCHAR(500) NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente' COMMENT 'Pendiente, Enviada, Leida, Fallida',
  fechaCreacion DATETIME NOT NULL,
  fechaEnvio DATETIME NULL,
  fechaLectura DATETIME NULL,
  errorEnvio TEXT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_notificacion_usuario
    FOREIGN KEY (usuario_id) REFERENCES Usuario (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_notificacion_actividad
    FOREIGN KEY (actividad_id) REFERENCES ActividadProgramada (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_notificacion_sesion
    FOREIGN KEY (sesion_id) REFERENCES SesionSimulacion (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_notificacion_tipo CHECK (tipo IN ('Convocatoria', 'CambioConvocatoria', 'Calificacion', 'Retroalimentacion')),
  CONSTRAINT chk_notificacion_canal CHECK (canal IN ('Correo', 'Sistema')),
  CONSTRAINT chk_notificacion_estado CHECK (estado IN ('Pendiente', 'Enviada', 'Leida', 'Fallida'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- REGLAS DE NEGOCIO QUE DEBEN VALIDARSE EN BACKEND
-- =====================================================
-- 1. Usuario: los estudiantes deben autenticarse con correo institucional y código de autorización válido.
-- 2. Roles/permisos: solo usuarios con permiso pueden crear casos; restringir funciones por rol.
-- 3. Caso: titulo, desarrolloSituacional y contextoHistoria no vacíos; tiempo estimado > 0.
-- 4. Publicación: el caso debe tener al menos una escena, al menos una pregunta en alguna escena,
--    cada pregunta debe tener al menos dos opciones y el caso debe tener una rúbrica antes de publicarse.
-- 5. Cada opción de una pregunta debe tener una explicación/retroalimentación según las reglas funcionales.
-- 6. Retroalimentacion: exactamente uno entre decision_id y opcion_id debe ser no nulo.
-- 7. Personajes asociados a una escena deben pertenecer al mismo caso de esa escena.
-- 8. ActividadProgramada: caso publicado; rúbrica del mismo caso; fechaFin > fechaInicio;
--    tiempoLimiteSegundos > 0 y no mayor a Caso.tiempoEstimadoSegundos.
-- 9. Acceso: código de autorización válido, estudiante convocado, dentro de ventana permitida y sesión no finalizada.
-- 10. Estados de sesión: Sin iniciar -> En curso -> Finalizado. Automatizar el cierre cuando corresponda,
--     incluido el cierre un día después del fin previsto, según RF-19.
-- 11. RF-22: bloquear ingreso tardío aplicando el umbral acordado con el responsable académico.
-- 12. Intentos: por defecto uno; permitir repetición excepcional solo con autorización del docente creador.
-- 13. Respuesta: la opción seleccionada debe pertenecer a la pregunta respondida; guardar por separado cada intento.
-- 14. Evaluación: al finalizar, calcular nota con la rúbrica asociada; guardar resultados por criterio.
--     Los intentos incompletos reciben nota parcial según rúbrica; la ausencia recibe cero por pregunta.
-- 15. ResultadoCriterio almacena rubrica_id y tiene claves foráneas compuestas para garantizar que
--     el criterio forme parte de la rúbrica aplicada a esa evaluación.
-- 16. Mostrar retroalimentación por pregunta y general solo al finalizar, según permisos y RF-14/RF-26.
-- 17. Notificar convocatorias, cambios de convocatoria, calificaciones y nuevas retroalimentaciones.
-- 18. La suma de ponderaciones de RubricaCriterio debe cumplir la escala acordada; puntajes dentro de rango.
-- 19. Aplicar restricciones de acceso, validación de entradas, transacciones y protección de datos en backend.
