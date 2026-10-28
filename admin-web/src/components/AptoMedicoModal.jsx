import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';
import {
  getAptoMedico, guardarAptoMedico, cambiarFechasApto, borrarAptoMedico, prepararArchivo,
} from '../services/aptoMedicoService';

// "2026-10-19" ↔ Date (a las 12 del mediodía, así no se corre de día por la
// zona horaria).
const aInput = (d) => (d ? d.toLocaleDateString('sv-SE') : '');
const deInput = (s) => (s ? new Date(`${s}T12:00:00`) : null);
const sumarMeses = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

// Abre el archivo en una pestaña nueva. Chrome no deja abrir un data URL
// directo, así que se pasa a un Blob.
function abrirEnPestana(dataUrl) {
  const [cab, datos] = dataUrl.split(',');
  const tipo = cab.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream';
  const bytes = Uint8Array.from(atob(datos), (c) => c.charCodeAt(0));
  window.open(URL.createObjectURL(new Blob([bytes], { type: tipo })), '_blank');
}

// Cargar, ver, reemplazar o borrar el apto médico de un socio.
export default function AptoMedicoModal({ socio, onClose, onSaved }) {
  const [actual, setActual] = useState(undefined);   // undefined = cargando, null = no tiene
  const [nuevo, setNuevo] = useState(null);          // { archivo, tipo, nombreArchivo } recién elegido
  const [emision, setEmision] = useState(aInput(new Date()));
  const [vence, setVence] = useState(aInput(sumarMeses(new Date(), 12)));
  const [venceAMano, setVenceAMano] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    getAptoMedico(socio.dni).then((a) => {
      setActual(a);
      if (a) {
        setEmision(aInput(a.emision?.toDate?.()));
        setVence(aInput(a.vence?.toDate?.()));
        setVenceAMano(true);
      }
    }).catch(() => setActual(null));
  }, [socio.dni]);

  // El vencimiento sigue a la fecha del certificado (1 año) hasta que lo cambian a mano.
  function cambiarEmision(v) {
    setEmision(v);
    if (!venceAMano && v) setVence(aInput(sumarMeses(deInput(v), 12)));
  }

  async function elegir(file) {
    if (!file) return;
    setError('');
    setPreparando(true);
    try {
      setNuevo(await prepararArchivo(file));
    } catch (e) {
      setError(e.message);
    } finally {
      setPreparando(false);
    }
  }

  const visible = nuevo ?? actual;   // lo que se muestra: lo nuevo, o lo que ya estaba
  const fechasOk = emision && vence && deInput(vence) > deInput(emision);
  const cambiaronFechas = actual && (aInput(actual.emision?.toDate?.()) !== emision || aInput(actual.vence?.toDate?.()) !== vence);
  const puedeGuardar = fechasOk && !guardando && (nuevo || cambiaronFechas);

  async function guardar() {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError('');
    try {
      if (nuevo) {
        await guardarAptoMedico(socio.dni, { ...nuevo, emision: deInput(emision), vence: deInput(vence) });
      } else {
        await cambiarFechasApto(socio.dni, { emision: deInput(emision), vence: deInput(vence) });
      }
      await onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message || 'No se pudo guardar. Probá de nuevo.');
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!confirm('¿Borrar el apto médico de este socio? Va a quedar como "No presentado".')) return;
    setGuardando(true);
    try {
      await borrarAptoMedico(socio.dni);
      await onSaved?.();
      onClose();
    } catch {
      setError('No se pudo borrar. Probá de nuevo.');
      setGuardando(false);
    }
  }

  return (
    <Modal title="Apto médico" onClose={onClose} wide>
      {actual === undefined ? (
        <p className="py-8 text-center text-sm text-textSecondary">Cargando…</p>
      ) : (
        <div className="space-y-5">
          {/* Archivo: vista previa o lugar para subirlo */}
          {visible ? (
            <div className="space-y-2">
              <div className="overflow-hidden rounded-lg border border-border bg-white">
                {visible.tipo === 'pdf' ? (
                  <object data={visible.archivo} type="application/pdf" className="h-96 w-full">
                    <p className="p-4 text-sm text-black">No se puede mostrar el PDF acá. Tocá "Ver grande".</p>
                  </object>
                ) : (
                  <img
                    src={visible.archivo}
                    alt="Apto médico"
                    className="max-h-96 w-full cursor-zoom-in object-contain"
                    onClick={() => abrirEnPestana(visible.archivo)}
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => abrirEnPestana(visible.archivo)} className="btn-outline btn-sm">
                  <Icon name="open_in_new" className="text-base" /> Ver grande
                </button>
                <button onClick={() => inputRef.current?.click()} className="btn-outline btn-sm" disabled={preparando}>
                  <Icon name="upload_file" className="text-base" /> {nuevo ? 'Elegir otro' : 'Reemplazar'}
                </button>
                {nuevo && <span className="text-xs text-accent">Archivo nuevo, todavía sin guardar</span>}
                {!nuevo && actual?.cargadoEn && (
                  <span className="text-xs text-textTertiary">
                    Cargado el {actual.cargadoEn.toDate().toLocaleDateString('es-AR')}
                    {actual.cargadoPor ? ` por ${actual.cargadoPor}` : ''}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files?.[0]); }}
              className={`flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                arrastrando ? 'border-accent bg-accent/5' : 'border-border hover:border-surfaceHighest hover:bg-surfaceLow'
              }`}
            >
              <Icon name={preparando ? 'hourglass_top' : 'add_a_photo'} className="text-3xl text-accent" />
              <span className="font-display text-sm font-bold text-text">
                {preparando ? 'Preparando el archivo…' : 'Subir foto o PDF del certificado'}
              </span>
              <span className="text-xs text-textSecondary">Tocá para elegirlo, o arrastralo acá. Desde el celular podés sacarle una foto.</span>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => { elegir(e.target.files?.[0]); e.target.value = ''; }}
          />

          {/* Fechas */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Fecha del certificado</span>
              <input type="date" className="input" value={emision} onChange={(e) => cambiarEmision(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">Vence</span>
              <input
                type="date"
                className="input"
                value={vence}
                onChange={(e) => { setVence(e.target.value); setVenceAMano(true); }}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-textSecondary">Vence en:</span>
            {[[6, '6 meses'], [12, '1 año']].map(([m, t]) => (
              <button
                key={m}
                type="button"
                onClick={() => { if (emision) { setVence(aInput(sumarMeses(deInput(emision), m))); setVenceAMano(true); } }}
                className="rounded-full border border-border px-2.5 py-1 font-bold text-textSecondary hover:border-accent hover:text-accent"
              >
                {t}
              </button>
            ))}
            {!fechasOk && emision && vence && <span className="text-danger">El vencimiento tiene que ser después de la fecha del certificado.</span>}
          </div>

          {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            {actual ? (
              <button onClick={borrar} disabled={guardando} className="btn-danger btn-sm">
                <Icon name="delete" className="text-base" /> Borrar apto
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-ghost">Cancelar</button>
              <button onClick={guardar} disabled={!puedeGuardar} className="btn-primary disabled:opacity-50">
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
