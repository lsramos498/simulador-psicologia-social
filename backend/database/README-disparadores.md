# Disparadores (triggers) — Lumina / Proyecto Nuclear

Guía corta para la revisión de Bases de Datos.

## Qué es un disparador

Un **trigger** es código SQL que MySQL ejecuta **automáticamente** cuando ocurre un evento en una tabla (`INSERT`, `UPDATE` o `DELETE`), **antes** (`BEFORE`) o **después** (`AFTER`) del evento.

En Lumina los usamos para:

1. **Integridad de negocio** (rechazar operaciones inválidas con `SIGNAL SQLSTATE '45000'`).
2. **Auditoría** (guardar historial de cambios de estado).
3. **Valores por defecto / normalización** (fechas, correo en minúsculas, intentos, etc.).

## Archivos

| Archivo | Contenido |
|---------|-----------|
| `triggers.sql` | **30 disparadores** del sistema real (casos, sesiones, respuestas, actividades, OTP…) |
| `vistas_y_disparadores_clase.sql` | Ejemplo del profesor (`tg_semestre_inicial`) + equivalentes Lumina |
| `demo_disparadores.sql` | Consultas y pruebas rápidas para mostrar en clase |

## Cómo aplicarlos

```bash
# Desde la carpeta backend (ajusta usuario/clave/BD)
mysql -u root -p proyecto_nuclear < database/triggers.sql
mysql -u root -p proyecto_nuclear < database/vistas_y_disparadores_clase.sql
```

O con npm (si tienes `mysql` en PATH y variables en `.env`):

```bash
npm run db:triggers
```

## Los 5 que más conviene explicar al profesor

### 1. `trg_respuesta_solo_en_curso` (BEFORE INSERT)

Solo se puede registrar una respuesta si la sesión está **En curso**. Si no, lanza error.

**Por qué:** protege RF de participación sin depender solo del backend.

### 2. `trg_caso_publicar_requiere_escena` (BEFORE UPDATE)

No deja pasar un caso a **Publicado** si no tiene al menos una escena.

**Por qué:** regla de publicación en la BD.

### 3. `trg_caso_auditoria_estado` / `trg_sesion_auditoria_estado` / `trg_actividad_auditoria_estado` (AFTER UPDATE)

Cuando cambia el estado, insertan una fila en tablas `AuditoriaCaso`, `AuditoriaSesion` o `AuditoriaActividad`.

**Por qué:** trazabilidad (quién/cuándo cambió el estado queda registrado por el motor).

### 4. `trg_evaluacion_sesion_finalizada` (BEFORE INSERT)

Solo se inserta evaluación si la sesión está **Finalizado**.

### 5. `trg_codigo_login_no_reutilizar` (BEFORE UPDATE)

Un OTP ya marcado como `usado=TRUE` no puede volver a `FALSE`.

**Por qué:** seguridad del login por código.

### Extras recientes (27–30)

- `trg_sesion_defaults_insert` — defaults al crear sesión  
- `trg_actividad_fechas_validas` — `fechaFin > fechaInicio`  
- `trg_caso_no_editar_publicado` — no edita contenido si ya está Publicado/Archivado  
- `trg_escena_orden_positivo` — orden de escena ≥ 1

## Ejemplo estilo clase (profesor)

En `vistas_y_disparadores_clase.sql`:

```sql
CREATE TRIGGER tg_semestre_inicial
BEFORE INSERT ON estudiante
FOR EACH ROW
BEGIN
  IF NEW.semestre IS NULL THEN
    SET NEW.semestre = 1;
  END IF;
END;
```

Equivalente Lumina: `tg_sesion_intento_inicial` (si `numeroIntento` viene NULL → 1).

## Frases útiles para la oral

- “Usamos **BEFORE** para validar o completar datos **antes** de grabar.”
- “Usamos **AFTER** para auditoría, cuando el cambio ya es válido.”
- “Con `SIGNAL SQLSTATE '45000'` abortamos la transacción si se viola una regla.”
- “La lógica crítica también está en el backend; el trigger es una **segunda línea de defensa** en MySQL.”

## Ver que existen

```sql
SHOW TRIGGERS FROM proyecto_nuclear;
-- o
SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_TIMING
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = 'proyecto_nuclear'
ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME;
```
