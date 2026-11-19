import { useEffect, useState } from 'react';
import { limpiarSesion, leerSesion, onSesionExpirada } from './api/client';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import CasosPage from './pages/CasosPage';
import PracticaEstudiantePage from './pages/PracticaEstudiantePage';

function esEstudiante(usuario) {
  const roles = usuario?.roles || [];
  if (roles.some((r) => String(r).toLowerCase() === 'estudiante')) return true;
  return String(usuario?.rol || '').toLowerCase() === 'estudiante';
}

export default function App() {
  const [sesion, setSesion] = useState(() => leerSesion());

  useEffect(() => {
    onSesionExpirada(() => setSesion(null));
    return () => onSesionExpirada(null);
  }, []);

  function cerrarSesion() {
    limpiarSesion();
    setSesion(null);
  }

  let contenido;
  if (!sesion) {
    contenido = <LoginPage onSesion={setSesion} />;
  } else if (esEstudiante(sesion.usuario)) {
    contenido = <PracticaEstudiantePage sesion={sesion} onSalir={cerrarSesion} />;
  } else {
    contenido = <CasosPage sesion={sesion} onSalir={cerrarSesion} />;
  }

  return (
    <div className="app-shell">
      <ErrorBoundary>{contenido}</ErrorBoundary>
    </div>
  );
}
