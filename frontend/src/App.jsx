import { useEffect, useState } from 'react';
import { limpiarSesion, leerSesion, onSesionExpirada } from './api/client';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import CasosPage from './pages/CasosPage';
import PracticaEstudiantePage from './pages/PracticaEstudiantePage';
import { esEstudiante, puedeUsarTaller } from './utils/roles';

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
  } else if (esEstudiante(sesion.usuario) && !puedeUsarTaller(sesion.usuario)) {
    contenido = <PracticaEstudiantePage sesion={sesion} onSalir={cerrarSesion} />;
  } else if (puedeUsarTaller(sesion.usuario)) {
    contenido = <CasosPage sesion={sesion} onSalir={cerrarSesion} />;
  } else {
    contenido = (
      <main className="login-splash">
        <div className="login-splash-bg" aria-hidden="true" />
        <div className="login-splash-vignette" aria-hidden="true" />
        <div className="login-splash-center">
          <h1 className="login-title-3d" style={{ fontSize: '3rem' }}>
            LUMINA
          </h1>
          <div className="login-splash-form">
            <h2>Sin acceso</h2>
            <p className="login-form-lead">
              Tu usuario no tiene rol Docente ni Administrador para entrar al taller.
            </p>
            <button type="button" className="login-btn-game blue" onClick={cerrarSesion}>
              Volver al inicio
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <ErrorBoundary>{contenido}</ErrorBoundary>
    </div>
  );
}
