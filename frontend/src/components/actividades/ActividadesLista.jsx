import { formatearFecha } from '../../utils/dateFormat';
import { portadaDeCaso } from '../../data/portadas';
import GameDecor from '../GameDecor';

export default function ActividadesLista({
  actividades,
  estudiantes = [],
  trabajando,
  extraPorActividad = {},
  setExtraPorActividad,
  retiroPorActividad = {},
  setRetiroPorActividad,
  onIniciar,
  onCerrar,
  onVerDetalle,
  onVerNotificaciones,
  onAgregarExtra,
  onRetirar
}) {
  const roster = estudiantes || [];

  function setExtra(actividadId, valor) {
    setExtraPorActividad?.((prev) => ({ ...prev, [actividadId]: valor }));
  }

  function setRetiro(actividadId, valor) {
    setRetiroPorActividad?.((prev) => ({ ...prev, [actividadId]: valor }));
  }

  return (
    <div className="panel-editor">
      <h3>Actividades programadas</h3>
      <p className="muted-light">Si está Programada, toca Iniciar y listo.</p>
      {(actividades || []).length === 0 ? (
        <GameDecor
          variant="empty"
          title="Aún no hay actividades"
          text="Crea una arriba para generar códigos y notificar. ¡Tu partida empieza aquí!"
        />
      ) : (
        <div className="actividades-grid">
          {actividades.map((a) => {
            const titulo = a.casoTitulo || `Caso #${a.casoId}`;
            const imagen = portadaDeCaso({ id: a.casoId, titulo });
            const autorizados = (a.estudiantesAutorizados || []).filter(
              (e) => String(e.estado).toLowerCase() !== 'retirado'
            );
            const extraVal = extraPorActividad[a.id] ?? '';
            const retiroVal = retiroPorActividad[a.id] ?? '';
            const yaConvocados = new Set(autorizados.map((e) => Number(e.estudianteId)));
            const paraConvocar = roster.filter((est) => !yaConvocados.has(Number(est.id)));

            return (
              <article key={a.id} className="actividad-card">
                <div
                  className="actividad-card-foto"
                  style={{ backgroundImage: `url('${imagen}')` }}
                  aria-hidden="true"
                />
                <div className="actividad-card-body">
                  <p className="actividad-card-estado">{a.estado}</p>
                  <h3 className="actividad-card-titulo">{titulo}</h3>
                  <p className="actividad-card-meta">
                    <span>
                      <strong>Inicio:</strong> {formatearFecha(a.fechaInicio)}
                    </span>
                    <span>
                      <strong>Fin:</strong> {formatearFecha(a.fechaFin)}
                    </span>
                    <span className="muted-light">
                      Actividad #{a.id}
                      {a.espacioAcademicoNombre ? ` - ${a.espacioAcademicoNombre}` : ''}
                    </span>
                  </p>

                  <div className="ficha-acciones">
                    {a.estado === 'Programada' ? (
                      <button
                        type="button"
                        className="btn-play"
                        disabled={trabajando}
                        onClick={() => onIniciar(a.id)}
                      >
                        Iniciar
                      </button>
                    ) : null}
                    {a.estado === 'Iniciada' ? (
                      <button
                        type="button"
                        className="btn-ghost-dark"
                        disabled={trabajando}
                        onClick={() => onCerrar(a.id)}
                      >
                        Cerrar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn-ghost-dark"
                      disabled={trabajando}
                      onClick={() => onVerDetalle?.(a.id)}
                    >
                      Ver detalle
                    </button>
                    <button
                      type="button"
                      className="btn-ghost-dark"
                      disabled={trabajando}
                      onClick={() => onVerNotificaciones(a.id)}
                    >
                      Ver notificaciones
                    </button>
                  </div>

                  {a.estado !== 'Cerrada' ? (
                    <div className="field" style={{ marginTop: '0.75rem' }}>
                      <label>Convocar / retirar estudiante</label>
                      <div className="ficha-acciones" style={{ flexWrap: 'wrap' }}>
                        {paraConvocar.length > 0 ? (
                          <select
                            value={extraVal}
                            onChange={(e) => setExtra(a.id, e.target.value)}
                            style={{ minWidth: '12rem' }}
                          >
                            <option value="">Convocar…</option>
                            {paraConvocar.map((est) => (
                              <option key={est.id} value={est.id}>
                                #{est.id} {est.nombres || ''} {est.apellidos || ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={extraVal}
                            onChange={(e) => setExtra(a.id, e.target.value)}
                            placeholder="ID a convocar"
                            style={{ maxWidth: '8rem' }}
                          />
                        )}
                        <button
                          type="button"
                          className="btn-play"
                          disabled={trabajando}
                          onClick={() => onAgregarExtra(a.id, extraVal)}
                        >
                          Notificar
                        </button>
                        {autorizados.length > 0 ? (
                          <select
                            value={retiroVal}
                            onChange={(e) => setRetiro(a.id, e.target.value)}
                            style={{ minWidth: '12rem' }}
                          >
                            <option value="">Retirar…</option>
                            {autorizados.map((est) => (
                              <option
                                key={`r-${est.estudianteId || est.id}`}
                                value={est.estudianteId || est.id}
                              >
                                #{est.estudianteId || est.id} {est.nombres || ''}{' '}
                                {est.apellidos || ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="muted-light">Sin estudiantes activos para retirar</span>
                        )}
                        <button
                          type="button"
                          className="btn-ghost-dark"
                          disabled={trabajando || !retiroVal}
                          onClick={() => onRetirar(a.id, retiroVal)}
                        >
                          Retirar
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
