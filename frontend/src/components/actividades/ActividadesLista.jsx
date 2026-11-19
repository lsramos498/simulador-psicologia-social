export default function ActividadesLista({
  actividades,
  estudiantes = [],
  trabajando,
  estudianteExtra,
  setEstudianteExtra,
  estudianteRetiro,
  setEstudianteRetiro,
  onIniciar,
  onCerrar,
  onVerDetalle,
  onVerNotificaciones,
  onAgregarExtra,
  onRetirar
}) {
  const roster = estudiantes || [];

  return (
    <div className="panel-editor">
      <h3>Mis actividades</h3>
      {(actividades || []).length === 0 ? (
        <div className="empty-state soft">
          <strong>Aún no hay actividades</strong>
          <p className="muted-light">Creá una arriba para generar códigos y notificar.</p>
        </div>
      ) : (
        <div className="arbol-escenas">
          {actividades.map((a) => (
            <article key={a.id} className="nodo-escena">
              <header>
                <strong>
                  #{a.id} · {a.estado}
                </strong>
                <p className="muted-light">
                  Caso {a.casoId} · Rúbrica {a.rubricaId || '—'} · {a.fechaInicio} → {a.fechaFin}
                </p>
              </header>
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
                    {roster.length > 0 ? (
                      <select
                        value={estudianteExtra}
                        onChange={(e) => setEstudianteExtra(e.target.value)}
                        style={{ minWidth: '12rem' }}
                      >
                        <option value="">Convocar…</option>
                        {roster.map((est) => (
                          <option key={est.id} value={est.id}>
                            #{est.id} {est.nombres || ''} {est.apellidos || ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={estudianteExtra}
                        onChange={(e) => setEstudianteExtra(e.target.value)}
                        placeholder="ID a convocar"
                        style={{ maxWidth: '8rem' }}
                      />
                    )}
                    <button
                      type="button"
                      className="btn-play"
                      disabled={trabajando}
                      onClick={() => onAgregarExtra(a.id)}
                    >
                      Notificar
                    </button>
                    {roster.length > 0 ? (
                      <select
                        value={estudianteRetiro}
                        onChange={(e) => setEstudianteRetiro(e.target.value)}
                        style={{ minWidth: '12rem' }}
                      >
                        <option value="">Retirar…</option>
                        {roster.map((est) => (
                          <option key={`r-${est.id}`} value={est.id}>
                            #{est.id} {est.nombres || ''} {est.apellidos || ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={estudianteRetiro}
                        onChange={(e) => setEstudianteRetiro(e.target.value)}
                        placeholder="ID a retirar"
                        style={{ maxWidth: '8rem' }}
                      />
                    )}
                    <button
                      type="button"
                      className="btn-ghost-dark"
                      disabled={trabajando}
                      onClick={() => onRetirar(a.id)}
                    >
                      Retirar
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
