import { useEffect, useState } from 'react';
import { BANCO_PERSONAJES } from '../data/bancoPersonajes';
import { GALERIA_PERSONAJES } from '../data/galeriaPersonajes';
import {
  agregarPersonajeCustom,
  leerPersonajesCustom
} from '../utils/personajesLocal';

export default function BancoPersonajes({
  seleccionados = [],
  onToggle,
  modo = 'ver',
  titulo = 'Personajes',
  onBancoChange
}) {
  const [custom, setCustom] = useState(() => leerPersonajesCustom());
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    rolSocial: '',
    perfil: '',
    pautasComportamiento: '',
    imagen: GALERIA_PERSONAJES[0]?.imagen || ''
  });

  const banco = [...BANCO_PERSONAJES, ...custom];
  const ids = new Set(seleccionados.map((p) => p.id));

  useEffect(() => {
    onBancoChange?.(banco);
  }, [custom.length]);

  function guardarNuevo(evento) {
    evento.preventDefault();
    if (!form.nombre.trim() || !form.imagen) return;
    const creado = agregarPersonajeCustom({
      nombre: form.nombre.trim(),
      rolSocial: form.rolSocial.trim() || 'Sin rol',
      perfil: form.perfil.trim() || 'Sin descripción.',
      pautasComportamiento: form.pautasComportamiento.trim() || null,
      imagen: form.imagen,
      acento: '#e6c36a',
      iniciales: form.nombre.trim().slice(0, 2).toUpperCase()
    });
    const lista = leerPersonajesCustom();
    setCustom(lista);
    setCreando(false);
    setForm({
      nombre: '',
      rolSocial: '',
      perfil: '',
      pautasComportamiento: '',
      imagen: GALERIA_PERSONAJES[0]?.imagen || ''
    });
    if (modo === 'elegir') onToggle?.(creado);
  }

  return (
    <section className="banco">
      <header className="banco-head">
        <div>
          <h2>{titulo}</h2>
          <p className="muted-light">
            {modo === 'elegir'
              ? 'Elige a los personajes (muñequitos) a quienes se podrá preguntar.'
              : 'Personajes del caso. Crea los tuyos y asígnales imagen, rol y descripción.'}
          </p>
        </div>
        <div className="banco-acciones">
          {modo === 'elegir' ? (
            <span className="banco-count">{seleccionados.length} elegidos</span>
          ) : null}
          <button type="button" className="btn-ghost-dark" onClick={() => setCreando((v) => !v)}>
            {creando ? 'Cerrar' : 'Crear personaje'}
          </button>
        </div>
      </header>

      {creando ? (
        <form className="crear-personaje" onSubmit={guardarNuevo}>
          <h3>Nuevo personaje</h3>
          <div className="crear-grid">
            <div className="field">
              <label htmlFor="np-nombre">Nombre</label>
              <input
                id="np-nombre"
                value={form.nombre}
                maxLength={100}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="np-rol">Rol</label>
              <input
                id="np-rol"
                value={form.rolSocial}
                maxLength={100}
                onChange={(e) => setForm({ ...form, rolSocial: e.target.value })}
                placeholder="Estudiante, testigo, docente…"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="np-desc">Descripción</label>
            <textarea
              id="np-desc"
              rows={2}
              value={form.perfil}
              onChange={(e) => setForm({ ...form, perfil: e.target.value })}
              placeholder="Cómo es y qué lo mueve…"
            />
          </div>
          <div className="field">
            <label htmlFor="np-pautas">Cómo se comporta</label>
            <input
              id="np-pautas"
              value={form.pautasComportamiento}
              onChange={(e) => setForm({ ...form, pautasComportamiento: e.target.value })}
            />
          </div>

          <p className="muted-light">Elige una imagen</p>
          <div className="galeria-pj" role="list">
            {GALERIA_PERSONAJES.map((img) => (
              <button
                key={img.id}
                type="button"
                role="listitem"
                className={form.imagen === img.imagen ? 'galeria-item activo' : 'galeria-item'}
                style={{ backgroundImage: `url('${img.imagen}')` }}
                onClick={() => setForm({ ...form, imagen: img.imagen })}
                aria-label={img.etiqueta}
              />
            ))}
          </div>

          <button className="btn-play" type="submit">
            Guardar personaje
          </button>
        </form>
      ) : null}

      <div className="banco-grid" role="list">
        {banco.map((personaje) => {
          const elegido = ids.has(personaje.id);
          return (
            <button
              key={personaje.id}
              type="button"
              role="listitem"
              className={elegido ? 'pj-card elegido' : 'pj-card'}
              onClick={() => {
                if (modo === 'elegir') onToggle?.(personaje);
              }}
              style={{ '--pj-acento': personaje.acento || '#e6c36a' }}
            >
              {elegido ? <span className="caso-check" aria-hidden="true">✓</span> : null}
              <span
                className="pj-foto"
                style={{ backgroundImage: `url('${personaje.imagen}')` }}
                role="img"
                aria-label={personaje.nombre}
              />
              <span className="pj-info">
                <strong>{personaje.nombre}</strong>
                <em>{personaje.rolSocial}</em>
                <small>{personaje.perfil}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
