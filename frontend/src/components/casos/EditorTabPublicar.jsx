export default function EditorTabPublicar({
  caso,
  checklist,
  trabajando,
  onPublicar,
  onVistaPrevia,
  onVolver
}) {
  const listo = checklist.every((i) => i.ok);

  return (
    <div className="panel-editor">
      <h3>Antes de publicar</h3>
      <ul className="checklist-lista">
        {checklist.map((item) => (
          <li key={item.texto} className={item.ok ? 'ok' : 'pendiente'}>
            <span>{item.ok ? '✓' : '○'}</span> {item.texto}
          </li>
        ))}
      </ul>
      {!listo ? (
        <p className="muted-light">Completa los puntos pendientes para poder publicar.</p>
      ) : (
        <p className="muted-light">La historia cumple lo mínimo. Ya puedes publicarla.</p>
      )}
      <div className="ficha-acciones">
        <button className="btn-play" type="button" disabled={trabajando || !listo} onClick={onPublicar}>
          <span className="play-tri" aria-hidden="true" />
          Publicar historia
        </button>
        {(caso.escenas || []).length > 0 ? (
          <button type="button" className="btn-ghost-dark" onClick={() => onVistaPrevia?.(caso)}>
            Vista previa
          </button>
        ) : null}
        <button className="btn-ghost-dark" type="button" onClick={onVolver}>
          Ver historia
        </button>
      </div>
    </div>
  );
}
