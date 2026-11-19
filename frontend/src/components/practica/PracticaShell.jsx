export default function PracticaShell({ usuario, onSalir, children }) {
  return (
    <div className="practica-shell">
      <div className="practica-shell-bg" aria-hidden="true" />
      <header className="practica-top">
        <div>
          <span className="brand-mark">Lumina</span>
          <p className="muted-light" style={{ margin: 0 }}>
            {[usuario?.nombres, usuario?.apellidos].filter(Boolean).join(' ') || 'Estudiante'}
          </p>
        </div>
        <button type="button" className="btn-ghost-dark" onClick={onSalir}>
          Salir
        </button>
      </header>
      <div className="practica-shell-body">{children}</div>
    </div>
  );
}
