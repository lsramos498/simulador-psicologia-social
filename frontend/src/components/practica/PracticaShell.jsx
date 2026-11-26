import GameDecor from '../GameDecor';

const DECO = [
  '/personajes/game-pj-01.jpg',
  '/personajes/game-pj-03.jpg',
  '/personajes/game-pj-05.jpg',
  '/personajes/game-guia.jpg'
];

export default function PracticaShell({ usuario, onSalir, children }) {
  return (
    <div className="practica-shell">
      <div className="practica-shell-bg" aria-hidden="true" />
      <GameDecor variant="ambient" munecos={3} />
      <div className="practica-shell-deco" aria-hidden="true">
        {DECO.map((img, i) => (
          <span
            key={img}
            className="practica-shell-muneco sim-fin-bob"
            style={{ backgroundImage: `url('${img}')`, animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
      <header className="practica-top">
        <div>
          <span className="brand-mark">Lumina</span>
          <p className="muted-light" style={{ margin: 0 }}>
            {[usuario?.nombres, usuario?.apellidos].filter(Boolean).join(' ') || 'Estudiante'}
          </p>
        </div>
        <button type="button" className="login-btn-game green practica-salir" onClick={onSalir}>
          Salir
        </button>
      </header>
      <div className="practica-shell-body">{children}</div>
    </div>
  );
}
