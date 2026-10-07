import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useSocios } from '../context/SociosContext';
import { getUserByDni } from '../services/usersService';
import {
  cargarRutina, guardarRutina, subscribePlantillas, diasDePlantilla, nuevoId,
} from '../services/rutinasService';
import { descargarExcel } from '../rutinas/excel';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { EXERCISES, MUSCLE_GROUPS } from '../../../src/constants/exercises.js';
import { getExerciseGif, getExerciseImage } from '../../../src/constants/exerciseMedia.js';

// Armar la rutina de un socio desde el panel. Se guarda en el mismo lugar que
// la app (ver rutinasService), así que el socio la ve en su celular. También
// se imprime en la planilla del gimnasio o se descarga en Excel.
const OBJETIVOS_APP = {
  perder_peso: 'Perder peso',
  ganar_musculo: 'Ganar músculo',
  mantenimiento: 'Mantenimiento',
  definicion: 'Definición',
  resistencia: 'Resistencia',
};

const ejercicioNuevo = (ex) => ({
  id: nuevoId(),
  exerciseId: ex?.id ?? `propio_${nuevoId()}`,
  nombre: ex?.nombre ?? '',
  grupoMuscular: ex?.grupoMuscular ?? null,
  series: 4,
  repeticiones: 12,
  carga: '',
  descanso: 90,
  observaciones: '',
});

