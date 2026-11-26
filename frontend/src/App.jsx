import { useEffect, useState } from 'react';
import { limpiarSesion, leerSesion, onSesionExpirada } from './api/client';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import CasosPage from './pages/CasosPage';
import PracticaEstudiantePage from './pages/PracticaEstudiantePage';
import { esEstudiante, puedeUsarTaller } from './utils/roles';
import { leerParamsAcceso, limpiarParamsAcceso } from './utils/destinoAcceso';

/** Ingreso con correo+código de convocatoria (token trae actividadId). */
function esSesionPracticaEstudiante(usuario) {
  const actividadId = Number(usuario?.actividadId);
  return Number.isInteger(actividadId) && actividadId > 0;
}

function sesionInicial() {
  const { forzarLoginEstudiante } = leerParamsAcceso();
  const guardada = leerSesion();

  // Enlace del correo: saca al docente, pero NO eches una práctica ya iniciada.
  if (forzarLoginEstudiante) {
    if (esSesionPracticaEstudiante(guardada?.usuario)) {
      limpiarParamsAcceso();
      return guardada;
    }
    limpiarSesion();
    return null;
  }

  return guardada;
}

export default function App() {
  const [sesion, setSesion] = useState(() => sesionInicial());

  useEffect(() => {
    onSesionExpirada(() => setSesion(null));
    return () => onSesionExpirada(null);
  }, []);

  // Enlace del correo con taller docente abierto: forzar login estudiante una vez.
  useEffect(() => {
    function forzarLoginSiCorreo() {
      const { forzarLoginEstudiante } = leerParamsAcceso();
      if (!forzarLoginEstudiante) return;

      const actual = leerSesion();
      if (esSesionPracticaEstudiante(actual?.usuario)) {
        limpiarParamsAcceso();
        return;
      }

      limpiarSesion();
      setSesion(null);
    }
    forzarLoginSiCorreo();
    window.addEventListener('focus', forzarLoginSiCorreo);
    window.addEventListener('pageshow', forzarLoginSiCorreo);
    document.addEventListener('visibilitychange', forzarLoginSiCorreo);
    return () => {
      window.removeEventListener('focus', forzarLoginSiCorreo);
      window.removeEventListener('pageshow', forzarLoginSiCorreo);
      document.removeEventListener('visibilitychange', forzarLoginSiCorreo);
    };
  }, []);

  function cerrarSesion() {
    limpiarSesion();
    limpiarParamsAcceso();
    setSesion(null);
  }

  let contenido;
  if (!sesion) {
    contenido = <LoginPage onSesion={setSesion} />;
  } else if (esSesionPracticaEstudiante(sesion.usuario)) {
    contenido = <PracticaEstudiantePage sesion={sesion} onSalir={cerrarSesion} />;
  } else if (puedeUsarTaller(sesion.usuario)) {
    contenido = <CasosPage sesion={sesion} onSalir={cerrarSesion} />;
  } else if (esEstudiante(sesion.usuario)) {
    contenido = <PracticaEstudiantePage sesion={sesion} onSalir={cerrarSesion} />;
  } else {
    contenido = (
      <main className="login-splash">
        <div className="login-splash-bg" aria-hidden="true" />
        <div className="login-splash-vignette" aria-hidden="true" />
        <div className="login-splash-center">
          <h1 className="login-title-3d login-title-compact">LUMINA</h1>
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
