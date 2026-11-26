import { useEffect, useState } from 'react';
import { listarNotificaciones } from '../api/client';
import { esAdministrador } from '../utils/roles';

const ITEMS_BASE = [
  { id: 'historias', label: 'Casos psicológicos', icon: 'home' },
  { id: 'crear', label: 'Crear caso', icon: 'plus' },
  { id: 'estudiantes', label: 'Grupos y estudiantes', icon: 'people' },
  { id: 'actividades', label: 'Actividades', icon: 'calendar' },
  { id: 'seguimiento', label: 'Seguimiento', icon: 'eye' },
  { id: 'avisos', label: 'Avisos', icon: 'bell' }
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
  if (name === 'eye') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      </svg>
    );
  }
  if (name === 'bell') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 19a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (name === 'shield') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 5 6v6c0 5 3.5 8 7 9 3.5-1 7-4 7-9V6l-7-3Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7.5h16v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-11Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export default function Sidebar({ activa, onCambiar, usuario, onSalir, token }) {
  const admin = esAdministrador(usuario);
  const items = admin
    ? [{ id: 'admin', label: 'Admin', icon: 'shield' }, ...ITEMS_BASE]
    : ITEMS_BASE;
  const [noLeidas, setNoLeidas] = useState(0);

  useEffect(() => {
    if (!token) return undefined;
    let vivo = true;
    async function cargar() {
      try {
        const res = await listarNotificaciones(token);
        const n = (res.data || []).filter((x) => x.estado !== 'Leida').length;
        if (vivo) setNoLeidas(n);
      } catch {
        if (vivo) setNoLeidas(0);
      }
    }
    cargar();
    const t = setInterval(cargar, 20_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [token, activa]);

  return (
    <aside className="side-nav side-nav-game">
      <div className="side-brand">
        <span
          className="side-mascot sim-fin-bob"
          style={{ backgroundImage: "url('/personajes/game-guia.jpg')" }}
          aria-hidden="true"
        />
        <span className="brand-mark">Lumina</span>
        <small className="side-role-chip">{admin ? 'Admin' : 'Docente'}</small>
      </div>

      <nav aria-label="Principal">
        {items.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            className={activa === item.id ? 'side-item activo' : 'side-item'}
            style={{ '--side-delay': `${idx * 55}ms` }}
            onClick={() => onCambiar(item.id)}
          >
            <span className="side-icon">
              <Icon name={item.icon} />
              {item.id === 'avisos' && noLeidas > 0 ? (
                <span className="side-badge">{noLeidas > 9 ? '9+' : noLeidas}</span>
              ) : null}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="side-foot">
        <p className="side-user">
          {[usuario?.nombres, usuario?.apellidos].filter(Boolean).join(' ') ||
            usuario?.correo ||
            (admin ? 'Admin' : 'Docente')}
        </p>
        <button type="button" className="side-salir" onClick={onSalir}>
          Salir
        </button>
      </div>
    </aside>
  );
}
