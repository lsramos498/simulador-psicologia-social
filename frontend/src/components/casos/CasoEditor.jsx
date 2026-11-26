import { useMemo, useState } from 'react';
import {
  actualizarCaso,
  actualizarDecision,
  actualizarEscena,
  actualizarOpcion,
  agregarDecision,
  agregarEscena,
  agregarOpcion,
  agregarPersonaje,
  asociarPersonaje,
  guardarMaterialCaso,
  guardarRubrica,
  obtenerCaso
} from '../../api/client';
import { aPersonajeApi, bancoCompleto } from '../../data/bancoPersonajes';
import EditorTabBasicos from './EditorTabBasicos';
import EditorTabDialogos from './EditorTabDialogos';
import EditorTabEscenas from './EditorTabEscenas';
import EditorTabPublicar from './EditorTabPublicar';
import EditorTabRubrica from './EditorTabRubrica';
import { checklistPublicacion, mensajeError, pillEstado } from '../../utils/casoHelpers';
import { guardarPortadaEscena, portadasDeCasoLocal } from '../../utils/escenasLocal';
import { dialogosDeCaso, guardarDialogosCaso } from '../../utils/dialogosLocal';

const TABS = [
  { id: 'basicos', label: 'Historia' },
  { id: 'escenas', label: 'Escenas' },
  { id: 'dialogos', label: 'Diálogos' },
  { id: 'rubrica', label: 'Evaluación' },
  { id: 'publicar', label: 'Publicar' }
];

function siguienteOrden(lista) {
  if (!lista?.length) return 1;
  return Math.max(...lista.map((x) => Number(x.orden) || 0)) + 1;
}

