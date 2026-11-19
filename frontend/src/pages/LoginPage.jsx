import { useState } from 'react';
import {
  guardarSesion,
  ingresarDocente,
  ingresarEstudiante
} from '../api/client';

export default function LoginPage({ onSesion }) {
  const [modo, setModo] = useState('docente'); // docente | estudiante
  const [correo, setCorreo] = useState('admin@unihumboldt.edu.co');
  const [contrasena, setContrasena] = useState('');
  const [codigo, setCodigo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  function cambiarModo(nuevo) {
    setModo(nuevo);
    setError('');
    if (nuevo === 'docente') {
      setCorreo('admin@unihumboldt.edu.co');
      setContrasena('');
      setCodigo('');
    } else {
      setCorreo('estudiante.flujo@unihumboldt.edu.co');
      setContrasena('');
      setCodigo('');
    }
  }

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    setCargando(true);
    try {
      let resultado;
      if (modo === 'estudiante') {
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
    <main className="login-page">
      <section className="login-hero rise">
        <p className="login-kicker">Simulador de psicología social</p>
        <h1 className="brand-mark">Lumina</h1>
        <p className="login-lead">
          {modo === 'docente'
            ? 'Taller docente para construir, publicar casos y convocar actividades.'
            : 'Entrá con el código de tu convocatoria y practicá el caso en vivo.'}
        </p>
      </section>

      <form className="login-card panel rise" onSubmit={enviar} style={{ animationDelay: '120ms' }}>
        <div className="login-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={modo === 'docente' ? 'tab activo' : 'tab'}
            aria-selected={modo === 'docente'}
            onClick={() => cambiarModo('docente')}
          >
            Docente
          </button>
          <button
            type="button"
            role="tab"
            className={modo === 'estudiante' ? 'tab activo' : 'tab'}
            aria-selected={modo === 'estudiante'}
            onClick={() => cambiarModo('estudiante')}
          >
            Estudiante
          </button>
        </div>

        <h2>{modo === 'docente' ? 'Ingreso docente' : 'Ingreso estudiante'}</h2>
        <p className="muted">
          {modo === 'docente'
            ? 'Usa tu correo institucional y contraseña del backend.'
            : 'Correo institucional + código que te envió tu docente.'}
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

        {modo === 'docente' ? (
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

        <button className="btn btn-primary" type="submit" disabled={cargando}>
          {cargando
            ? 'Ingresando…'
            : modo === 'docente'
              ? 'Entrar al taller'
              : 'Entrar a la práctica'}
        </button>
      </form>
    </main>
  );
}
