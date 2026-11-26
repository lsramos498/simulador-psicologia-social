import { useState } from 'react';
import BancoPersonajes from '../BancoPersonajes';
import SelectorEscenarios from '../SelectorEscenarios';
import AsistenteIACasos from './AsistenteIACasos';
import GameDecor from '../GameDecor';
import GuiaBurbuja from '../GuiaBurbuja';
import { importarCasoDesdeTexto } from '../../api/client';
import { extraerTextoPdf } from '../../utils/pdfTexto';
import { leerArchivoRubrica } from '../../utils/rubricaArchivo';
import { repararTextoUtf8 } from '../../utils/textoUtf8';
import { mensajeError } from '../../utils/casoHelpers';

async function leerTextoArchivoCaso(archivo) {
  const nombre = String(archivo?.name || '').toLowerCase();
  const esTxt =
    nombre.endsWith('.txt') ||
    archivo?.type === 'text/plain' ||
    archivo?.type === 'text/markdown';
  if (esTxt) {
    const crudo = await archivo.text();
    const texto = repararTextoUtf8(crudo.trim());
    if (!texto) throw new Error('El archivo de texto está vacío.');
    return texto;
  }
  const texto = repararTextoUtf8(await extraerTextoPdf(archivo));
  if (!texto) throw new Error('No se pudo leer texto del archivo.');
  return texto;
}