export default function CasoEditor({
  token,
  caso,
  onCaso,
  onMensaje,
  onError,
  onPublicar,
  onArchivar,
  onVolver,
  onVistaPrevia,
  trabajando,
  setTrabajando
}) {
  const [tab, setTab] = useState('basicos');
  const [mostrarIa, setMostrarIa] = useState(false);
  const [basicos, setBasicos] = useState({
    titulo: caso.titulo || '',
    desarrolloSituacional: caso.desarrolloSituacional || '',
    contextoHistoria: caso.contextoHistoria || '',
    tiempoEstimadoSegundos: caso.tiempoEstimadoSegundos || 600
  });
  const [escenaForm, setEscenaForm] = useState({
    nombre: '',
    contexto: '',
    esFinal: false
  });
  const [escenarioNuevo, setEscenarioNuevo] = useState(null);
  const [personajesEscenaNueva, setPersonajesEscenaNueva] = useState([]);
  const [dialogosForm, setDialogosForm] = useState(() => dialogosDeCaso(caso));
  const [decisionForms, setDecisionForms] = useState({});
  const [opcionForms, setOpcionForms] = useState({});
  const [rubrica, setRubrica] = useState(() => ({
    nombre: caso.rubrica?.nombre || `Evaluación - ${caso.titulo || 'Historia'}`,
    descripcion: caso.rubrica?.descripcion || '',
    criterios: caso.rubrica?.criterios?.length
      ? caso.rubrica.criterios.map((c) => ({
          nombre: c.nombre,
          ponderacion: c.ponderacion,
          puntajeMaximo: c.puntajeMaximo,
          niveles: (c.niveles || []).map((n) => ({
            nombre: n.nombre,
            descripcion: n.descripcion,
            puntaje: n.puntaje,
            orden: n.orden
          }))
        }))
      : [
          {
            nombre: 'Intervención',
            ponderacion: 100,
            puntajeMaximo: 5,
            niveles: [
              { nombre: 'Básico', descripcion: 'Identifica el conflicto.', puntaje: 1, orden: 1 },
              { nombre: 'Avanzado', descripcion: 'Media y propone acuerdo.', puntaje: 5, orden: 2 }
            ]
          }
        ]
  }));

  const idsEnCaso = useMemo(() => {
    const nombres = new Set(
      (caso.personajes || []).map((p) => String(p.nombre).toLocaleLowerCase('es'))
    );
    return bancoCompleto().filter((p) => nombres.has(p.nombre.toLocaleLowerCase('es')));
  }, [caso.personajes]);

  async function sincronizarMaterialServidor(dialogos = dialogosForm) {
    try {
      await guardarMaterialCaso(token, caso.id, {
        dialogos,
        portadas: portadasDeCasoLocal(caso.id)
      });
      return true;
    } catch {
      return false;
    }
  }

  async function correr(fn, okMsg) {
    setTrabajando(true);
    onError('');
    onMensaje('');
    try {
      const actualizado = await fn();
      if (actualizado?.data) onCaso(actualizado.data);
      if (okMsg) onMensaje(okMsg);
    } catch (err) {
      onError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function guardarBasicos(evento) {
    evento.preventDefault();
    await correr(
      () =>
        actualizarCaso(token, caso.id, {
          ...basicos,
          tiempoEstimadoSegundos: Number(basicos.tiempoEstimadoSegundos)
        }),
      'Datos básicos guardados.'
    );
  }

  async function aplicarAsistenteIa({ form, personajes, escenario, escenaSugerida, rubricaSugerida }) {
    const basicosNuevos = {
      titulo: form.titulo,
      desarrolloSituacional: form.desarrolloSituacional,
      contextoHistoria: form.contextoHistoria,
      tiempoEstimadoSegundos: Number(form.tiempoEstimadoSegundos) || 800
    };
    setBasicos(basicosNuevos);
    if (rubricaSugerida?.nombre) {
      setRubrica({
        nombre: rubricaSugerida.nombre,
        descripcion: rubricaSugerida.descripcion || '',
        criterios: rubricaSugerida.criterios || rubrica.criterios
      });
    }

    await correr(async () => {
      await actualizarCaso(token, caso.id, basicosNuevos);

      let actual = caso;
      for (const personaje of personajes || []) {
        const ya = (actual.personajes || []).some(
          (p) => p.nombre.toLocaleLowerCase('es') === personaje.nombre.toLocaleLowerCase('es')
        );
        if (!ya) {
          const resPj = await agregarPersonaje(token, caso.id, aPersonajeApi(personaje));
          actual = resPj.data || actual;
        }
      }

      const sinEscenas = !(actual.escenas || []).length;
      if (sinEscenas && escenaSugerida?.pregunta) {
        const ordenEscena = 1;
        const resEscena = await agregarEscena(token, caso.id, {
          nombre: (escenaSugerida.nombre || escenario?.titulo || 'Primera escena').trim(),
          contexto: (escenaSugerida.contexto || form.contextoHistoria || '').trim(),
          orden: ordenEscena,
          esFinal: false
        });
        actual = resEscena.data || actual;
        const creada =
          (actual.escenas || []).find((e) => e.orden === ordenEscena) ||
          (actual.escenas || []).slice(-1)[0];

        if (creada && escenario) {
          guardarPortadaEscena(caso.id, creada.id, escenario);
          guardarPortadaEscena(caso.id, creada.orden, escenario);
          guardarPortadaEscena(caso.id, creada.nombre, escenario);
          await sincronizarMaterialServidor();
        }

        if (creada) {
          const resDecision = await agregarDecision(token, caso.id, creada.id, {
            pregunta: escenaSugerida.pregunta.trim(),
            orden: 1,
            ayuda: null
          });
          actual = resDecision.data || actual;
          const escenaAct =
            (actual.escenas || []).find((e) => e.id === creada.id) ||
            (actual.escenas || []).slice(-1)[0];
          const decision = (escenaAct?.decisiones || []).slice(-1)[0];

          if (decision) {
            await agregarOpcion(token, caso.id, decision.id, {
              texto: (escenaSugerida.opcionBuena || form.opcionBuena).trim(),
              explicacion: (escenaSugerida.explicacionBuena || 'Favorece una intervención ética.').trim(),
              esCorrecta: true,
              orden: 1
            });
            const resOp = await agregarOpcion(token, caso.id, decision.id, {
              texto: (escenaSugerida.opcionMala || form.opcionMala).trim(),
              explicacion: (escenaSugerida.explicacionMala || 'Debilita el proceso de intervención.').trim(),
              esCorrecta: false,
              orden: 2
            });
            actual = resOp.data || actual;
          }

          const pjs = actual.personajes || [];
          for (const pj of pjs.slice(0, 3)) {
            try {
              const resAsoc = await asociarPersonaje(token, caso.id, creada.id, pj.id);
              actual = resAsoc.data || actual;
            } catch {
              /* ya asociado u otro conflicto menor */
            }
          }
        }
      }

      if (rubricaSugerida?.criterios?.length && !actual.rubrica) {
        const resRub = await guardarRubrica(token, caso.id, {
          nombre: rubricaSugerida.nombre,
          descripcion: rubricaSugerida.descripcion || null,
          criterios: rubricaSugerida.criterios
        });
        actual = resRub.data || actual;
      }

      const fresco = await obtenerCaso(token, caso.id);
      return fresco;
    }, 'IA aplicada: datos, personajes y escena (si faltaba).');
  }

  async function agregarDelBanco(personaje) {
    const ya = (caso.personajes || []).some(
      (p) => p.nombre.toLocaleLowerCase('es') === personaje.nombre.toLocaleLowerCase('es')
    );
    if (ya) {
      onMensaje(`${personaje.nombre} ya está en el caso.`);
      return;
    }
    await correr(
      () => agregarPersonaje(token, caso.id, aPersonajeApi(personaje)),
      `${personaje.nombre} agregado al caso.`
    );
  }

  async function agregarPersonalizado(evento) {
    evento.preventDefault();
    const data = new FormData(evento.target);
    const payload = {
      nombre: String(data.get('nombre') || '').trim(),
      rolSocial: String(data.get('rolSocial') || '').trim() || null,
      perfil: String(data.get('perfil') || '').trim() || null,
      pautasComportamiento: String(data.get('pautas') || '').trim() || null
    };
    await correr(
      () => agregarPersonaje(token, caso.id, payload),
      `${payload.nombre} agregado.`
    );
    evento.target.reset();
  }

  function togglePersonajeEscenaNueva(personaje) {
    setPersonajesEscenaNueva((prev) => {
      const existe = prev.some((p) => p.id === personaje.id);
      if (existe) return prev.filter((p) => p.id !== personaje.id);
      return [...prev, personaje];
    });
  }

  async function crearEscena(evento) {
    evento.preventDefault();
    if (!escenarioNuevo && !escenaForm.nombre.trim()) {
      onError('Elige un escenario o escribe un nombre para la escena.');
      return;
    }
    if (personajesEscenaNueva.length === 0) {
      onError('Selecciona al menos un personaje para esta escena.');
      return;
    }
    const nombre = (escenarioNuevo?.titulo || escenaForm.nombre).trim();
    const contexto = (escenarioNuevo?.descripcion || escenaForm.contexto).trim();
    const orden = siguienteOrden(caso.escenas);
    await correr(async () => {
      // Asegura que los personajes elegidos existan en el caso y luego los asocia a la escena.
      let casoActual = caso;
      for (const personaje of personajesEscenaNueva) {
        const ya = (casoActual.personajes || []).some(
          (p) => p.nombre.toLocaleLowerCase('es') === personaje.nombre.toLocaleLowerCase('es')
        );
        if (!ya) {
          const resPj = await agregarPersonaje(token, caso.id, aPersonajeApi(personaje));
          casoActual = resPj.data || casoActual;
          onCaso?.(casoActual);
        }
      }

      const respuesta = await agregarEscena(token, caso.id, {
        nombre,
        contexto,
        orden,
        esFinal: Boolean(escenaForm.esFinal)
      });
      casoActual = respuesta?.data || casoActual;
      onCaso?.(casoActual);

      const creada =
        (casoActual.escenas || []).find((e) => e.orden === orden) ||
        (casoActual.escenas || []).slice(-1)[0];

      if (creada) {
        if (escenarioNuevo) {
          guardarPortadaEscena(caso.id, creada.id, escenarioNuevo);
          guardarPortadaEscena(caso.id, creada.orden, escenarioNuevo);
          guardarPortadaEscena(caso.id, creada.nombre, escenarioNuevo);
          await sincronizarMaterialServidor();
        }

        for (const personaje of personajesEscenaNueva) {
          const enCaso = (casoActual.personajes || []).find(
            (p) => p.nombre.toLocaleLowerCase('es') === personaje.nombre.toLocaleLowerCase('es')
          );
          if (enCaso?.id) {
            const resAsoc = await asociarPersonaje(token, caso.id, creada.id, enCaso.id);
            casoActual = resAsoc.data || casoActual;
            onCaso?.(casoActual);
          }
        }
      }

      return { data: casoActual };
    }, 'Escena creada con escenario y personajes.');
    setEscenaForm({ nombre: '', contexto: '', esFinal: false });
    setEscenarioNuevo(null);
    setPersonajesEscenaNueva([]);
  }

  async function guardarEscena(escena, patch) {
    await correr(
      () =>
        actualizarEscena(token, caso.id, escena.id, {
          nombre: patch.nombre ?? escena.nombre,
          contexto: patch.contexto ?? escena.contexto,
          orden: Number(patch.orden ?? escena.orden),
          esFinal: Boolean(patch.esFinal ?? escena.esFinal)
        }),
      'Escena actualizada.'
    );
  }

  async function vincularPj(escenaId, personajeId) {
    if (!personajeId) return;
    await correr(
      () => asociarPersonaje(token, caso.id, escenaId, personajeId),
      'Personaje asociado a la escena.'
    );
  }

  async function crearDecision(escena) {
    const form = decisionForms[escena.id] || { pregunta: '', ayuda: '' };
    if (!form.pregunta.trim()) {
      onError('Escribe la pregunta.');
      return;
    }
    await correr(
      () =>
        agregarDecision(token, caso.id, escena.id, {
          pregunta: form.pregunta.trim(),
          orden: siguienteOrden(escena.decisiones),
          ayuda: form.ayuda?.trim() || null
        }),
      'Pregunta agregada.'
    );
    setDecisionForms((prev) => ({ ...prev, [escena.id]: { pregunta: '', ayuda: '' } }));
  }

  async function guardarDecision(decision, patch) {
    await correr(
      () =>
        actualizarDecision(token, caso.id, decision.id, {
          pregunta: patch.pregunta ?? decision.pregunta,
          orden: Number(patch.orden ?? decision.orden),
          ayuda: patch.ayuda ?? decision.ayuda ?? null
        }),
      'Pregunta actualizada.'
    );
  }

  async function crearOpcion(decision) {
    const form = opcionForms[decision.id] || {
      texto: '',
      explicacion: '',
      esCorrecta: false,
      fundamentoTeorico: ''
    };
    if (!form.texto.trim() || !form.explicacion.trim()) {
      onError('Texto y explicación de la opción son obligatorios.');
      return;
    }
    await correr(
      () =>
        agregarOpcion(token, caso.id, decision.id, {
          texto: form.texto.trim(),
          explicacion: form.explicacion.trim(),
          esCorrecta: Boolean(form.esCorrecta),
          orden: siguienteOrden(decision.opciones),
          fundamentoTeorico: form.fundamentoTeorico?.trim() || null
        }),
      'Opción agregada.'
    );
    setOpcionForms((prev) => ({
      ...prev,
      [decision.id]: { texto: '', explicacion: '', esCorrecta: false, fundamentoTeorico: '' }
    }));
  }

  async function guardarOpcion(opcion, patch) {
    await correr(
      () =>
        actualizarOpcion(token, caso.id, opcion.id, {
          texto: patch.texto ?? opcion.texto,
          explicacion: patch.explicacion ?? opcion.explicacion,
          esCorrecta: Boolean(patch.esCorrecta ?? opcion.esCorrecta),
          orden: Number(patch.orden ?? opcion.orden),
          consecuencia: patch.consecuencia ?? opcion.consecuencia ?? null,
          fundamentoTeorico: patch.fundamentoTeorico ?? opcion.fundamentoTeorico ?? null
        }),
      'Opción actualizada.'
    );
  }

  async function guardarDialogos() {
    guardarDialogosCaso(caso.id, dialogosForm);
    try {
      await guardarMaterialCaso(token, caso.id, {
        dialogos: dialogosForm,
        portadas: portadasDeCasoLocal(caso.id)
      });
      onMensaje('Diálogos guardados en el servidor (el estudiante también los verá).');
      onError('');
    } catch (err) {
      onError(mensajeError(err));
      onMensaje('Diálogos guardados solo en este navegador (falló el servidor).');
    }
  }

  async function guardarRubricaForm(evento) {
    evento.preventDefault();
    const suma = rubrica.criterios.reduce((n, c) => n + Number(c.ponderacion || 0), 0);
    if (Math.abs(suma - 100) > 0.05) {
      onError(`Las ponderaciones deben sumar 100 (ahora suman ${suma.toFixed(2)}).`);
      return;
    }
    const payload = {
      nombre: rubrica.nombre.trim(),
      descripcion: rubrica.descripcion?.trim() || null,
      criterios: rubrica.criterios.map((c) => ({
        nombre: c.nombre.trim(),
        ponderacion: Number(c.ponderacion),
        puntajeMaximo: Number(c.puntajeMaximo),
        niveles: c.niveles.map((n) => ({
          nombre: n.nombre.trim(),
          descripcion: n.descripcion.trim(),
          puntaje: Number(n.puntaje),
          orden: Number(n.orden)
        }))
      }))
    };
    await correr(() => guardarRubrica(token, caso.id, payload), 'Evaluación guardada.');
  }

  const checklist = checklistPublicacion(caso);

  return (
    <section className="caso-editor">
      <header className="editor-head">
        <div>
          <p className="kicker">Preparando historia</p>
          <h2>{caso.titulo}</h2>
          <span className={pillEstado(caso.estado)}>{caso.estado}</span>
        </div>
        <div className="ficha-acciones">
          {(caso.escenas || []).length > 0 ? (
            <button type="button" className="btn-play" onClick={() => onVistaPrevia?.(caso)}>
              <span className="play-tri" aria-hidden="true" />
              Vista previa
            </button>
          ) : null}
          <button type="button" className="btn-ghost-dark" onClick={onVolver}>
            Ver historia
          </button>
          <button type="button" className="btn-ghost-dark" disabled={trabajando} onClick={onArchivar}>
            Archivar
          </button>
        </div>
      </header>

      <div className="editor-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className={tab === t.id ? 'tab activo' : 'tab'}
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'basicos' ? (
        <EditorTabBasicos
          token={token}
          basicos={basicos}
          setBasicos={setBasicos}
          trabajando={trabajando}
          mostrarIa={mostrarIa}
          setMostrarIa={setMostrarIa}
          onAplicarIa={aplicarAsistenteIa}
          onGuardar={guardarBasicos}
        />
      ) : null}

      {tab === 'escenas' ? (
        <EditorTabEscenas
          casoId={caso.id}
          escenas={caso.escenas}
          personajes={caso.personajes}
          escenaForm={escenaForm}
          setEscenaForm={setEscenaForm}
          escenarioNuevo={escenarioNuevo}
          setEscenarioNuevo={setEscenarioNuevo}
          personajesEscenaNueva={personajesEscenaNueva}
          onTogglePersonajeEscena={togglePersonajeEscenaNueva}
          decisionForms={decisionForms}
          setDecisionForms={setDecisionForms}
          opcionForms={opcionForms}
          setOpcionForms={setOpcionForms}
          trabajando={trabajando}
          onCrearEscena={crearEscena}
          onGuardarEscena={guardarEscena}
          onVincularPj={vincularPj}
          onCrearDecision={crearDecision}
          onGuardarDecision={guardarDecision}
          onCrearOpcion={crearOpcion}
          onGuardarOpcion={guardarOpcion}
        />
      ) : null}

      {tab === 'dialogos' ? (
        <EditorTabDialogos
          personajes={caso.personajes}
          dialogosForm={dialogosForm}
          setDialogosForm={setDialogosForm}
          trabajando={trabajando}
          onGuardar={guardarDialogos}
        />
      ) : null}

      {tab === 'rubrica' ? (
        <EditorTabRubrica
          caso={caso}
          rubrica={rubrica}
          setRubrica={setRubrica}
          trabajando={trabajando}
          onGuardar={guardarRubricaForm}
          onMensaje={onMensaje}
          onError={onError}
        />
      ) : null}

      {tab === 'publicar' ? (
        <EditorTabPublicar
          caso={caso}
          checklist={checklist}
          trabajando={trabajando}
          onPublicar={onPublicar}
          onVistaPrevia={onVistaPrevia}
          onVolver={onVolver}
        />
      ) : null}
    </section>
  );
}
