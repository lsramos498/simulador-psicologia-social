export default function PracticaInicio({
  actividadId,
  caso,
  mensaje,
  error,
  cargando,
  notificaciones,
  onActualizar,
  onEmpezar,
  onMarcarLeida
}) {
  return (
    <section className="crear-caso practica-panel">
      <header className="crear-head">
        <div>
          <p className="kicker">Estudiante</p>
          <h2>Tu práctica</h2>
          <p className="muted-light">
            Actividad #{actividadId || '—'} · {caso?.titulo || 'Caso pendiente de iniciar'}
          </p>
        </div>
        <button type="button" className="btn-ghost-dark" onClick={onActualizar} disabled={cargando}>
          Actualizar
        </button>
      </header>
      {mensaje ? <div className="alert alert-ok practica-aviso">{mensaje}</div> : null}
      {error ? <div className="alert">{error}</div> : null}
      {cargando ? <p className="muted-light">Consultando tu convocatoria…</p> : null}

      {notificaciones.length > 0 ? (
        <div className="panel-editor">
          <h3>Tus convocatorias y avisos</h3>
          <ul className="asistente-meta">
            {notificaciones.slice(0, 8).map((n) => (
              <li key={n.id}>
                <strong>{n.asunto || n.tipo}</strong>
                <span className="muted-light">
                  {' '}
                  · {n.estado} · {n.canal}
                </span>
                <p style={{ whiteSpace: 'pre-wrap', margin: '0.35rem 0' }}>
                  {(n.mensaje || '').slice(0, 420)}
                  {(n.mensaje || '').length > 420 ? '…' : ''}
                </p>
                {n.estado !== 'Leida' ? (
                  <button type="button" className="btn-ghost-dark" onClick={() => onMarcarLeida(n.id)}>
                    Marcar leída
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="empty-state">
          <strong>Todavía no hay avisos</strong>
          <p className="muted-light">
            Cuando tu docente te convoque, verás aquí el mensaje con el código de acceso.
          </p>
        </div>
      )}

      <div className="panel-editor">
        <p>
          Cuando el docente inicie la actividad, podrás entrar a la escena, preguntar y registrar tus
          respuestas. Al terminar verás la evaluación según la rúbrica del caso.
        </p>
        <button
          type="button"
          className="login-btn-game green"
          style={{ maxWidth: '22rem' }}
          disabled={cargando || !actividadId}
          onClick={onEmpezar}
        >
          {cargando ? 'Abriendo…' : 'Empezar / continuar sesión'}
        </button>
      </div>
    </section>
  );
}
