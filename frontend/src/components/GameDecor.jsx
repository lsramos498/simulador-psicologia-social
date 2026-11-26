const MUNECOS = [
  '/personajes/game-pj-01.jpg',
  '/personajes/game-pj-03.jpg',
  '/personajes/game-pj-05.jpg',
  '/personajes/game-guia.jpg',
  '/personajes/game-pj-07.jpg'
];

function LupaMini({ className = '' }) {
  return (
    <span className={`game-lupa ${className}`} aria-hidden="true">
      <span className="game-lupa-cristal">
        <span
          className="game-lupa-face"
          style={{ backgroundImage: "url('/personajes/game-pj-03.jpg')" }}
        />
      </span>
      <span className="game-lupa-aro" />
      <span className="game-lupa-mango" />
    </span>
  );
}

function LibroMini({ className = '', tono = 'a' }) {
  return <span className={`game-libro game-libro-${tono} ${className}`} aria-hidden="true" />;
}

/**
 * Decoración de juego para vacíos o fondos.
 * @param {'empty'|'ambient'|'banner'} variant
 */
export default function GameDecor({
  variant = 'empty',
  title,
  text,
  munecos = 3,
  className = ''
}) {
  const faces = MUNECOS.slice(0, Math.max(1, Math.min(munecos, MUNECOS.length)));

  if (variant === 'ambient') {
    return (
      <div className={`game-decor game-decor-ambient ${className}`} aria-hidden="true">
        <LupaMini className="float-a" />
        <LibroMini className="float-b" tono="a" />
        <LibroMini className="float-c" tono="b" />
        <LibroMini className="float-d" tono="c" />
        {faces.map((src, i) => (
          <span
            key={src}
            className={`game-muneco float-m${i + 1}`}
            style={{ backgroundImage: `url('${src}')` }}
          />
        ))}
        <span className="game-spark s1" />
        <span className="game-spark s2" />
        <span className="game-spark s3" />
      </div>
    );
  }

  return (
    <div className={`game-decor game-decor-${variant} ${className}`}>
      <div className="game-decor-stage" aria-hidden="true">
        <LupaMini className="float-a" />
        <LibroMini className="float-b" tono="a" />
        <LibroMini className="float-c" tono="b" />
        {faces.map((src, i) => (
          <span
            key={src}
            className={`game-muneco float-m${i + 1}`}
            style={{ backgroundImage: `url('${src}')` }}
          />
        ))}
        <span className="game-spark s1" />
        <span className="game-spark s2" />
      </div>
      {title ? <strong className="game-decor-title">{title}</strong> : null}
      {text ? <p className="game-decor-text">{text}</p> : null}
    </div>
  );
}
