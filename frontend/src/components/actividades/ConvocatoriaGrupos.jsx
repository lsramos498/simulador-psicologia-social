import { useEffect, useMemo, useState } from 'react';
import { obtenerGrupo } from '../../api/client';
import { limpiarNombreVisible } from '../../utils/textoUtf8';

/**
 * Convocatoria por grupos: entra a un grupo y elige uno a uno o "seleccionar todos".
 */
export default function ConvocatoriaGrupos({
  token,
  grupos = [],
  seleccionadosIds = [],
  onChangeSeleccion
}) {
  const [grupoAbiertoId, setGrupoAbiertoId] = useState(null);
  const [miembros, setMiembros] = useState([]);
  const [cargandoGrupo, setCargandoGrupo] = useState(false);
  const [errorGrupo, setErrorGrupo] = useState('');

  const seleccion = useMemo(
    () => new Set((seleccionadosIds || []).map(Number)),
    [seleccionadosIds]
  );

  useEffect(() => {
    if (!grupoAbiertoId || !token) {
      setMiembros([]);
      return undefined;
    }
    let vivo = true;
    (async () => {
      setCargandoGrupo(true);
      setErrorGrupo('');
      try {
        const res = await obtenerGrupo(token, grupoAbiertoId);
        if (!vivo) return;
        setMiembros(res.data?.estudiantes || []);
      } catch (err) {
        if (!vivo) return;
        setMiembros([]);
        setErrorGrupo(err?.message || 'No se pudo abrir el grupo.');
      } finally {
        if (vivo) setCargandoGrupo(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [grupoAbiertoId, token]);

  function setSeleccion(nextSet) {
    onChangeSeleccion?.([...nextSet]);
  }

  function toggleUno(id) {
    const next = new Set(seleccion);
    const n = Number(id);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    setSeleccion(next);
  }

  function seleccionarTodosDelGrupo() {
    const next = new Set(seleccion);
    for (const est of miembros) next.add(Number(est.id));
    setSeleccion(next);
  }

  function quitarTodosDelGrupo() {
    const idsGrupo = new Set(miembros.map((e) => Number(e.id)));
    const next = new Set([...seleccion].filter((id) => !idsGrupo.has(id)));
    setSeleccion(next);
  }

  const idsMiembros = miembros.map((e) => Number(e.id));
  const todosMarcados =
    idsMiembros.length > 0 && idsMiembros.every((id) => seleccion.has(id));
  const algunosMarcados = idsMiembros.some((id) => seleccion.has(id));

  if (!grupos.length) {
    return (
      <div className="convocatoria-grupos">
        <p className="muted-light">
          Primero crea grupos en <strong>Grupos y estudiantes</strong>. Después vuelve aquí y elige
          Grupo A, B, C…
        </p>
      </div>
    );
  }

  return (
    <div className="convocatoria-grupos">
      <p className="convocatoria-hint">
        Elige un grupo, entra y marca estudiantes (o <strong>Seleccionar todos</strong>).
      </p>

      <div className="convocatoria-grupo-chips">
        {grupos.map((g) => {
          const abierto = String(grupoAbiertoId) === String(g.id);
          return (
            <button
              key={g.id}
              type="button"
              className={abierto ? 'convocatoria-grupo-chip activo' : 'convocatoria-grupo-chip'}
              onClick={() => setGrupoAbiertoId(abierto ? null : g.id)}
            >
              <strong>{limpiarNombreVisible(g.nombre)}</strong>
              <span>{g.totalEstudiantes || 0} est.</span>
            </button>
          );
        })}
      </div>

      {grupoAbiertoId ? (
        <div className="convocatoria-panel">
          <div className="convocatoria-panel-top">
            <p className="kicker">Dentro del grupo</p>
            <div className="ficha-acciones">
              <button
                type="button"
                className="btn-play"
                disabled={cargandoGrupo || !miembros.length}
                onClick={seleccionarTodosDelGrupo}
              >
                {todosMarcados ? 'Todos seleccionados' : 'Seleccionar todos'}
              </button>
              <button
                type="button"
                className="btn-ghost-dark"
                disabled={cargandoGrupo || !algunosMarcados}
                onClick={quitarTodosDelGrupo}
              >
                Quitar del grupo
              </button>
              <button
                type="button"
                className="btn-ghost-dark"
                onClick={() => setGrupoAbiertoId(null)}
              >
                Cerrar
              </button>
            </div>
          </div>

          {cargandoGrupo ? <p className="muted-light">Abriendo grupo…</p> : null}
          {errorGrupo ? <p className="alert">{errorGrupo}</p> : null}

          {!cargandoGrupo && miembros.length === 0 ? (
            <p className="muted-light">Este grupo no tiene estudiantes. Agregalos en Grupos y estudiantes.</p>
          ) : null}

          <div className="convocatoria-lista">
            {miembros.map((est) => {
              const id = Number(est.id);
              const marcado = seleccion.has(id);
              return (
                <button
                  key={id}
                  type="button"
                  className={marcado ? 'convocatoria-est marcado' : 'convocatoria-est'}
                  onClick={() => toggleUno(id)}
                >
                  <span className="convocatoria-check" aria-hidden="true">
                    {marcado ? '✓' : ''}
                  </span>
                  <span>
                    <strong>
                      {est.nombres || ''} {est.apellidos || ''}
                    </strong>
                    <em>
                      #{id} - {est.correo || est.correoInstitucional || 'sin correo'}
                    </em>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <p className="convocatoria-total">
        Seleccionados para convocar: <strong>{seleccion.size}</strong>
      </p>
    </div>
  );
}
