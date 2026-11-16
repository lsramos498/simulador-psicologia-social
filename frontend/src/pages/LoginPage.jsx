import { useState } from 'react';
import { ingresarDocente, guardarSesion } from '../api/client';

export default function LoginPage({ onSesion }) {
  const [correo, setCorreo] = useState('admin@unihumboldt.edu.co');
  const [contrasena, setContrasena] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    setCargando(true);
    try {
      const resultado = await ingresarDocente({ correo, contrasena });
      const token = resultado.token || resultado.data?.token;
      const usuario = resultado.usuario || resultado.data?.usuario || {
        id: resultado.id,
        nombres: resultado.nombres,
        roles: resultado.roles,
        permisos: resultado.permisos
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
          Taller docente para construir, validar y publicar casos situacionales.
        </p>
      </section>

      <form className="login-card panel rise" onSubmit={enviar} style={{ animationDelay: '120ms' }}>
        <h2>Ingreso docente</h2>
        <p className="muted">Usa tu correo institucional y contraseña del backend.</p>

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

        {error ? <div className="alert">{error}</div> : null}

        <button className="btn btn-primary" type="submit" disabled={cargando}>
          {cargando ? 'Ingresando…' : 'Entrar al taller'}
        </button>
      </form>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 2rem;
          align-items: center;
          padding: clamp(1.5rem, 5vw, 4rem);
        }
        .login-hero {
          color: var(--paper);
          max-width: 34rem;
        }
        .login-kicker {
          text-transform: uppercase;
          letter-spacing: 0.18em;
          font-size: 0.78rem;
          opacity: 0.72;
          margin: 0 0 1rem;
        }
        .login-hero h1 {
          font-size: clamp(3.4rem, 8vw, 6.4rem);
          line-height: 0.92;
          margin: 0 0 1rem;
        }
        .login-lead {
          font-size: 1.15rem;
          max-width: 28rem;
          opacity: 0.86;
        }
        .login-card {
          padding: 2rem;
          display: grid;
          gap: 1rem;
          color: var(--ink);
        }
        .login-card h2 {
          font-family: "Fraunces", Georgia, serif;
          margin: 0;
          font-size: 1.8rem;
        }
        @media (max-width: 860px) {
          .login-page {
            grid-template-columns: 1fr;
            align-content: start;
          }
        }
      `}</style>
    </main>
  );
}
