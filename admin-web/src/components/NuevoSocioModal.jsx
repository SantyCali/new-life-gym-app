import { useEffect, useState } from 'react';
import { createSocio } from '../services/sociosService';
import { getCatalogoPlanes, catalogoGuardado, renovarCuota, anotarPagoEnPlan } from '../services/planesService';
import { getAllConvenios, porcentajeDeConvenio, precioConDescuento } from '../services/conveniosService';
import { registrarMovimiento } from '../services/pagosService';
import { avisarGuardado, avisarError } from '../utils/avisos';
import { inputAFecha, fechaAInput, hoySinHora, sumarMeses } from '../utils/fechas';
import Modal from './Modal';
import NuevoBadge from './NuevoBadge';
import { pagosEsNuevo } from '../utils/novedades';

// nuevo: muestra el cartel "¡Nuevo!" al lado de la etiqueta.
function Campo({ label, nuevo = false, children }) {
  return (
    <label className="block">
      <span className={`label ${nuevo ? 'relative block w-fit pr-14' : ''}`}>{label}<NuevoBadge mostrar={nuevo} /></span>
      {children}
    </label>
  );
}

const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-AR')}`;

// Alta de socio. Va a Firestore y a la fila nueva del Excel en el mismo
// paso, con el nombre completo y el vencimiento que espera la planilla.
// Como en el sistema de la recepción, se puede cargar ya el plan, el
// convenio (con su descuento) y lo que paga: si entrega menos (pago parcial),
// la diferencia queda como deuda en su balance.
export default function NuevoSocioModal({ dniInicial = '', onClose, onCreated }) {
  const [dni, setDni]           = useState(dniInicial);
  const [nombre, setNombre]     = useState('');
  const [apellido, setApellido] = useState('');
  // Por defecto un mes desde hoy: sin fecha, el control de acceso lo dejaría
  // pasar como "al día" para siempre.
  const [vencimiento, setVencimiento] = useState(fechaAInput(sumarMeses(hoySinHora(), 1)));
  const [vencAMano, setVencAMano] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

  const [planes, setPlanes] = useState(catalogoGuardado() ?? []);
  const [convenios, setConvenios] = useState([]);
  const [planId, setPlanId] = useState('');
  const [convenioId, setConvenioId] = useState('');
  const [pagaInput, setPagaInput] = useState(null);   // null = paga el total

  useEffect(() => {
    getCatalogoPlanes().then(setPlanes).catch(() => {});
    getAllConvenios().then((c) => setConvenios(c.filter((x) => x.activo !== false))).catch(() => {});
  }, []);

  const plan = planes.find((p) => p.id === planId) ?? null;
  const convenio = convenios.find((c) => c.id === convenioId) ?? null;
  const pct = convenio ? porcentajeDeConvenio(convenio) : 0;
  const precioLista = Number(plan?.precio) || 0;
  const aPagar = plan ? precioConDescuento(precioLista, pct) : 0;
  const paga = pagaInput == null ? aPagar : Math.max(0, Number(String(pagaInput).replace(/\./g, '').replace(',', '.')) || 0);
  const diferencia = paga - aPagar;   // negativo = queda debiendo

  // Al elegir el plan, el vencimiento sigue a su duración (si no lo cambiaron a mano).
  function elegirPlan(id) {
    setPlanId(id);
    setPagaInput(null);
    const p = planes.find((x) => x.id === id);
    if (p && !vencAMano) setVencimiento(fechaAInput(sumarMeses(hoySinHora(), Number(p.cantidadMeses) || 1)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!dni.trim() || !nombre.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const venc = inputAFecha(vencimiento);
      const { id, excel } = await createSocio(dni, {
        nombre: `${nombre} ${apellido}`.trim(),
        fechaVencimiento: venc,
        tieneConvenio: !!convenio,
        convenioId: convenio?.id ?? null,
      });
      if (plan) {
        // Plan en el historial (desde hoy hasta el vencimiento) y el pago.
        const { entradaId } = await renovarCuota(id, { plan, desde: hoySinHora(), hasta: venc });
        await anotarPagoEnPlan(id, entradaId, { cargo: aPagar, pago: paga });
        await registrarMovimiento(id, {
          cargo: aPagar,
          pago: paga,
          concepto: 'Alta de socio',
          planNombre: plan.nombre,
          precioLista,
          descuentoPct: pct,
        });
      }
      avisarGuardado('Socio creado', excel);
      onCreated(id);
    } catch (err) {
      if (err.message?.startsWith('Ya existe')) setError(err.message);
      else avisarError('No se pudo crear el socio', err);
      setSaving(false);
    }
  }

  return (
    <Modal title="Nuevo socio" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Campo label="DNI">
          <input
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            required
            autoFocus={!dniInicial}
            className="input num"
          />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Nombre">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus={!!dniInicial} className="input" />
          </Campo>
          <Campo label="Apellido">
            <input value={apellido} onChange={(e) => setApellido(e.target.value)} className="input" />
          </Campo>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Plan">
            <select className="input" value={planId} onChange={(e) => elegirPlan(e.target.value)}>
              <option value="">Sin plan (solo la fecha)</option>
              {planes.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} · {pesos(p.precio)}</option>
              ))}
            </select>
          </Campo>
          <Campo label="Convenio" nuevo={pagosEsNuevo()}>
            <select className="input" value={convenioId} onChange={(e) => { setConvenioId(e.target.value); setPagaInput(null); }}>
              <option value="">Sin convenio</option>
              {convenios.map((c) => {
                const p = porcentajeDeConvenio(c);
                return <option key={c.id} value={c.id}>{c.nombre}{p > 0 && !/%/.test(c.nombre) ? ` (−${p}%)` : ''}</option>;
              })}
            </select>
          </Campo>
        </div>

        <Campo label="Vencimiento de cuota">
          <input
            type="date"
            value={vencimiento}
            onChange={(e) => { setVencimiento(e.target.value); setVencAMano(true); }}
            className="input num"
          />
        </Campo>

        {/* Pago: lo que corresponde (con el descuento) y lo que entrega */}
        {plan && (
          <div className="space-y-3 rounded-lg bg-surfaceLowest p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-textSecondary">Precio del plan</span>
              <span className={`num ${pct > 0 ? 'text-textTertiary line-through' : 'font-bold text-text'}`}>{pesos(precioLista)}</span>
            </div>
            {pct > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-cyan">Convenio −{pct.toLocaleString('es-AR')}%</span>
                <span className="num font-bold text-text">{pesos(aPagar)}</span>
              </div>
            )}
            <div className="flex items-end gap-3">
              <label className="block flex-1">
                <span className="label">Paga ahora</span>
                <input
                  className="input num text-lg font-bold"
                  inputMode="numeric"
                  value={pagaInput ?? String(aPagar)}
                  onChange={(e) => setPagaInput(e.target.value.replace(/[^0-9.,]/g, ''))}
                />
              </label>
              <button type="button" onClick={() => setPagaInput(null)} className="btn-outline btn-sm mb-0.5">Total</button>
              <button type="button" onClick={() => setPagaInput('0')} className="btn-ghost btn-sm mb-0.5">No paga</button>
            </div>
            <p className={`text-sm font-bold ${diferencia < 0 ? 'text-danger' : diferencia > 0 ? 'text-cyan' : 'text-accent'}`}>
              {diferencia < 0
                ? `Pago parcial: queda debiendo ${pesos(-diferencia)}`
                : diferencia > 0
                  ? `Queda a favor ${pesos(diferencia)}`
                  : 'Paga el total: queda sin deuda'}
            </p>
          </div>
        )}

        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <p className="text-xs text-textTertiary">
          Se agrega también como fila nueva en el Excel.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Creando...' : 'Crear socio'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