export default function RutinaSocioPage() {
  const { dni } = useParams();
  const { user } = useAuth();
  const { socios } = useSocios();
  const socio = socios.find((s) => s.dni === dni);

  const [cuenta, setCuenta] = useState(undefined); // undefined: cargando · null: sin app
  const [rutina, setRutina] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cambios, setCambios] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [elegirPara, setElegirPara] = useState(null); // índice del día al que se agrega un ejercicio
  const [editando, setEditando] = useState(null);     // { dia, j }: ejercicio abierto para editar
  const [verPlantillas, setVerPlantillas] = useState(false);
  const [bajando, setBajando] = useState(false);

  const nombreSocio = [socio?.nombre, socio?.apellido].filter(Boolean).join(' ')
    || [cuenta?.nombre, cuenta?.apellido].filter(Boolean).join(' ');

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCargando(true);
      try {
        const c = await getUserByDni(dni).catch(() => null);
        if (!vivo) return;
        setCuenta(c);
        const r = await cargarRutina({ dni, uid: c?.uid, entrenadorUid: user?.uid });
        if (!vivo) return;
        if (r?.pasadaALaApp) toast.info('La rutina que tenía guardada con su DNI ya está en su app.');
        setRutina(r ?? {
          nombre: 'Rutina',
          objetivos: OBJETIVOS_APP[c?.objetivo] ?? '',
          observacion: '',
          dias: [],
        });
      } catch (e) {
        console.error('[admin-web] rutina:', e);
        toast.error('No se pudo cargar la rutina.');
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [dni, user?.uid]);

  // Cambios sin guardar: avisar antes de cerrar la pestaña.
  useEffect(() => {
    if (!cambios) return;
    const aviso = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [cambios]);

  const cambiar = (fn) => {
    setRutina((r) => fn(structuredClone(r)));
    setCambios(true);
  };
  const cambiarDia = (i, fn) => cambiar((r) => { fn(r.dias[i]); return r; });

  async function guardar() {
    setGuardando(true);
    try {
      const guardada = await guardarRutina({ rutina, dni, uid: cuenta?.uid, entrenadorUid: user?.uid });
      setRutina(guardada);
      setCambios(false);
      toast.success(cuenta ? 'Rutina guardada. Ya la ve en su app.' : 'Rutina guardada.');
      return guardada;
    } catch (e) {
      console.error('[admin-web] guardar rutina:', e);
      toast.error('No se pudo guardar la rutina.');
      return null;
    } finally {
      setGuardando(false);
    }
  }

  async function imprimir() {
    // La hoja de impresión lee la rutina guardada: si hay cambios, primero se guardan.
    if (cambios && !(await guardar())) return;
    window.open(`/socios/${dni}/rutina/imprimir?auto=1`, '_blank');
  }

  async function excel() {
    setBajando(true);
    try {
      await descargarExcel({ rutina, nombreSocio });
    } catch (e) {
      console.error('[admin-web] excel:', e);
      toast.error('No se pudo armar el Excel.');
    } finally {
      setBajando(false);
    }
  }

  function usarPlantilla(p) {
    if (rutina?.dias?.length && !window.confirm(`Se reemplazan los días actuales por los de "${p.nombre}". ¿Seguimos?`)) return;
    cambiar((r) => ({ ...r, nombre: p.nombre || r.nombre, dias: diasDePlantilla(p), plantillaId: p.id }));
    setVerPlantillas(false);
  }

  const totalEjercicios = useMemo(() => (rutina?.dias ?? []).reduce((t, d) => t + (d.ejercicios?.length ?? 0), 0), [rutina]);

  if (cargando || !rutina) {
    return <div className="card p-8 text-center text-sm text-textSecondary">Cargando rutina…</div>;
  }

  return (
    <div className="pb-24">
      <nav className="mb-4 flex items-center gap-2 text-sm text-textSecondary">
        <Link to="/socios" className="hover:text-text">Socios</Link>
        <span className="text-textTertiary/50">/</span>
        <Link to={`/socios/${dni}`} className="hover:text-text">{nombreSocio || `DNI ${dni}`}</Link>
        <span className="text-textTertiary/50">/</span>
        <span className="text-text">Rutina</span>
      </nav>

      <section className="card mb-4 flex flex-col gap-4 p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-text">Rutina de {nombreSocio || `DNI ${dni}`}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-textSecondary">
              <Icon name={cuenta ? 'smartphone' : 'badge'} className="text-base text-cyan" />
              {cuenta
                ? 'Tiene la app: al guardar, la ve en su celular.'
                : 'No tiene la app: se guarda con su DNI. Cuando vincule la app, la va a ver ahí.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setVerPlantillas(true)} className="btn-outline">
              <Icon name="library_books" className="text-lg" /> Usar plantilla
            </button>
            <button onClick={imprimir} disabled={!totalEjercicios || guardando} className="btn-outline" title="Imprimir en la planilla del gym (o guardar como PDF)">
              <Icon name="print" className="text-lg" /> Imprimir
            </button>
            <button onClick={excel} disabled={!totalEjercicios || bajando} className="btn-outline">
              <Icon name="table_view" className="text-lg" /> {bajando ? 'Armando…' : 'Descargar Excel'}
            </button>
            <button onClick={guardar} disabled={!cambios || guardando} className="btn-primary">
              <Icon name="save" className="text-lg" /> {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="label">Nombre de la rutina</span>
            <input className="input" value={rutina.nombre ?? ''} onChange={(e) => cambiar((r) => ({ ...r, nombre: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Objetivos</span>
            <input className="input" placeholder="Ej: Ganar músculo" value={rutina.objetivos ?? ''} onChange={(e) => cambiar((r) => ({ ...r, objetivos: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Observación</span>
            <input className="input" placeholder="Ej: Cuidar la rodilla derecha" value={rutina.observacion ?? ''} onChange={(e) => cambiar((r) => ({ ...r, observacion: e.target.value }))} />
          </label>
        </div>
      </section>

      {rutina.dias.length === 0 ? (
        <section className="card p-6">
          <EmptyState
            icon={<Icon name="fitness_center" className="text-xl" />}
            title="Todavía no tiene rutina"
            description="Agregá un día y sus ejercicios, o usá una plantilla del gym."
          />
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          {rutina.dias.map((d, i) => (
            <Dia
              key={d.id ?? i}
              dia={d}
              indice={i}
              total={rutina.dias.length}
              onNombre={(v) => cambiarDia(i, (x) => { x.nombre = v; })}
              onBorrar={() => {
                if (d.ejercicios?.length && !window.confirm(`¿Borrar el día ${i + 1} con sus ${d.ejercicios.length} ejercicios?`)) return;
                cambiar((r) => { r.dias.splice(i, 1); return r; });
              }}
              onMover={(delta) => cambiar((r) => {
                const [x] = r.dias.splice(i, 1);
                r.dias.splice(i + delta, 0, x);
                return r;
              })}
              onAgregar={() => setElegirPara(i)}
              onEditar={(j) => setEditando({ dia: i, j })}
              onQuitar={(j) => cambiarDia(i, (x) => { x.ejercicios.splice(j, 1); })}
              onReordenar={(desde, hasta) => cambiarDia(i, (x) => { x.ejercicios = arrayMove(x.ejercicios, desde, hasta); })}
            />
          ))}
        </div>
      )}

      <button
        onClick={() => cambiar((r) => { r.dias.push({ id: nuevoId(), nombre: '', ejercicios: [] }); return r; })}
        className="btn-outline mt-4 w-full justify-center"
      >
        <Icon name="add" className="text-lg" /> Agregar día
      </button>

      {/* Barra fija para guardar cuando hay cambios. */}
      {cambios && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-end gap-3 border-t border-border bg-surfaceContainer/95 px-6 py-3 backdrop-blur">
          <span className="text-sm text-textSecondary">Tenés cambios sin guardar</span>
          <button onClick={guardar} disabled={guardando} className="btn-primary">
            <Icon name="save" className="text-lg" /> {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      )}

      {elegirPara != null && (
        <ElegirEjercicio
          onClose={() => setElegirPara(null)}
          onElegir={(ex) => {
            const dia = elegirPara;
            const j = rutina.dias[dia]?.ejercicios?.length ?? 0;
            cambiarDia(dia, (d) => { d.ejercicios.push(ejercicioNuevo(ex)); });
            // Ejercicio que no está en la lista: se abre para ponerle el nombre.
            if (!ex) { setElegirPara(null); setEditando({ dia, j }); }
          }}
        />
      )}

      {editando && rutina.dias[editando.dia]?.ejercicios?.[editando.j] && (
        <EditarEjercicio
          ejercicio={rutina.dias[editando.dia].ejercicios[editando.j]}
          onClose={() => setEditando(null)}
          onGuardar={(campos) => cambiarDia(editando.dia, (d) => { Object.assign(d.ejercicios[editando.j], campos); })}
        />
      )}

      {verPlantillas && <ElegirPlantilla onClose={() => setVerPlantillas(false)} onElegir={usarPlantilla} />}
    </div>
  );
}

// ── Un día de la rutina: tarjetas de ejercicios que se reordenan con la manija,
// como en la app (RoutineEditorScreen). ─────────────────────────────────────
function Dia({ dia, indice, total, onNombre, onBorrar, onMover, onAgregar, onEditar, onQuitar, onReordenar }) {
  const ejercicios = dia.ejercicios ?? [];
  const [arrastrando, setArrastrando] = useState(null);
  const [gif, setGif] = useState(null);
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = ejercicios.map((e, j) => e.id ?? `i${j}`);

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="rounded-lg bg-accent/15 px-2.5 py-1 font-display text-xs font-bold uppercase tracking-caps text-accent">Día {indice + 1}</span>
        <input
          className="input max-w-sm flex-1"
          placeholder="Ej: Pecho y tríceps"
          value={dia.nombre ?? ''}
          onChange={(e) => onNombre(e.target.value)}
        />
        <span className="text-xs text-textSecondary">{ejercicios.length} ejercicio{ejercicios.length === 1 ? '' : 's'}</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => onMover(-1)} disabled={indice === 0} className="btn-ghost btn-sm" title="Subir día"><Icon name="arrow_upward" className="text-base" /></button>
          <button onClick={() => onMover(1)} disabled={indice === total - 1} className="btn-ghost btn-sm" title="Bajar día"><Icon name="arrow_downward" className="text-base" /></button>
          <button onClick={onBorrar} className="btn-danger btn-sm" title="Borrar día"><Icon name="delete" className="text-base" /></button>
        </div>
      </div>

      <DndContext
        sensors={sensores}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragStart={(e) => setArrastrando(e.active.id)}
        onDragCancel={() => setArrastrando(null)}
        onDragEnd={({ active, over }) => {
          setArrastrando(null);
          if (!over || active.id === over.id) return;
          onReordenar(ids.indexOf(active.id), ids.indexOf(over.id));
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2.5">
            {ejercicios.map((e, j) => (
              <TarjetaOrdenable
                key={ids[j]}
                id={ids[j]}
                ejercicio={e}
                onGif={() => setGif(e)}
                onEditar={() => onEditar(j)}
                onQuitar={() => onQuitar(j)}
              />
            ))}
          </div>
        </SortableContext>
        {/* La tarjeta que se lleva con el mouse (o el dedo), flotando. */}
        <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
          {arrastrando != null && (
            <Tarjeta ejercicio={ejercicios[ids.indexOf(arrastrando)]} flotando />
          )}
        </DragOverlay>
      </DndContext>

      <button onClick={onAgregar} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-semibold text-textSecondary transition-colors hover:border-accent hover:text-accent">
        <Icon name="add" className="text-lg" /> Agregar ejercicio
      </button>

      {gif && <VerGif ejercicio={gif} onClose={() => setGif(null)} />}
    </section>
  );
}

function TarjetaOrdenable({ id, ejercicio, onGif, onEditar, onQuitar }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'opacity-0' : ''}
    >
      <Tarjeta
        ejercicio={ejercicio}
        manija={(
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="flex w-9 shrink-0 cursor-grab touch-none items-center justify-center self-stretch rounded-l-xl bg-surfaceHighest/60 text-textTertiary transition-colors hover:text-text active:cursor-grabbing"
            title="Arrastrá para cambiar el orden"
            aria-label="Mover ejercicio"
          >
            <Icon name="drag_indicator" className="text-xl" />
          </button>
        )}
        onGif={onGif}
        onEditar={onEditar}
        onQuitar={onQuitar}
      />
    </div>
  );
}

// Tarjeta de un ejercicio, igual a la de la app: foto (tocá para el GIF),
// nombre, músculo, series · reps · kg · descanso y observación.
function Tarjeta({ ejercicio: e, manija, flotando, onGif, onEditar, onQuitar }) {
  if (!e) return null;
  const grupo = MUSCLE_GROUPS.find((g) => g.id === e.grupoMuscular);
  return (
    <div className={`flex overflow-hidden rounded-xl border bg-surfaceHigh ${flotando ? 'scale-[1.02] border-accent/60 shadow-2xl shadow-black/60' : 'border-border'}`}>
      {manija ?? (
        <div className="flex w-9 shrink-0 items-center justify-center bg-surfaceHighest/60 text-text">
          <Icon name="drag_indicator" className="text-xl" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onGif}
            disabled={!onGif}
            className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white"
            title="Ver cómo se hace"
          >
            <img src={getExerciseImage(e)} alt="" loading="lazy" className="h-full w-full object-contain" />
            {getExerciseGif(e) && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
                <Icon name="play_circle" className="text-2xl" />
              </span>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-text">{e.nombre || 'Ejercicio sin nombre'}</p>
            {grupo && <span className="mt-1 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[0.6875rem] font-bold text-accent">{grupo.label}</span>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={onEditar} disabled={!onEditar} className="rounded-lg p-2 text-accent transition-colors hover:bg-accent/10" title="Editar"><Icon name="edit" className="text-lg" /></button>
            <button onClick={onQuitar} disabled={!onQuitar} className="rounded-lg p-2 text-danger transition-colors hover:bg-danger/10" title="Quitar"><Icon name="delete" className="text-lg" /></button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Pastilla icono="repeat">{e.series || '—'} series</Pastilla>
          <Pastilla icono="fitness_center">{e.repeticiones || '—'} reps</Pastilla>
          {e.carga !== '' && e.carga != null && <Pastilla icono="scale">{String(e.carga).replace('.', ',')} kg</Pastilla>}
          {!!e.descanso && <Pastilla icono="timer">{e.descanso}s</Pastilla>}
        </div>
        {!!e.observaciones && <p className="truncate text-xs italic text-textSecondary">{e.observaciones}</p>}
      </div>
    </div>
  );
}

function Pastilla({ icono, children }) {
  return (
    <span className="num flex items-center gap-1 rounded-full bg-surfaceHighest px-2.5 py-1 text-xs text-textSecondary">
      <Icon name={icono} className="text-sm" /> {children}
    </span>
  );
}

// El GIF grande, como cuando tocás la foto en la app.
function VerGif({ ejercicio, onClose }) {
  const gif = getExerciseGif(ejercicio);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-surfaceContainer shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex aspect-square items-center justify-center bg-white">
          <img src={gif ?? getExerciseImage(ejercicio)} alt={ejercicio.nombre} className="h-full w-full object-contain" />
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="font-semibold text-text">{ejercicio.nombre}</p>
          <button onClick={onClose} className="btn-ghost btn-sm">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// Editar un ejercicio (como la hoja de edición de la app).
function EditarEjercicio({ ejercicio, onClose, onGuardar }) {
  const propio = String(ejercicio.exerciseId ?? '').startsWith('propio_');
  const [f, setF] = useState({
    nombre: ejercicio.nombre ?? '',
    series: ejercicio.series ?? 4,
    repeticiones: ejercicio.repeticiones ?? 12,
    carga: ejercicio.carga ?? '',
    descanso: ejercicio.descanso ?? 90,
    observaciones: ejercicio.observaciones ?? '',
  });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal title={propio ? 'Ejercicio propio' : ejercicio.nombre} onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => { e.preventDefault(); onGuardar(f); onClose(); }}
      >
        {propio && (
          <label className="flex flex-col gap-1">
            <span className="label">Nombre</span>
            <input className="input" autoFocus value={f.nombre} onChange={(e) => set('nombre')(e.target.value)} placeholder="Ej: Remo en máquina" />
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Series"><Numero valor={f.series} onChange={set('series')} autoFocus={!propio} /></Campo>
          <Campo label="Repeticiones"><Numero valor={f.repeticiones} onChange={set('repeticiones')} /></Campo>
          <Campo label="Carga (kg)"><Numero valor={f.carga} decimal placeholder="—" onChange={set('carga')} /></Campo>
          <Campo label="Descanso (s)"><Numero valor={f.descanso} onChange={set('descanso')} /></Campo>
        </div>
        <Campo label="Observación">
          <input className="input" value={f.observaciones} onChange={(e) => set('observaciones')(e.target.value)} placeholder="Ej: Bajar lento" />
        </Campo>
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="submit" className="btn-primary">Listo</button>
        </div>
      </form>
    </Modal>
  );
}

function Campo({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function Numero({ valor, onChange, decimal, placeholder, autoFocus }) {
  return (
    <input
      className="input num text-center"
      inputMode={decimal ? 'decimal' : 'numeric'}
      placeholder={placeholder}
      autoFocus={autoFocus}
      value={valor ?? ''}
      onChange={(e) => {
        const v = e.target.value.replace(',', '.');
        if (v === '' || (decimal ? /^\d*\.?\d*$/ : /^\d*$/).test(v)) onChange(v);
      }}
    />
  );
}

const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const ICONO_GRUPO = {
  pecho: 'fitness_center', espalda: 'arrow_upward', hombros: 'accessibility_new', biceps: 'bolt',
  triceps: 'bolt', piernas: 'directions_walk', core: 'radio_button_unchecked', gluteos: 'favorite', cardio: 'speed',
};

// Buscador de ejercicios, como el de la app: buscá por nombre o elegí un
// músculo; cada ejercicio con su foto (tocala para ver el GIF) y su máquina.
function ElegirEjercicio({ onClose, onElegir }) {
  const [busqueda, setBusqueda] = useState('');
  const [grupo, setGrupo] = useState(null);
  const [agregados, setAgregados] = useState([]);
  const [gif, setGif] = useState(null);

  const texto = busqueda.trim();
  const lista = EXERCISES.filter((e) => (texto
    ? sinTildes(e.nombre).includes(sinTildes(texto)) || sinTildes(e.maquina).includes(sinTildes(texto))
    : grupo && e.grupoMuscular === grupo));
  const mostrar = !!texto || !!grupo;

  const elegir = (ex) => { onElegir(ex); setAgregados((a) => [...a, ex?.id ?? 'propio']); };

  return (
    <Modal title="Agregar ejercicio" onClose={onClose} wide>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surfaceHigh px-3">
          <Icon name="search" className="text-lg text-textTertiary" />
          <input
            className="w-full bg-transparent py-2.5 text-sm text-text outline-none placeholder:text-textTertiary"
            autoFocus
            placeholder="Buscar ejercicio…"
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setGrupo(null); }}
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="text-textTertiary hover:text-text"><Icon name="cancel" className="text-lg" /></button>
          )}
        </div>

        {!texto && (
          <div className="flex flex-wrap gap-1.5">
            {MUSCLE_GROUPS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGrupo((x) => (x === g.id ? null : g.id))}
                className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${grupo === g.id ? 'border-accent bg-accent/15 text-accent' : 'border-transparent bg-surfaceHigh text-textSecondary hover:text-text'}`}
              >
                <Icon name={ICONO_GRUPO[g.id] ?? 'fitness_center'} className="text-sm" /> {g.label}
              </button>
            ))}
          </div>
        )}

        {mostrar ? (
          <div className="max-h-[52vh] overflow-y-auto">
            {lista.map((e) => {
              const veces = agregados.filter((a) => a === e.id).length;
              return (
                <div key={e.id} className="flex items-center gap-3 border-b border-border py-2 last:border-b-0">
                  <button onClick={() => setGif(e)} className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white" title="Ver cómo se hace">
                    <img src={getExerciseImage(e)} alt="" loading="lazy" className="h-full w-full object-contain" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
                      <Icon name="play_circle" className="text-xl" />
                    </span>
                  </button>
                  <button onClick={() => elegir(e)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium text-text">{e.nombre}</p>
                    <p className="text-xs text-textTertiary">{e.maquina}</p>
                  </button>
                  {veces > 0 && <span className="text-xs font-semibold text-accent">✓{veces > 1 ? ` x${veces}` : ''}</span>}
                  <button onClick={() => elegir(e)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent transition-colors hover:bg-accent/25" title="Agregar">
                    <Icon name="add" className="text-lg" />
                  </button>
                </div>
              );
            })}
            {lista.length === 0 && <p className="py-6 text-center text-sm text-textTertiary">Sin resultados</p>}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-textTertiary">Buscá por nombre o elegí una categoría</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <button onClick={() => elegir(null)} className="btn-ghost">
            <Icon name="edit" className="text-lg" /> Ejercicio que no está en la lista
          </button>
          <div className="flex items-center gap-3">
            {agregados.length > 0 && <span className="text-xs text-accent">{agregados.length} agregado{agregados.length === 1 ? '' : 's'}</span>}
            <button onClick={onClose} className="btn-primary">Listo</button>
          </div>
        </div>
      </div>
      {gif && <VerGif ejercicio={gif} onClose={() => setGif(null)} />}
    </Modal>
  );
}

function ElegirPlantilla({ onClose, onElegir }) {
  const [plantillas, setPlantillas] = useState(null);
  useEffect(() => subscribePlantillas(setPlantillas), []);
  return (
    <Modal title="Usar una plantilla del gym" onClose={onClose} wide>
      {plantillas == null ? (
        <p className="text-sm text-textSecondary">Cargando…</p>
      ) : plantillas.length === 0 ? (
        <p className="text-sm text-textSecondary">Todavía no hay plantillas. Se arman desde la app, en Mis clientes → Rutinas del gym.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {plantillas.map((p) => (
            <button key={p.id} onClick={() => onElegir(p)} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surfaceHigh">
              <span>
                <span className="block font-medium text-text">{p.nombre}</span>
                <span className="text-xs text-textSecondary">
                  {(p.dias ?? []).length} días · {(p.dias ?? []).reduce((t, d) => t + (d.ejercicios?.length ?? 0), 0)} ejercicios
                </span>
              </span>
              {p.publicada && <span className="rounded bg-accent/15 px-2 py-0.5 text-[0.6875rem] font-bold uppercase text-accent">Publicada</span>}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
