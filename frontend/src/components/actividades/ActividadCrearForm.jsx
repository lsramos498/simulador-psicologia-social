import { portadaDeCaso } from '../../data/portadas';
import { formatearFecha } from '../../utils/dateFormat';
import ConvocatoriaGrupos from './ConvocatoriaGrupos';

export default function ActividadCrearForm({
  token,
  form,
  setForm,
  publicados,
  espacios,
  grupos = [],
  casoElegido,
  trabajando,
  onSubmit,
  onCrearEspacio,
  mostrarAvanzado = false,
  setMostrarAvanzado
}) {
  const imagenCaso = casoElegido
    ? portadaDeCaso({ id: casoElegido.id, titulo: casoElegido.titulo })
    : null;

  return (
    <form className="crear-form actividad-form-simple" onSubmit={onSubmit}>
      <div className="actividad-pasos">
        <span className="actividad-paso activo">1. Caso</span>
        <span className="actividad-paso activo">2. Grupo</span>
        <span className="actividad-paso">3. Iniciar</span>
      </div>

      {casoElegido ? (
        <div className="actividad-card" style={{ marginBottom: '1rem' }}>
          <div
            className="actividad-card-foto"
            style={{ backgroundImage: `url('${imagenCaso}')` }}
            aria-hidden="true"
          />
          <div className="actividad-card-body">
            <p className="actividad-card-estado">Listo para programar</p>
            <h3 className="actividad-card-titulo">{casoElegido.titulo}</h3>
            <p className="actividad-card-meta">
              <span>
                <strong>Ventana:</strong> {formatearFecha(form.fechaInicio)} →{' '}
                {formatearFecha(form.fechaFin)}
              </span>
            </p>
          </div>
        </div>
      ) : null}

      <div className="crear-grid">
        <div className="field">
          <label>Caso publicado</label>
          <select
            required
            value={form.casoId}
            onChange={(e) => setForm({ ...form, casoId: e.target.value })}
          >
            <option value="">Elige un caso publicado</option>
            {publicados.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.id} - {c.titulo}
                {c.rubricaId ? '' : ' (sin rúbrica)'}
              </option>
            ))}
          </select>
          {publicados.length === 0 ? (
            <p className="alert">
              Todavía no hay casos publicados. En Casos → editor → <strong>Publicar</strong>.
            </p>
          ) : null}
        </div>

        <div className="field">
          <label>Espacio (opcional si ya hay uno)</label>
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
              Crear espacio automático
            </button>
          ) : null}
        </div>
      </div>

      <div className="field">
        <label>Convocar por grupo</label>
        <ConvocatoriaGrupos
          token={token}
          grupos={grupos}
          seleccionadosIds={form.estudiantesIds}
          onChangeSeleccion={(ids) => setForm({ ...form, estudiantesIds: ids })}
        />
      </div>

      <button
        type="button"
        className="btn-ghost-dark"
        onClick={() => setMostrarAvanzado?.(!mostrarAvanzado)}
      >
        {mostrarAvanzado ? 'Ocultar opciones' : 'Más opciones (fechas, tiempo, mensaje)'}
      </button>

      {mostrarAvanzado ? (
        <div className="crear-grid" style={{ marginTop: '0.85rem' }}>
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
            <label>Lugar</label>
            <input value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })} />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Mensaje al convocar</label>
            <textarea
              rows={2}
              value={form.mensajePersonalizado}
              onChange={(e) => setForm({ ...form, mensajePersonalizado: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Rúbrica</label>
            <input
              readOnly
              value={
                form.rubricaId
                  ? `#${form.rubricaId}${casoElegido ? ` - ${casoElegido.titulo}` : ''}`
                  : 'Se toma del caso'
              }
            />
          </div>
        </div>
      ) : null}

      <button className="btn-play" type="submit" disabled={trabajando || publicados.length === 0}>
        {trabajando ? 'Programando…' : 'Programar actividad'}
      </button>
      <p className="muted-light" style={{ marginTop: '0.55rem' }}>
        Después solo toca <strong>Iniciar</strong> en Actividades programadas.
      </p>
    </form>
  );
}
