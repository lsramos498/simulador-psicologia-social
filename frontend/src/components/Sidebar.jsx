const ITEMS = [
  { id: 'historias', label: 'Historias', icon: 'home' },
  { id: 'banco', label: 'Personajes', icon: 'people' },
  { id: 'crear', label: 'Crear', icon: 'plus' },
  { id: 'actividades', label: 'Actividades', icon: 'calendar' },
  { id: 'biblioteca', label: 'Biblioteca', icon: 'box' }
];

function Icon({ name }) {
  if (name === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" fill="currentColor" />
      </svg>
    );
  }
  if (name === 'people') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm6.5-.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19.5c.6-3 3.2-5 5.5-5s4.9 2 5.5 5M14 14.5c2.1 0 4.4 1.5 5 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'plus') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3v3M17 3v3M4 8h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 12h3v3H8z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7.5h16v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-11Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 7.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export default function Sidebar({ activa, onCambiar, usuario, onSalir }) {
  return (
    <aside className="side-nav">
      <div className="side-brand">
        <span className="brand-mark">Lumina</span>
        <small>Práctica</small>
      </div>

      <nav aria-label="Principal">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={activa === item.id ? 'side-item activo' : 'side-item'}
            onClick={() => onCambiar(item.id)}
          >
            <span className="side-icon">
              <Icon name={item.icon} />
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="side-foot">
        <p className="side-user">
          {[usuario?.nombres, usuario?.apellidos].filter(Boolean).join(' ') ||
            usuario?.correo ||
            'Docente'}
        </p>
        <button type="button" className="side-salir" onClick={onSalir}>
          Salir
        </button>
      </div>
    </aside>
  );
}
