import { useState } from 'react';
import {
  guardarSesion,
  ingresarDocente,
  ingresarEstudiante
} from '../api/client';

export default function LoginPage({ onSesion }) {
  const [fase, setFase] = useState('portada'); // portada | docente | estudiante
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [codigo, setCodigo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  function abrirDocente() {
    setFase('docente');
    setError('');
    setCorreo('admin@unihumboldt.edu.co');
    setContrasena('');
    setCodigo('');
  }

  function abrirEstudiante() {
    setFase('estudiante');
    setError('');
    setCorreo('estudiante.flujo@unihumboldt.edu.co');
    setContrasena('');
    setCodigo('');
  }

  function volverPortada() {
    setFase('portada');
    setError('');
    setCargando(false);
  }

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    setCargando(true);
    try {
      let resultado;
      if (fase === 'estudiante') {
        resultado = await ingresarEstudiante({ correo, codigo });
      } else {
        resultado = await ingresarDocente({ correo, contrasena });
      }

      const token = resultado.token || resultado.data?.token;
      const usuario = resultado.usuario || resultado.data?.usuario || {
        id: resultado.id,
        nombres: resultado.nombres,
        roles: resultado.roles,
        permisos: resultado.permisos,
        actividadId: resultado.actividadId
      };
      if (!token) {
        throw new Error('El servidor no devolvió un token.');
      }
      guardarSesion({ token, usuario });
      onSesion({ token, usuario });
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="login-splash">
      <div className="login-splash-bg" aria-hidden="true" />
      <div className="login-splash-vignette" aria-hidden="true" />

      <div className="login-splash-center">
        <div className="login-emblem" aria-hidden="true">
          <div className="login-lupa">
            <div className="login-lupa-cristal">
              <span
                className="login-lupa-face a"
                style={{ backgroundImage: "url('/personajes/elena.jpg')" }}
              />
              <span
                className="login-lupa-face b"
                style={{ backgroundImage: "url('/personajes/bruno.jpg')" }}
              />
            </div>
            <span className="login-lupa-aro" />
            <span className="login-lupa-mango" />
          </div>
        </div>

        <p className="login-splash-kicker">Simulador de psicología social</p>
        <h1 className="login-title-3d">LUMINA</h1>

        {fase === 'portada' ? (
          <div className="login-cta-stack">
            <button type="button" className="login-btn-game green" onClick={abrirEstudiante}>
              Jugar
            </button>
            <button type="button" className="login-btn-game blue" onClick={abrirDocente}>
              <span className="login-btn-user" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <circle cx="12" cy="8" r="4" fill="currentColor" />
                  <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" fill="currentColor" />
                </svg>
              </span>
              Iniciar sesión
            </button>
          </div>
        ) : (
          <form className="login-splash-form" onSubmit={enviar}>
            <button type="button" className="login-back" onClick={volverPortada}>
              ← Volver
            </button>
            <h2>{fase === 'estudiante' ? 'Entrar a jugar' : 'Iniciar sesión'}</h2>
            <p className="login-form-lead">
              {fase === 'estudiante'
                ? 'Correo institucional y código de tu convocatoria.'
                : 'Docentes y administradores: correo y contraseña.'}
            </p>

            <div className="field">
              <label htmlFor="correo">Correo</label>
              <input
                id="correo"
                type="email"
                autoComplete="username"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
              />
            </div>

            {fase === 'docente' ? (
              <div className="field">
                <label htmlFor="contrasena">Contraseña</label>
                <input
                  id="contrasena"
                  type="password"
                  autoComplete="current-password"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="codigo">Código de convocatoria</label>
                <input
                  id="codigo"
                  type="text"
                  autoComplete="one-time-code"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  placeholder="Ej. ABCD2345"
                  required
                />
              </div>
            )}

            {error ? <div className="alert">{error}</div> : null}

            <button
              className={fase === 'estudiante' ? 'login-btn-game green' : 'login-btn-game blue'}
              type="submit"
              disabled={cargando}
            >
              {cargando
                ? 'Ingresando…'
                : fase === 'estudiante'
                  ? 'Jugar ahora'
                  : 'Entrar'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
