export default function PracticaInicio({
  actividadId,
  caso,
  mensaje,
  error,
  cargando,
  notificaciones,
  onActualizar,
  onSalir,
  onEmpezar,
  onMarcarLeida
}) {
  return (
    <section className="crear-caso">
      <header className="crear-head">
        <div>
          <p className="kicker">Estudiante</p>
          <h2>Tu práctica</h2>
          <p className="muted-light">
            Actividad #{actividadId || '—'} · {caso?.titulo || 'Caso pendiente'}
          </p>
        </div>
        <div className="ficha-acciones">
          <button type="button" className="btn-ghost-dark" onClick={onActualizar} disabled={cargando}>
            Actualizar
          </button>
          <button type="button" className="btn-ghost-dark" onClick={onSalir}>
            Salir
          </button>
        </div>
      </header>
      {mensaje ? <div className="alert alert-ok">{mensaje}</div> : null}
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
        <p className="muted-light">Cuando tu docente te convoque, verás aquí el aviso con el código.</p>
      )}

      <div className="panel-editor">
        <p>
          Cuando el docente inicie la actividad, podrás entrar a la escena, preguntar y registrar tus
          respuestas. Al terminar verás la evaluación según la rúbrica del caso.
        </p>
        <button
          type="button"
          className="btn-play"
          disabled={cargando || !actividadId}
          onClick={onEmpezar}
        >
          {cargando ? 'Abriendo…' : 'Empezar / continuar sesión'}
        </button>
      </div>
    </section>
  );
}
