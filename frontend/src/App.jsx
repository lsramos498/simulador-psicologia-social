import { useState } from 'react';
import { limpiarSesion, leerSesion } from './api/client';
import LoginPage from './pages/LoginPage';
import CasosPage from './pages/CasosPage';

export default function App() {
  const [sesion, setSesion] = useState(() => leerSesion());

  function cerrarSesion() {
    limpiarSesion();
    setSesion(null);
  }

  if (!sesion) {
    return (
      <div className="app-shell">
        <LoginPage onSesion={setSesion} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <CasosPage sesion={sesion} onSalir={cerrarSesion} />
    </div>
  );
}
