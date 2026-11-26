import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Antes de montar React: enlace del correo → quitar sesión docente.
// Si ya hay práctica de estudiante en esta pestaña, se conserva.
try {
  const params = new URLSearchParams(window.location.search);
  const hash = String(window.location.hash || '');
  const desdeCorreoEstudiante =
    params.get('acceso') === 'estudiante' ||
    params.get('modo') === 'estudiante' ||
    params.has('ingreso') ||
    params.get('ver') === 'resultado' ||
    hash.includes('estudiante') ||
    hash.includes('resultado');

  localStorage.removeItem('lumina.token');
  localStorage.removeItem('lumina.usuario');

  if (desdeCorreoEstudiante) {
    const crudo = sessionStorage.getItem('lumina.usuario');
    let practicaActiva = false;
    if (crudo) {
      try {
        const u = JSON.parse(crudo);
        const aid = Number(u?.actividadId);
        practicaActiva = Number.isInteger(aid) && aid > 0;
      } catch {
        practicaActiva = false;
      }
    }
    if (!practicaActiva) {
      sessionStorage.removeItem('lumina.token');
      sessionStorage.removeItem('lumina.usuario');
    }
  }
} catch {
  /* ignore */
}

createRoot(document.getElementById('root')).render(<App />)
