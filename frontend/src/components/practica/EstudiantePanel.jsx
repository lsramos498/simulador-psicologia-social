import { useEffect, useState } from 'react';
import { listarMisActividades } from '../../api/client';
import GuiaBurbuja from '../GuiaBurbuja';
import GameDecor from '../GameDecor';
import { formatearFecha } from '../../utils/dateFormat';
import { mensajeError } from '../../utils/casoHelpers';
import { limpiarNombreVisible } from '../../utils/textoUtf8';
import { portadaDeCaso } from '../../data/portadas';

function etiquetaEstado(item) {
  const estado = String(item?.estado || '');
  if (item?.estadoSesion === 'Finalizado') return { label: 'Hecha', tono: 'ok', icono: '★' };
  if (item?.estadoSesion === 'En curso') return { label: 'En curso', tono: 'mid', icono: '▶' };
  if (estado === 'Iniciada') return { label: 'Lista', tono: 'ok', icono: '✓' };
  if (estado === 'Programada') return { label: 'Pronto', tono: 'wait', icono: '⏳' };
  if (estado === 'Finalizada') return { label: 'Cerrada', tono: 'wait', icono: '·' };
  return { label: estado || 'Pendiente', tono: 'wait', icono: '·' };
}

/** Título corto y legible para la tarjeta de misión. */
function tituloMision(casoTitulo, id) {
  let t = limpiarNombreVisible(casoTitulo || '');
  const porTitulo = t.match(/Título\s*:\s*([^.\n]+)/i);
  if (porTitulo) t = porTitulo[1].trim();
  t = t
    .replace(/Desarrollo situacional\s*:.*$/i, '')
    .replace(/^Documento de prueba[^.]*\.?\s*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (t.length > 64) {
    const corte = t.slice(0, 64);
    const sp = corte.lastIndexOf(' ');
    t = `${sp > 36 ? corte.slice(0, sp) : corte}…`;
  }
  return t || `Misión #${id}`;
}

function horaCorta(fecha) {
  if (!fecha) return null;
  return formatearFecha(fecha);
}

export default function EstudiantePanel({
  token,
  usuario,
  actividadActivaId,
  cargando,
  soloJugables = false,
  tituloHub,
  textoHub,
  onElegirActividad
}) {
  const [actividades, setActividades] = useState([]);
  const [errorLista, setErrorLista] = useState('');
  const [cargandoLista, setCargandoLista] = useState(true);

  const nombre =
    [usuario?.nombres, usuario?.apellidos].filter(Boolean).join(' ') || 'estudiante';

  useEffect(() => {
    let vivo = true;
    async function cargar() {
      if (!token) {
        setCargandoLista(false);
        return;
      }
      setCargandoLista(true);
      try {
        const resAct = await listarMisActividades(token);
        if (!vivo) return;
        const todas = resAct.data || [];
        setActividades(
          soloJugables
            ? todas.filter(
                (a) =>
                  a.puedeJugar ||
                  a.estado === 'Iniciada' ||
                  a.estadoSesion === 'En curso'
              )
            : todas
        );
        setErrorLista('');
      } catch (err) {
        if (!vivo) return;
        setErrorLista(mensajeError(err) || 'No se pudieron cargar tus misiones.');
      } finally {
        if (vivo) setCargandoLista(false);
      }
    }
    cargar();
    return () => {
      vivo = false;
    };
  }, [token, soloJugables]);

  const titulo = tituloHub || (soloJugables ? 'Listas para jugar' : 'Tus misiones');
  const texto =
    textoHub ||
    (soloJugables
      ? 'Estas misiones ya están abiertas. Elige una y entra.'
      : 'Elige una misión. Si está en Pronto, espera a que tu docente la inicie.');

  return (
    <section className="estudiante-hub">
      <GameDecor variant="ambient" munecos={3} />

      <div className="estudiante-hub-hero">
        <GuiaBurbuja
          tono="mid"
          titulo={`Hola, ${nombre.split(' ')[0]}`}
          texto={texto}
        />
      </div>

      <div className="estudiante-hub-head">
        <h2>{titulo}</h2>
        <p>{actividades.length ? `${actividades.length} en tu tablero` : 'Sin misiones aún'}</p>
      </div>

      {cargandoLista ? <p className="estudiante-hub-estado">Cargando…</p> : null}
      {errorLista ? <p className="alert">{errorLista}</p> : null}

      {!cargandoLista && !actividades.length ? (
        <GameDecor
          variant="empty"
          munecos={2}
          title={soloJugables ? 'Ninguna lista todavía' : 'Todavía no hay misiones'}
          text={
            soloJugables
              ? 'Cuando tu docente inicie una actividad, aparece aquí.'
              : 'Cuando tu docente te convoque, aparecen aquí.'
          }
        />
      ) : (
        <div className="estudiante-misiones">
          {actividades.map((item) => {
            const badge = etiquetaEstado(item);
            const titulo = tituloMision(item.casoTitulo, item.id);
            const puedeJugar = Boolean(item.puedeJugar);
            const finalizada = item.estadoSesion === 'Finalizado';
            const programada = item.soloVistaPrevia || item.estado === 'Programada';
            const seleccionada = Number(actividadActivaId) === Number(item.id);
            const imagen = portadaDeCaso({
              id: item.casoId || item.id,
              titulo
            });
            const inicio = horaCorta(item.fechaInicio);

            let accionLabel = 'Bloqueada';
            let accionClase = 'mision-btn locked';
            let onClick = null;
            if (finalizada) {
              accionLabel = 'Ver resultados';
              accionClase = 'mision-btn';
              onClick = () => onElegirActividad?.(item, 'resultados');
            } else if (puedeJugar) {
              accionLabel = item.estadoSesion === 'En curso' ? 'Continuar' : 'Jugar';
              accionClase = 'mision-btn play';
              onClick = () =>
                onElegirActividad?.(
                  item,
                  item.estadoSesion === 'En curso' ? 'jugar' : 'practica'
                );
            } else if (programada) {
              accionLabel = 'Esperando inicio';
              accionClase = 'mision-btn locked';
            }

            return (
              <article
                key={item.id}
                className={`mision-card tono-${badge.tono}${seleccionada ? ' activa' : ''}`}
              >
                <div
                  className="mision-card-foto"
                  style={{ backgroundImage: `url('${imagen}')` }}
                  aria-hidden="true"
                >
                  <span className={`mision-badge tono-${badge.tono}`}>
                    <span aria-hidden="true">{badge.icono}</span> {badge.label}
                  </span>
                </div>
                <div className="mision-card-body">
                  <h3>{titulo}</h3>
                  <p className="mision-hora">
                    {inicio ? `🕐 ${inicio}` : 'Hora por confirmar'}
                  </p>
                  <button
                    type="button"
                    className={accionClase}
                    disabled={cargando || !onClick}
                    onClick={onClick || undefined}
                  >
                    {accionLabel}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
