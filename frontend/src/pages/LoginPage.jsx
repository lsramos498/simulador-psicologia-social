import { useEffect, useRef, useState } from 'react';
import {
  enviarCodigoEstudiante,
  guardarSesion,
  ingresarDocente,
  ingresarEstudiante
} from '../api/client';

export default function LoginPage({ onSesion }) {
  const [fase, setFase] = useState('portada'); // portada | sesion
  const [modo, setModo] = useState('estudiante'); // estudiante | docente
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [codigoVisible, setCodigoVisible] = useState('');
  const [cargando, setCargando] = useState(false);
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [error, setError] = useState('');
  const correoRef = useRef(null);

  useEffect(() => {
    if (fase === 'sesion') {
      correoRef.current?.focus();
    }
  }, [fase]);

  function abrirSesion() {
    setFase('sesion');
    setModo('estudiante');
    setError('');
    setAviso('');
    setPreviewUrl('');
    setCodigoVisible('');
    setCorreo('');
    setContrasena('');
    setCodigo('');
    setCodigoEnviado(false);
  }

  function volverPortada() {
    setFase('portada');
    setError('');
    setAviso('');
    setPreviewUrl('');
    setCodigoVisible('');
    setCargando(false);
    setEnviandoCodigo(false);
  }

  function cambiarModo(siguiente) {
    setModo(siguiente);
    setError('');
    setAviso('');
    setPreviewUrl('');
    setCodigoVisible('');
    setContrasena('');
    setCodigo('');
    setCodigoEnviado(false);
  }

  async function pedirCodigo() {
    setError('');
    setAviso('');
    setPreviewUrl('');
    setCodigoVisible('');
    if (!correo.trim()) {
      setError('Escribe tu correo institucional.');
      correoRef.current?.focus();
      return;
    }

    setEnviandoCodigo(true);
    try {
      const resultado = await enviarCodigoEstudiante({ correo });
      setCodigoEnviado(true);
      if (resultado.codigo) {
        const recibido = String(resultado.codigo).toUpperCase();
        setCodigoVisible(recibido);
        setCodigo(recibido);
        setAviso(resultado.mensaje || 'Lumina generó tu código. Ya quedó listo para entrar.');
      } else if (resultado.previewUrl) {
        setPreviewUrl(resultado.previewUrl);
        setAviso('Abre el enlace para ver el código del correo de prueba.');
        window.open(resultado.previewUrl, '_blank', 'noopener,noreferrer');
      } else {
        setAviso(
          resultado.mensaje ||
            'Si tu correo está convocado, te enviamos el código. Revisa tu bandeja (y spam).'
        );
      }
    } catch (err) {
      setError(err.message || 'No se pudo enviar el código.');
    } finally {
      setEnviandoCodigo(false);
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
            <button type="button" className="login-btn-game blue" onClick={abrirSesion}>
              <span className="login-btn-user" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <circle cx="12" cy="8" r="4" fill="currentColor" />
                  <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" fill="currentColor" />
                </svg>
              </span>
              Iniciar sesión
            </button>
            <p className="login-hint">
              Estudiante: correo + código · Docente/admin: correo + contraseña
            </p>
          </div>
        ) : (
          <form className="login-splash-form" onSubmit={enviar}>
            <button type="button" className="login-back" onClick={volverPortada} disabled={cargando}>
              ← Volver
            </button>
            <h2>Iniciar sesión</h2>
            <p className="login-form-lead">
              {modo === 'estudiante'
                ? 'Escribe tu correo, envía el código y úsalo para entrar.'
                : 'Docentes y administradores: correo y contraseña.'}
            </p>

            <div className="login-mode-tabs" role="tablist" aria-label="Tipo de cuenta">
              <button
                type="button"
                role="tab"
                aria-selected={modo === 'estudiante'}
                className={modo === 'estudiante' ? 'active' : ''}
                onClick={() => cambiarModo('estudiante')}
                disabled={cargando || enviandoCodigo}
              >
                Estudiante
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={modo === 'docente'}
                className={modo === 'docente' ? 'active' : ''}
                onClick={() => cambiarModo('docente')}
                disabled={cargando || enviandoCodigo}
              >
                Docente / Admin
              </button>
            </div>

            <div className="field">
              <label htmlFor="correo">Correo</label>
              <input
                id="correo"
                ref={correoRef}
                type="email"
                autoComplete="username"
                value={correo}
                onChange={(e) => {
                  setCorreo(e.target.value);
                  setCodigoEnviado(false);
                  setAviso('');
                  setPreviewUrl('');
                  setCodigoVisible('');
                  setCodigo('');
                }}
                placeholder={
                  modo === 'estudiante'
                    ? 'estudiante@unihumboldt.edu.co'
                    : 'docente@unihumboldt.edu.co'
                }
                required
                disabled={cargando || enviandoCodigo}
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
                  placeholder="Tu contraseña"
                  required
                  disabled={cargando}
                />
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="login-btn-game green login-btn-send-code"
                  onClick={pedirCodigo}
                  disabled={cargando || enviandoCodigo || !correo.trim()}
                >
                  {enviandoCodigo ? 'Enviando…' : codigoEnviado ? 'Reenviar código' : '¿No tienes el código? Enviarlo a mi correo'}
                </button>

                <div className="field">
                  <label htmlFor="codigo">Código de la convocatoria (llega a tu correo)</label>
                  <input
                    id="codigo"
                    type="text"
                    autoComplete="one-time-code"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                    placeholder="Ej. ABCD2345"
                    required
                    disabled={cargando}
                  />
                </div>
              </>
            )}

            {aviso ? <div className="login-ok">{aviso}</div> : null}
            {codigoVisible ? (
              <p className="login-codigo-demo">
                Código Lumina: <strong>{codigoVisible}</strong>
              </p>
            ) : null}
            {previewUrl ? (
              <p className="login-preview">
                <a href={previewUrl} target="_blank" rel="noreferrer">
                  Ver código en el correo de prueba →
                </a>
              </p>
            ) : null}
            {error ? <div className="alert">{error}</div> : null}

            <button
              className="login-btn-game blue"
              type="submit"
              disabled={
                cargando ||
                enviandoCodigo ||
                (modo === 'estudiante' && !codigo.trim())
              }
            >
              {cargando ? 'Ingresando…' : 'Entrar'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
