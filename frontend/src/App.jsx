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
      <section className="crear-caso" style={{ padding: '2rem' }}>
        <h2>Sin acceso al taller</h2>
        <p className="muted-light">Tu usuario no tiene rol Docente ni Administrador.</p>
        <button type="button" className="btn-play" onClick={cerrarSesion}>
          Salir
        </button>
      </section>
    );
  }

  return (
    <div className="app-shell">
      <ErrorBoundary>{contenido}</ErrorBoundary>
    </div>
  );
}
