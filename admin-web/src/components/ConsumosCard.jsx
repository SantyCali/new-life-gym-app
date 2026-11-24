import { useEffect, useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';
import NuevoBadge from './NuevoBadge';
import { avisarGuardado, avisarError } from '../utils/avisos';
import { consumosEsNuevo } from '../utils/novedades';
import {
  getProductos, guardarProductos, anotarConsumo, getNota, guardarNota,
} from '../services/consumosService';

const pesos = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;
// "1.500" o "1500,50" → número (el punto es de miles).
const aNumero = (v) => Number(String(v).replace(/\./g, '').replace(',', '.')) || 0;

// Tarjeta de la ficha del socio: lo que saca del gym (agua, Powerade,
// Gatorade…) y su notita. Si lo debe se suma a la deuda (ver consumosService).
export default function ConsumosCard({ socio }) {
  const [productos, setProductos] = useState(null);
  const [carrito, setCarrito] = useState([]); // [{ nombre, precio, cantidad }]
  const [otro, setOtro] = useState(null);     // { nombre, precio } mientras se escribe
  const [guardando, setGuardando] = useState(false);
  const [showPrecios, setShowPrecios] = useState(false);

  useEffect(() => { getProductos().then(setProductos).catch(() => setProductos([])); }, []);

  const total = carrito.reduce((s, it) => s + it.precio * it.cantidad, 0);
  const cantidadDe = (nombre) => carrito.find((it) => it.nombre === nombre)?.cantidad ?? 0;

  function sumar(item, delta = 1) {
    setCarrito((c) => {
      const i = c.findIndex((it) => it.nombre === item.nombre && it.precio === item.precio);
      if (i === -1) return delta > 0 ? [...c, { ...item, cantidad: delta }] : c;
      return c.map((it, j) => (j === i ? { ...it, cantidad: it.cantidad + delta } : it)).filter((it) => it.cantidad > 0);
    });
  }

  function tocarProducto(p) {
    // Sin precio no se puede anotar: primero se carga el precio.
    if (!(p.precio > 0)) { setShowPrecios(true); return; }
    sumar(p);
  }

  function agregarOtro(e) {
    e.preventDefault();
    const nombre = (otro?.nombre ?? '').trim();
    const precio = Math.round(aNumero(otro?.precio));
    if (!nombre || precio <= 0) return;
    sumar({ nombre, precio });
    setOtro(null);
  }

  async function anotar(pagaAhora) {
    setGuardando(true);
    try {
      const t = await anotarConsumo(socio.dni, carrito, pagaAhora);
      avisarGuardado(pagaAhora ? `Anotado: pagó ${pesos(t)}` : `Anotado: ${pesos(t)} a la deuda`);
      setCarrito([]);
    } catch (error) {
      avisarError('No se pudo anotar', error);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="card flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center font-display text-[0.6875rem] font-bold uppercase tracking-caps text-textSecondary">
          Consumos
          <NuevoBadge mostrar={consumosEsNuevo()} enLinea />
        </span>
        <button onClick={() => setShowPrecios(true)} className="flex items-center gap-1 font-display text-xs font-bold text-cyan hover:underline">
          <Icon name="sell" className="text-sm" /> Precios
        </button>
      </div>

      {productos == null ? (
        <p className="text-sm text-textTertiary">Cargando…</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {productos.map((p) => {
            const n = cantidadDe(p.nombre);
            return (
              <button
                key={p.nombre}
                onClick={() => tocarProducto(p)}
                title={p.precio > 0 ? `Sumar 1 ${p.nombre}` : 'Cargale el precio primero'}
                className={`relative flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2.5 transition-colors ${n ? 'border-accent bg-accent/10' : 'border-border bg-surfaceLowest hover:bg-surfaceHigh'}`}
              >
                <span className="truncate font-display text-xs font-bold text-text">{p.nombre}</span>
                <span className={`num text-[0.6875rem] ${p.precio > 0 ? 'text-textSecondary' : 'text-[#ff9f1a]'}`}>
                  {p.precio > 0 ? pesos(p.precio) : 'sin precio'}
                </span>
                {n > 0 && (
                  <span className="num absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[0.6875rem] font-bold text-onAccent">
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {otro ? (
        <form onSubmit={agregarOtro} className="flex items-end gap-2">
          <label className="block flex-1">
            <span className="label">Otra cosa</span>
            <input className="input" autoFocus placeholder="Ej: barrita" value={otro.nombre}
              onChange={(e) => setOtro({ ...otro, nombre: e.target.value })} />
          </label>
          <label className="block w-24">
            <span className="label">Precio</span>
            <input className="input num" inputMode="numeric" placeholder="0" value={otro.precio}
              onChange={(e) => setOtro({ ...otro, precio: e.target.value.replace(/[^0-9.,]/g, '') })} />
          </label>
          <button type="submit" className="btn-outline btn-sm mb-0.5">Sumar</button>
          <button type="button" onClick={() => setOtro(null)} className="btn-ghost btn-sm mb-0.5" aria-label="Cancelar">
            <Icon name="close" className="text-base" />
          </button>
        </form>
      ) : (
        <button onClick={() => setOtro({ nombre: '', precio: '' })} className="flex w-fit items-center gap-1 font-display text-xs font-bold text-cyan hover:underline">
          <Icon name="add" className="text-sm" /> Otra cosa
        </button>
      )}

      {carrito.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-surfaceLowest p-3">
          {carrito.map((it) => (
            <div key={`${it.nombre}-${it.precio}`} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-text">
                <span className="num font-bold">{it.cantidad}</span> × {it.nombre}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="num text-textSecondary">{pesos(it.precio * it.cantidad)}</span>
                <button onClick={() => sumar(it, -1)} className="rounded p-0.5 text-textTertiary hover:bg-surfaceHigh hover:text-text" aria-label={`Sacar 1 ${it.nombre}`}>
                  <Icon name="remove" className="text-base" />
                </button>
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="font-display text-xs font-bold uppercase tracking-caps text-textSecondary">Total</span>
            <span className="num font-display text-base font-bold text-text">{pesos(total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => anotar(true)} disabled={guardando} className="btn-outline btn-sm justify-center">
              <Icon name="payments" className="text-base" /> Pagó
            </button>
            <button onClick={() => anotar(false)} disabled={guardando} className="btn-sm btn justify-center bg-danger/15 text-danger hover:bg-danger/25">
              <Icon name="edit_note" className="text-base" /> Lo debe
            </button>
          </div>
        </div>
      )}

      <NotaSocio dni={socio.dni} />

      {showPrecios && (
        <PreciosModal
          productos={productos ?? []}
          onClose={() => setShowPrecios(false)}
          onGuardado={(lista) => { setProductos(lista); setShowPrecios(false); }}
        />
      )}
    </section>
  );
}

// Notita libre del socio ("debe 2 aguas del martes", "trae la plata el
// viernes"…). Solo la ven los entrenadores.
function NotaSocio({ dni }) {
  const [nota, setNota] = useState(null); // lo guardado
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    getNota(dni)
      .then((n) => { if (vivo) { setNota(n ?? { texto: '' }); setTexto(n?.texto ?? ''); } })
      .catch(() => vivo && setNota({ texto: '' }));
    return () => { vivo = false; };
  }, [dni]);

  const cambio = nota != null && texto.trim() !== (nota.texto ?? '');

  async function guardar() {
    setGuardando(true);
    try {
      await guardarNota(dni, texto);
      setNota({ texto: texto.trim(), editadoEn: { toDate: () => new Date() } });
      avisarGuardado('Nota guardada');
    } catch (error) {
      avisarError('No se pudo guardar la nota', error);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-3">
      <span className="label !mb-0">Nota (solo la ven los entrenadores)</span>
      <textarea
        className="input min-h-[4.5rem] resize-y text-sm"
        placeholder={nota == null ? 'Cargando…' : 'Ej: debe 2 aguas del martes, trae la plata el viernes'}
        disabled={nota == null}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="num text-[0.6875rem] text-textTertiary">
          {nota?.editadoEn?.toDate && nota.texto ? `Editada el ${nota.editadoEn.toDate().toLocaleDateString('es-AR')}` : ''}
        </span>
        {cambio && (
          <button onClick={guardar} disabled={guardando} className="btn-primary btn-sm">
            {guardando ? 'Guardando…' : 'Guardar nota'}
          </button>
        )}
      </div>
    </div>
  );
}

// Productos y precios (para todos los socios y todos los entrenadores).
function PreciosModal({ productos, onClose, onGuardado }) {
  const [lista, setLista] = useState(() => productos.map((p) => ({ nombre: p.nombre, precio: p.precio ? String(p.precio) : '' })));
  const [guardando, setGuardando] = useState(false);

  const cambiar = (i, campo, valor) => setLista((l) => l.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)));

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      const guardada = await guardarProductos(lista.map((p) => ({ nombre: p.nombre, precio: aNumero(p.precio) })));
      avisarGuardado('Precios guardados');
      onGuardado(guardada);
    } catch (error) {
      avisarError('No se pudieron guardar los precios', error);
      setGuardando(false);
    }
  }

  return (
    <Modal title="Productos y precios" onClose={onClose}>
      <form onSubmit={guardar} className="space-y-4">
        <p className="text-xs text-textSecondary">Valen para todos los socios. Lo que ya se anotó queda con el precio de ese día.</p>
        <div className="space-y-2">
          {lista.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className="input flex-1" placeholder="Producto" value={p.nombre}
                onChange={(e) => cambiar(i, 'nombre', e.target.value)} />
              <div className="relative w-28">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-textTertiary">$</span>
                <input className="input num pl-6" inputMode="numeric" placeholder="0" value={p.precio}
                  onChange={(e) => cambiar(i, 'precio', e.target.value.replace(/[^0-9.,]/g, ''))} />
              </div>
              <button type="button" onClick={() => setLista((l) => l.filter((_, j) => j !== i))}
                className="rounded-lg p-2 text-textTertiary hover:bg-surfaceHigh hover:text-danger" aria-label={`Quitar ${p.nombre}`}>
                <Icon name="delete" className="text-base" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setLista((l) => [...l, { nombre: '', precio: '' }])}
          className="flex items-center gap-1 font-display text-xs font-bold text-cyan hover:underline">
          <Icon name="add" className="text-sm" /> Agregar producto
        </button>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="submit" disabled={guardando} className="btn-primary">{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  );
}