export default function CrearCasoPanel({
  token,
  form,
  setForm,
  personajesElegidos,
  onTogglePersonaje,
  escenarioElegido,
  onElegirEscenario,
  mostrarIa,
  onToggleIa,
  trabajando,
  setTrabajando,
  onAplicarIa,
  onSubmitCompleto,
  onSubmitBorrador,
  onCasoImportado,
  onRubricaCargada,
  onMensaje,
  onError
}) {
  const [importando, setImportando] = useState(false);
  const [rubricaResumen, setRubricaResumen] = useState('');

  async function onArchivoCaso(ev) {
    const archivo = ev.target.files?.[0];
    ev.target.value = '';
    if (!archivo) return;
    setImportando(true);
    onError?.('');
    onMensaje?.('');
    try {
      const texto = await leerTextoArchivoCaso(archivo);
      const res = await importarCasoDesdeTexto(token, { texto, publicar: false });
      onMensaje?.(
        `Caso importado (#${res.data?.id}): ${res.metaImportacion?.escenasDetectadas || '?'} escenas, ${res.metaImportacion?.personajesDetectados || '?'} personajes. Revisalo y publicalo.`
      );
      onCasoImportado?.(res.data);
    } catch (err) {
      onError?.(mensajeError(err));
    } finally {
      setImportando(false);
    }
  }

  async function onArchivoRubrica(ev) {
    const archivo = ev.target.files?.[0];
    ev.target.value = '';
    if (!archivo) return;
    try {
      const rubrica = await leerArchivoRubrica(archivo, { extraerPdf: extraerTextoPdf });
      const criterios = rubrica.criterios?.length || 0;
      setRubricaResumen(`«${rubrica.nombre}» - ${criterios} criterio(s)`);
      setForm((prev) => ({
        ...prev,
        rubricaCargada: rubrica,
        rubricaPdfTexto: rubrica.textoFuente || prev.rubricaPdfTexto || ''
      }));
      onRubricaCargada?.(rubrica);
      onMensaje?.(
        `Rúbrica leída: ${rubrica.nombre} (${criterios} criterios). Se usará al crear el caso.`
      );
      onError?.('');
    } catch (err) {
      onError?.(mensajeError(err) || err.message || 'No se pudo leer la rúbrica.');
    }
  }

  const ocupado = trabajando || importando;

  return (
    <section className="crear-caso">
      <GameDecor variant="ambient" munecos={3} />
      <GuiaBurbuja
        tono="mid"
        titulo="¡Armemos una partida!"
        texto="Crea el caso a mano, con IA o subiendo PDF/TXT. Después: publicar → programar grupo → iniciar."
        className="guia-burbuja-destacada"
      />
      <header className="crear-head">
        <div>
          <p className="kicker">Casos psicológicos</p>
          <h2>Crear caso</h2>
          <p className="muted-light">
            Manual, con IA, o subiendo un PDF/TXT del caso. Después programas la actividad para grupos/estudiantes.
          </p>
        </div>
        <div className="crear-head-acciones">
          <div className="modo-crear">
            <button
              type="button"
              className={form.modo === 'completo' ? 'tab activo' : 'tab'}
              onClick={() => setForm({ ...form, modo: 'completo' })}
            >
              Lista para jugar
            </button>
            <button
              type="button"
              className={form.modo === 'borrador' ? 'tab activo' : 'tab'}
              onClick={() => setForm({ ...form, modo: 'borrador' })}
            >
              Empezar vacía
            </button>
          </div>
          <button
            type="button"
            className={mostrarIa ? 'btn-play btn-ia-toggle activo' : 'btn-play btn-ia-toggle'}
            onClick={onToggleIa}
          >
            {mostrarIa ? 'Ocultar IA' : 'Crear con IA'}
          </button>
          <label className="btn-ghost-dark" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
            {importando ? 'Leyendo archivo…' : 'Subir caso (PDF/TXT)'}
            <input
              type="file"
              accept="application/pdf,.pdf,text/plain,.txt"
              hidden
              disabled={ocupado}
              onChange={onArchivoCaso}
            />
          </label>
        </div>
      </header>

      {mostrarIa ? (
        <AsistenteIACasos token={token} disabled={ocupado} onAplicar={onAplicarIa} />
      ) : null}

      {form.modo === 'borrador' ? (
        <p className="muted-light">
          Creas el caso vacío. En el editor, al armar cada escena eliges el escenario y los personajes de esa escena.
        </p>
      ) : null}

      <form
        className="crear-form"
        onSubmit={form.modo === 'completo' ? onSubmitCompleto : onSubmitBorrador}
      >
        <div className="field">
          <label htmlFor="titulo">Título</label>
          <input
            id="titulo"
            value={form.titulo}
            maxLength={200}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            required
            placeholder="Conflicto en el aula"
          />
        </div>
        <div className="field">
          <label htmlFor="desarrollo">Desarrollo situacional</label>
          <textarea
            id="desarrollo"
            value={form.desarrolloSituacional}
            onChange={(e) => setForm({ ...form, desarrolloSituacional: e.target.value })}
            required
            rows={3}
          />
        </div>
        <div className="field">
          <label htmlFor="contexto">Contexto / objetivos</label>
          <textarea
            id="contexto"
            value={form.contextoHistoria}
            onChange={(e) => setForm({ ...form, contextoHistoria: e.target.value })}
            required
            rows={3}
          />
        </div>
        <div className="field">
          <label htmlFor="tiempo">Tiempo estimado (seg)</label>
          <input
            id="tiempo"
            type="number"
            min="1"
            value={form.tiempoEstimadoSegundos}
            onChange={(e) => setForm({ ...form, tiempoEstimadoSegundos: e.target.value })}
            required
          />
        </div>

        <div className="field">
          <label>Rúbrica (PDF, JSON, CSV o TXT)</label>
          <input
            type="file"
            accept="application/pdf,.pdf,application/json,.json,text/csv,.csv,text/plain,.txt"
            disabled={ocupado}
            onChange={onArchivoRubrica}
          />
          {rubricaResumen || form.rubricaCargada ? (
            <p className="muted-light">
              Rúbrica lista: {rubricaResumen || form.rubricaCargada?.nombre}. Se guarda con el caso al
              crearlo.
            </p>
          ) : (
            <p className="muted-light">
              Sube una rúbrica en PDF/JSON/CSV/TXT. El sistema la lee y arma criterios para evaluar.
            </p>
          )}
        </div>

        {form.modo === 'completo' ? (
          <fieldset className="escena-creacion-bloque">
            <legend>Escena 1 — escenario y personajes</legend>
            <p className="muted-light">
              Aquí mismo eliges el lugar de esta escena y qué personajes aparecen. No antes ni después.
            </p>
            <SelectorEscenarios
              titulo="Escenario de esta escena"
              valor={escenarioElegido}
              onElegir={onElegirEscenario}
            />
            <BancoPersonajes
              modo="elegir"
              titulo="Personajes de esta escena"
              seleccionados={personajesElegidos}
              onToggle={onTogglePersonaje}
            />
            <div className="field">
              <label htmlFor="pregunta">Pregunta de la escena</label>
              <input
                id="pregunta"
                value={form.pregunta}
                onChange={(e) => setForm({ ...form, pregunta: e.target.value })}
                required
              />
            </div>
            <div className="crear-grid">
              <div className="field">
                <label htmlFor="buena">Opción correcta</label>
                <input
                  id="buena"
                  value={form.opcionBuena}
                  onChange={(e) => setForm({ ...form, opcionBuena: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="mala">Opción incorrecta</label>
                <input
                  id="mala"
                  value={form.opcionMala}
                  onChange={(e) => setForm({ ...form, opcionMala: e.target.value })}
                  required
                />
              </div>
            </div>
          </fieldset>
        ) : null}

        <button className="btn-play" type="submit" disabled={ocupado}>
          <span className="play-tri" aria-hidden="true" />
          {ocupado
            ? 'Creando…'
            : form.modo === 'completo'
              ? 'Crear caso'
              : 'Empezar caso'}
        </button>
      </form>
    </section>
  );
}
