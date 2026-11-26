import { portadaFondoCss } from '../data/portadas';
import { tituloCasoLimpio } from '../utils/tituloCaso';
import GameDecor from './GameDecor';

const MUÑECOS_HERO = [
  '/personajes/game-pj-01.jpg',
  '/personajes/game-pj-02.jpg',
  '/personajes/game-pj-04.jpg',
  '/personajes/game-guia.jpg'
];

export default function CasoHero({ caso, onAbrir, onJugar }) {
  if (!caso) {
    return (
      <section className="caso-hero caso-hero-vacio">
        <GameDecor variant="ambient" munecos={3} />
        <div className="caso-hero-copy">
          <p className="kicker">Historias</p>
          <h1 className="brand-mark">Lumina</h1>
          <p>Aún no hay casos. Arma lugares, personas y preguntas para la práctica.</p>
          <button type="button" className="btn-play" onClick={onAbrir}>
            <span className="play-tri" aria-hidden="true" />
            Nuevo caso
          </button>
        </div>
        <GameDecor
          variant="banner"
          munecos={3}
          title="Tu mundo todavía está vacío"
          text="Crea el primer caso y llena el mapa de personajes."
        />
      </section>
    );
  }

  const titulo = tituloCasoLimpio(caso.titulo);
  const subtitulo = caso.contextoHistoria || caso.desarrolloSituacional || 'Caso situacional';
  const etiqueta =
    caso.estado === 'Publicado'
      ? 'Lista para jugar'
      : caso.estado === 'Archivado'
        ? 'Archivada'
        : 'En preparación';

  return (
    <section className="caso-hero" style={{ backgroundImage: portadaFondoCss(caso) }}>
      <div className="caso-hero-mist" aria-hidden="true" />
      <div className="caso-hero-munecos" aria-hidden="true">
        {MUÑECOS_HERO.map((img, i) => (
          <span
            key={img}
            className="caso-hero-muneco sim-fin-bob"
            style={{ backgroundImage: `url('${img}')`, animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <div className="caso-hero-copy">
        <p className="kicker">{etiqueta}</p>
        <h1>{titulo}</h1>
        <p className="caso-hero-sub">{subtitulo}</p>
        <div className="caso-hero-actions">
          <button type="button" className="btn-play" onClick={() => onJugar?.(caso)}>
            <span className="play-tri" aria-hidden="true" />
            {caso.estado === 'Borrador' ? 'Continuar' : 'Entrar a la escena'}
          </button>
          <button type="button" className="btn-ghost-dark" onClick={() => onAbrir?.(caso)}>
            Ver caso
          </button>
        </div>
      </div>
    </section>
  );
}
