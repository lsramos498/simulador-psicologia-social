const GUIA = {
  nombre: 'Nova',
  imagen: '/personajes/game-guia.jpg'
};

/**
 * Mensaje de Nova según nota (0–5) o tono explícito.
 */
export function mensajeNovaPorNota(nota) {
  const n = Number(nota);
  if (!Number.isFinite(n)) {
    return {
      tono: 'mid',
      titulo: 'Seguimos jugando',
      texto: 'Revisa las pistas con calma. En la próxima partida vas a notar la diferencia.'
    };
  }
  if (n >= 4) {
    return {
      tono: 'ok',
      titulo: '¡Muy bien!',
      texto: 'Excelente trabajo. Escuchaste, contrastaste y cuidaste cada decisión.'
    };
  }
  if (n >= 3) {
    return {
      tono: 'mid',
      titulo: 'Buen avance',
      texto: 'Vas por buen camino. Sigue contrastando versiones antes de decidir.'
    };
  }
  return {
    tono: 'fail',
    titulo: 'Más suerte para la próxima',
    texto: 'Esta ronda fue de aprendizaje. Lee las pistas otra vez y vuelve a intentarlo.'
  };
}

export function mensajeNovaPorFraccion(fraccion) {
  const f = Number(fraccion);
  if (!Number.isFinite(f)) return mensajeNovaPorNota(null);
  return mensajeNovaPorNota(f * 5);
}

/**
 * Burbuja hablada de Nova (retroalimentación / tips de juego).
 */
export default function GuiaBurbuja({
  nota,
  fraccion,
  tono: tonoProp,
  titulo: tituloProp,
  texto: textoProp,
  className = ''
}) {
  const base =
    tonoProp && (tituloProp || textoProp)
      ? { tono: tonoProp, titulo: tituloProp, texto: textoProp }
      : nota != null
        ? mensajeNovaPorNota(nota)
        : mensajeNovaPorFraccion(fraccion);

  const tono = tonoProp || base.tono;
  const titulo = tituloProp || base.titulo;
  const texto = textoProp || base.texto;

  return (
    <aside className={`guia-burbuja tono-${tono} ${className}`} aria-live="polite">
      <span
        className="guia-burbuja-avatar sim-fin-bob"
        style={{ backgroundImage: `url('${GUIA.imagen}')` }}
        role="img"
        aria-label={GUIA.nombre}
      />
      <div className="guia-burbuja-globo">
        <p className="guia-burbuja-nombre">{GUIA.nombre}</p>
        <strong className="guia-burbuja-titulo">{titulo}</strong>
        <p className="guia-burbuja-texto">{texto}</p>
      </div>
    </aside>
  );
}
