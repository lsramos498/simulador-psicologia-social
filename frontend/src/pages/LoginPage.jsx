import { useEffect, useMemo, useRef, useState } from 'react';
import {
  enviarCodigoEstudiante,
  guardarSesion,
  ingresarDocente,
  ingresarEstudiante
} from '../api/client';
import { limpiarParamsAcceso, leerParamsAcceso } from '../utils/destinoAcceso';

function esCorreoInstitucional(valor) {
  const correo = String(valor || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.edu\.co$/i.test(correo);
}

export default function LoginPage({ onSesion }) {
  const accesoInicial = leerParamsAcceso();
  const [fase, setFase] = useState(() =>
    accesoInicial.forzarLoginEstudiante || accesoInicial.accesoEstudiante ? 'sesion' : 'portada'
  );
  const [modo, setModo] = useState('estudiante'); // estudiante | docente
  const [correo, setCorreo] = useState(() => accesoInicial.correo || '');
  const [contrasena, setContrasena] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [error, setError] = useState('');
  const correoRef = useRef(null);

  const correoValidoEstudiante = useMemo(
    () => modo === 'estudiante' && esCorreoInstitucional(correo),
    [modo, correo]
  );

  useEffect(() => {
    if (fase === 'sesion') {
      correoRef.current?.focus();
    }
  }, [fase]);

  function abrirSesion() {
    setFase('sesion');
    setModo('estudiante');
    setError('');
    setContrasena('');
    setCodigo('');
    setCodigoEnviado(false);
  }

  function volverPortada() {
    setFase('portada');
    setError('');
    setCargando(false);
    setEnviandoCodigo(false);
    limpiarParamsAcceso();
  }

  function cambiarModo(siguiente) {
    setModo(siguiente);
    setError('');
    setContrasena('');
    setCodigo('');
    setCodigoEnviado(false);
  }

  async function pedirCodigo() {
    setError('');
    if (!esCorreoInstitucional(correo)) {
      setError('Usa tu correo institucional (.edu.co).');
      correoRef.current?.focus();
      return;
    }

    setEnviandoCodigo(true);
    try {
      await enviarCodigoEstudiante({ correo });
      setCodigoEnviado(true);
      setCodigo('');
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
      limpiarParamsAcceso();
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
                className="login-lupa-face"
                style={{ backgroundImage: "url('/personajes/game-pj-03.jpg')" }}
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
              Estudiante: correo + código de sesión - Docente/admin: correo + contraseña
            </p>
          </div>
        ) : (
          <form className="login-splash-form" onSubmit={enviar} autoComplete="off">
            <button type="button" className="login-back" onClick={volverPortada} disabled={cargando}>
              ← Volver
            </button>
            <h2>Iniciar sesión</h2>

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
              <label htmlFor="correo">Correo institucional</label>
              <input
                id="correo"
                ref={correoRef}
                type="email"
                autoComplete="username"
                value={correo}
                onChange={(e) => {
                  setCorreo(e.target.value);
                  setCodigoEnviado(false);
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
                  className={
                    correoValidoEstudiante
                      ? 'login-btn-send-code listo'
                      : 'login-btn-send-code'
                  }
                  onClick={pedirCodigo}
                  disabled={cargando || enviandoCodigo || !correoValidoEstudiante}
                >
                  {enviandoCodigo
                    ? 'Enviando…'
                    : codigoEnviado
                      ? 'Reenviar código'
                      : 'Enviar código'}
                </button>
                <div className="field">
                  <label htmlFor="codigo">Código de inicio de sesión</label>
                  <input
                    id="codigo"
                    type="text"
                    name="codigo-sesion-lumina"
                    autoComplete="off"
                    inputMode="text"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                    placeholder="Código"
                    required
                    disabled={cargando}
                  />
                </div>
              </>
            )}

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
