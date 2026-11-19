export default function ActividadCrearForm({
  form,
  setForm,
  publicados,
  espacios,
  estudiantes,
  casoElegido,
  trabajando,
  onSubmit,
  onCrearEspacio,
  onToggleEstudiante
}) {
  return (
    <form className="crear-form" onSubmit={onSubmit}>
      <div className="crear-grid">
        <div className="field">
          <label>Caso publicado</label>
          <select
            required
            value={form.casoId}
            onChange={(e) => setForm({ ...form, casoId: e.target.value })}
          >
            <option value="">Elige un caso</option>
            {publicados.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.id} · {c.titulo}
                {c.rubricaId ? '' : ' (sin rúbrica)'}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Espacio académico</label>
          <select
            required
            value={form.espacioAcademicoId}
            onChange={(e) => setForm({ ...form, espacioAcademicoId: e.target.value })}
          >
            <option value="">Elige un espacio</option>
            {espacios.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre} {e.codigo ? `(${e.codigo})` : ''}
              </option>
            ))}
          </select>
          {espacios.length === 0 ? (
            <button
              type="button"
              className="btn-ghost-dark"
              style={{ marginTop: '0.5rem' }}
              disabled={trabajando}
              onClick={onCrearEspacio}
            >
              Crear espacio de práctica
            </button>
          ) : null}
        </div>
        <div className="field">
          <label>Rúbrica del caso</label>
          <input
            required
            readOnly
            value={
              form.rubricaId
                ? `#${form.rubricaId}${casoElegido ? ` · ${casoElegido.titulo}` : ''}`
                : ''
            }
            placeholder="Se toma de la rúbrica activa del caso"
          />
          <p className="muted-light">
            Si está vacío, abrí el caso en el editor → pestaña Evaluación → subir JSON/CSV o armar criterios →
            Guardar.
          </p>
        </div>
        <div className="field">
          <label>Tiempo límite (seg)</label>
          <input
            type="number"
            min={1}
            required
            value={form.tiempoLimiteSegundos}
            onChange={(e) => setForm({ ...form, tiempoLimiteSegundos: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Inicio</label>
          <input
            type="datetime-local"
            required
            value={form.fechaInicio}
            onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Fin</label>
          <input
            type="datetime-local"
            required
            value={form.fechaFin}
            onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
          />
        </div>
      </div>

      <div className="field">
        <label>Lugar</label>
        <input value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })} />
      </div>

      <div className="field">
        <label>Mensaje al convocar</label>
        <textarea
          rows={3}
          value={form.mensajePersonalizado}
          onChange={(e) => setForm({ ...form, mensajePersonalizado: e.target.value })}
          placeholder="Texto que recibe el estudiante en la convocatoria"
        />
      </div>

      <div className="field">
        <label>Estudiantes a notificar</label>
        {estudiantes.length > 0 ? (
          <div className="asistente-ejemplos">
            {estudiantes.map((est) => (
              <button
                key={est.id}
                type="button"
                className={
                  form.estudiantesIds.includes(est.id) ? 'chip-ejemplo tab activo' : 'chip-ejemplo'
                }
                onClick={() => onToggleEstudiante(est.id)}
              >
                #{est.id} {est.nombres || ''} {est.apellidos || ''}{' '}
                {est.correo || est.correoInstitucional || ''}
              </button>
            ))}
          </div>
        ) : (
          <input
            placeholder="IDs separados por coma, ej: 4"
            value={form.estudiantesIds.join(',')}
            onChange={(e) =>
              setForm({
                ...form,
                estudiantesIds: e.target.value
                  .split(',')
                  .map((x) => Number(x.trim()))
                  .filter((n) => n > 0)
              })
            }
          />
        )}
        <p className="muted-light">
          Al crear la actividad se genera un código por estudiante y se envía la notificación de convocatoria.
        </p>
        {publicados.length === 0 ? (
          <p className="alert">
            No hay casos publicados con tu usuario. Publicá un caso (con rúbrica) en Historias → editor →
            Publicar.
          </p>
        ) : null}
      </div>

      <button className="btn-play" type="submit" disabled={trabajando || publicados.length === 0}>
        {trabajando ? 'Creando y notificando…' : 'Crear actividad y notificar'}
      </button>
    </form>
  );
}
