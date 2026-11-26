import { formatearFecha } from '../../utils/dateFormat';
import { portadaDeCaso } from '../../data/portadas';
import GuiaBurbuja from '../GuiaBurbuja';
import GameDecor from '../GameDecor';
import { limpiarNombreVisible } from '../../utils/textoUtf8';

function tituloCorto(caso, actividad, actividadId) {
  let t = limpiarNombreVisible(caso?.titulo || actividad?.casoTitulo || '');
  const porTitulo = t.match(/Título\s*:\s*([^.\n]+)/i);
  if (porTitulo) t = porTitulo[1].trim();
  t = t
    .replace(/Desarrollo situacional\s*:.*$/i, '')
    .replace(/^Documento de prueba[^.]*\.?\s*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (t.length > 70) {
    const corte = t.slice(0, 70);
    const sp = corte.lastIndexOf(' ');
    t = `${sp > 40 ? corte.slice(0, sp) : corte}…`;
  }
  return t || (actividadId ? `Misión #${actividadId}` : 'Misión');
}

export default function PracticaInicio({
  actividadId,
  actividad,
  caso,
  error,
  cargando,
  bloqueada = false,
  onEmpezar
}) {
  const titulo = tituloCorto(caso, actividad, actividadId);
  const imagen = portadaDeCaso({
    id: caso?.id || actividad?.casoId,
    titulo
  });
  const inicio = actividad?.fechaInicio ? formatearFecha(actividad.fechaInicio) : null;

  return (
    <section className="estudiante-hub practica-inicio-hub">
      <GameDecor variant="ambient" munecos={2} />
      <GuiaBurbuja
        tono={bloqueada ? 'mid' : 'ok'}
        titulo={bloqueada ? 'Casi listo' : '¡A jugar!'}
        texto={
          bloqueada
            ? 'Tu docente aún no inicia esta misión.'
            : 'Todo listo. Toca el botón verde para empezar.'
        }
      />

      {!actividadId ? (
        <GameDecor
          variant="empty"
          munecos={2}
          title="Elige una misión"
          text="Vuelve a Misiones y elige una tarjeta."
        />
      ) : (
        <article className={`mision-card mision-card-larga tono-${bloqueada ? 'wait' : 'ok'}`}>
          <div
            className="mision-card-foto"
            style={{ backgroundImage: `url('${imagen}')` }}
            aria-hidden="true"
          >
            <span className={`mision-badge tono-${bloqueada ? 'wait' : 'ok'}`}>
              {bloqueada ? 'Pronto' : 'Lista'}
            </span>
          </div>
          <div className="mision-card-body">
            <h3>{titulo}</h3>
            <p className="mision-hora">{inicio ? `🕐 ${inicio}` : 'Hora por confirmar'}</p>
            {error ? <p className="alert">{error}</p> : null}
            <button
              type="button"
              className={bloqueada ? 'mision-btn locked' : 'mision-btn play'}
              disabled={cargando || !actividadId || bloqueada}
              onClick={onEmpezar}
            >
              {cargando ? 'Abriendo…' : bloqueada ? 'Esperando inicio' : 'Empezar partida'}
            </button>
          </div>
        </article>
      )}
    </section>
  );
}
