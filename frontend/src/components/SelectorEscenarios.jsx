import { useMemo, useState } from 'react';
import { BANCO_ESCENARIOS, CATEGORIAS_ESCENARIO } from '../data/bancoEscenarios';

export default function SelectorEscenarios({ valor, onElegir, titulo = 'Escoge el escenario' }) {
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('Todas');

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase('es');
    return BANCO_ESCENARIOS.filter((esc) => {
      if (categoria !== 'Todas' && esc.categoriaNombre !== categoria) return false;
      if (!q) return true;
      return (
        esc.titulo.toLocaleLowerCase('es').includes(q) ||
        esc.descripcion.toLocaleLowerCase('es').includes(q) ||
        esc.categoriaNombre.toLocaleLowerCase('es').includes(q)
      );
    });
  }, [busqueda, categoria]);

  return (
    <section className="selector-escenarios">
      <header className="banco-head">
        <div>
          <h3>{titulo}</h3>
          <p className="muted-light">{filtrados.length} de {BANCO_ESCENARIOS.length} escenarios</p>
        </div>
      </header>

      <div className="selector-filtros">
        <input
          type="search"
          placeholder="Buscar comisaría, hospital, barrio, hogar…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="Todas">Todas las categorías</option>
          {CATEGORIAS_ESCENARIO.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {filtrados.length === 0 ? (
        <p className="muted-light">No hay escenarios con ese filtro. Prueba otra búsqueda o categoría.</p>
      ) : (
        <div className="escenarios-grid" role="list">
          {filtrados.map((esc) => {
            const activo = valor?.id === esc.id;
            return (
              <button
                key={esc.id}
                type="button"
                role="listitem"
                className={activo ? 'escenario-card activo' : 'escenario-card'}
                style={{ backgroundImage: `linear-gradient(180deg, transparent 30%, rgba(8,6,16,0.92)), url('${esc.imagen}')` }}
                onClick={() => onElegir?.(esc)}
              >
                {activo ? <span className="caso-check">✓</span> : null}
                <span className="escenario-meta">
                  <strong>{esc.titulo}</strong>
                  <em>{esc.categoriaNombre}</em>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
