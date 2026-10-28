import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSocios } from '../context/SociosContext';
import { movimientosRecientes, getPlanCargado, volverAlPlanAnterior } from '../services/planesService';
import { avisarGuardado, avisarError } from '../utils/avisos';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';

// Altas y renovaciones de los últimos días, todo junto y resumido: quién se
// sumó, a quién se le renovó o cambió el plan, quién pagó su deuda, cuándo y
// quién lo cargó. Si a alguien se le cargó el plan por error (le pasó a uno de
// los chicos con otro alumno), "Volver al plan anterior" lo deja como estaba.
const RANGOS = [3, 5, 7, 15];
const MAX_DIAS = Math.max(...RANGOS);

// Se busca una vez el rango más largo y los otros salen de ahí al instante.
// Queda guardado en el navegador: si se buscó hace menos de FRESCO_MS no se
// vuelve a leer nada (ni recargando la página). Cuida el cupo diario de
// lecturas de Firestore. Para buscar de nuevo, "Actualizar".
const CLAVE = 'altasRenovaciones_v2';
const FRESCO_MS = 10 * 60 * 1000;
function leerGuardado() {
  try { return JSON.parse(localStorage.getItem(CLAVE) ?? 'null'); } catch { return null; }
}
function guardar(items) {
  const g = { en: Date.now(), items };
  try { localStorage.setItem(CLAVE, JSON.stringify(g)); } catch {}
  return g;
}

const TIPOS = {
  alta:       { label: 'Nuevo',          color: 'bg-accent/15 text-accent',       icono: 'person_add' },
  renovacion: { label: 'Renovó',         color: 'bg-cyan/15 text-cyan',           icono: 'event_repeat' },
  cambio:     { label: 'Cambió de plan', color: 'bg-[#ff9f1a]/15 text-[#ff9f1a]', icono: 'swap_horiz' },
  primero:    { label: 'Primer plan',    color: 'bg-cyan/15 text-cyan',           icono: 'add_card' },
  pago:       { label: 'Pagó la deuda',  color: 'bg-accent/15 text-accent',       icono: 'payments' },
};

const fechaHora = (ms) => new Date(ms).toLocaleString('es-AR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-AR')}`;
const haceCuanto = (ms) => {
  const min = Math.round((Date.now() - ms) / 60000);
  return min < 1 ? 'recién' : min < 60 ? `hace ${min} min` : `hace ${Math.round(min / 60)} h`;
};

export default function MovimientosPage() {
  const { socios, loading } = useSocios();
  const [dias, setDias] = useState(5);
  const [filtro, setFiltro] = useState('todos');
  const [guardado, setGuardado] = useState(leerGuardado);   // { en, items } o null
  const [progreso, setProgreso] = useState(null);           // { hechos, total } mientras busca
  const [volviendo, setVolviendo] = useState(null);

  const buscar = useCallback((conBarra) => {
    if (loading) return;
    setProgreso(conBarra ? { hechos: 0, total: 0 } : null);
    movimientosRecientes(socios, MAX_DIAS, conBarra ? (hechos, total) => setProgreso({ hechos, total }) : undefined)
      .then((items) => setGuardado(guardar(items)))
      .catch((err) => avisarError('No se pudo buscar', err))
      .finally(() => setProgreso(null));
    // socios cambia en vivo; se busca al entrar (si no hay nada fresco) o con "Actualizar".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    const g = leerGuardado();
    if (!g || Date.now() - g.en > FRESCO_MS) buscar(!g);
  }, [buscar]);

  const porDni = useMemo(() => new Map(socios.map((s) => [s.dni, s])), [socios]);
  const desde = Date.now() - dias * 24 * 60 * 60 * 1000;

  // Todo en una sola lista, lo más nuevo arriba.
  const items = useMemo(() => {
    const altas = socios
      .filter((s) => (s.creadoEn?.toMillis?.() ?? 0) >= desde)
      .map((s) => ({ key: `alta-${s.dni}`, tipo: 'alta', socio: s, cuando: s.creadoEn.toMillis() }));
    const otros = (guardado?.items ?? [])
      .filter((m) => m.cuando >= desde && porDni.has(m.dni))
      .map((m) => {
        const socio = porDni.get(m.dni);
        if (m.tipo === 'pago') return { key: `pago-${m.dni}-${m.id}`, tipo: 'pago', socio, cuando: m.cuando, pago: m };
        // Sin plan anterior guardado: el historial de planes del panel es nuevo,
        // así que un socio que ya existía en realidad renovó. 'Primer plan' solo
        // si el socio se creó ese mismo día (alta con plan).
        const tipo = !m.anterior
          ? (Math.abs((socio.creadoEn?.toMillis?.() ?? 0) - m.cuando) < 24 * 60 * 60 * 1000 ? 'primero' : 'renovacion')
          : m.anterior === m.nombrePlan ? 'renovacion' : 'cambio';
        return { key: `plan-${m.dni}-${m.id}`, tipo, socio, cuando: m.cuando, entrada: m };
      });
    return [...altas, ...otros].sort((a, b) => b.cuando - a.cuando);
  }, [socios, guardado, desde, porDni]);

  const grupo = (t) => (t === 'renovacion' ? ['renovacion', 'primero'] : [t]);
  const visibles = filtro === 'todos' ? items : items.filter((i) => grupo(filtro).includes(i.tipo));
  const cuenta = (t) => items.filter((i) => grupo(t).includes(i.tipo)).length;

  async function volver(item) {
    const e = item.entrada;
    const texto = e.anterior
      ? `¿Volver a ${item.socio.nombre} al plan anterior (${e.anterior})? Se borra "${e.nombrePlan}", el vencimiento vuelve a como estaba${e.pago?.pago ? ' y se anula el pago' : ''}.`
      : `¿Sacarle a ${item.socio.nombre} el plan "${e.nombrePlan}"? El vencimiento vuelve a como estaba${e.pago?.pago ? ' y se anula el pago' : ''}.`;
    if (!confirm(texto)) return;
    setVolviendo(item.key);
    try {
      // Se lee el plan en el momento: lo guardado en el navegador es solo para mostrar.
      const entrada = await getPlanCargado(item.socio.dni, e.id);
      if (!entrada) throw new Error('Ese plan ya no está (¿se volvió atrás antes?).');
      const { excel } = await volverAlPlanAnterior(item.socio.dni, entrada);
      avisarGuardado(`${item.socio.nombre} quedó como estaba antes`, excel);
      buscar(false);
    } catch (err) {
      avisarError('No se pudo volver al plan anterior', err);
    } finally {
      setVolviendo(null);
    }
  }

  // Lo que pagó con el plan, y si todavía debe (con el balance de ahora: si
  // después pagó la deuda, ya no se marca en rojo).
  function textoPago(item) {
    const p = item.entrada.pago;
    if (!p || (!p.cargo && !p.pago)) return null;
    if (p.pago >= p.cargo) return <span className="text-accent">pagó {pesos(p.pago)}</span>;
    const debeAhora = (Number(item.socio.balance) || 0) < 0;
    return debeAhora
      ? <span className="text-danger">pagó {pesos(p.pago)}, debe {pesos(p.cargo - p.pago)}</span>
      : <span className="text-accent">pagó {pesos(p.pago)} · deuda saldada ✓</span>;
  }

  const renderFila = (item) => {
    const t = TIPOS[item.tipo];
    const e = item.entrada;
    return (
      <div key={item.key} className="flex flex-col gap-3 rounded-xl bg-surfaceLow p-3 sm:flex-row sm:items-center">
        <Link to={`/socios/${item.socio.dni}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar nombre={item.socio.nombre} apellido={item.socio.apellido} foto={item.socio.fotoBase64 ?? item.socio.fotoApp} size="md" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-display text-sm font-bold text-text hover:underline">{item.socio.nombre}</span>
              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-display text-[0.6875rem] font-bold uppercase tracking-caps ${t.color}`}>
                <Icon name={t.icono} className="text-sm" /> {t.label}
              </span>
            </div>
            <p className="num truncate text-xs text-textSecondary">
              DNI {item.socio.dni} · {fechaHora(item.cuando)}
              {(e?.cargadoPor || item.pago?.cargadoPor) ? ` · lo cargó ${e?.cargadoPor || item.pago.cargadoPor}` : ''}
            </p>
            {e && (
              <p className="truncate text-xs text-text">
                {item.tipo === 'cambio' && <><span className="text-textTertiary line-through">{e.anterior}</span> → </>}
                <strong>{e.nombrePlan}</strong>
                {e.vence && <> · vence {new Date(e.vence).toLocaleDateString('es-AR')}</>}
                {textoPago(item) && <> · {textoPago(item)}</>}
              </p>
            )}
            {item.pago && (
              <p className="truncate text-xs text-text">
                <strong className="text-accent">Pagó {pesos(item.pago.monto)}</strong>
                {item.pago.concepto ? ` · ${item.pago.concepto}` : ''}
                {(Number(item.socio.balance) || 0) >= 0 ? ' · sin deuda ✓' : ` · todavía debe ${pesos(-item.socio.balance)}`}
              </p>
            )}
          </div>
        </Link>
        {e && (
          e.deshacible ? (
            <button
              onClick={() => volver(item)}
              disabled={volviendo === item.key}
              className="btn-outline btn-sm shrink-0"
              title="Si se le cargó por error: borra este plan y lo deja como estaba"
            >
              <Icon name="undo" className="text-base" />
              {volviendo === item.key ? 'Volviendo…' : 'Volver al plan anterior'}
            </button>
          ) : (
            <Link to={`/socios/${item.socio.dni}`} className="btn-ghost btn-sm shrink-0" title="Este cambio es de antes y no guardó cómo estaba: se corrige desde la ficha">
              <Icon name="edit" className="text-base" /> Corregir en la ficha
            </Link>
          )
        )}
      </div>
    );
  };

  const cargandoPrimeraVez = !guardado;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text">Altas y renovaciones</h1>
          <p className="mt-1 text-sm text-textSecondary">
            Socios nuevos, planes renovados o cambiados y deudas pagadas en los últimos {dias} días, con quién lo cargó.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-textSecondary">Últimos</span>
          {RANGOS.map((d) => (
            <button
              key={d}
              onClick={() => setDias(d)}
              className={`btn-sm btn ${dias === d ? 'bg-accent text-onAccent' : 'bg-surfaceHigh text-text hover:bg-surfaceHighest'}`}
            >
              {d} días
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {[
          ['todos', 'Todos'],
          ['alta', 'Nuevos'],
          ['renovacion', 'Renovaciones'],
          ['cambio', 'Cambios de plan'],
          ['pago', 'Pagos de deuda'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFiltro(id)}
            className={`rounded-full border px-3 py-1.5 font-display text-sm font-bold transition-colors ${
              filtro === id ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-surfaceHigh text-textSecondary hover:text-text'
            }`}
          >
            {label} <span className="num ml-1 opacity-70">{cargandoPrimeraVez && id !== 'alta' ? '…' : (id === 'todos' ? items.length : cuenta(id))}</span>
          </button>
        ))}
        {guardado && (
          <span className="ml-auto flex items-center gap-2 text-xs text-textTertiary">
            Actualizado {haceCuanto(guardado.en)}
            <button onClick={() => buscar(false)} disabled={!!progreso || loading} className="btn-ghost btn-sm">
              <Icon name="refresh" className="text-base" /> Actualizar
            </button>
          </span>
        )}
      </div>

      {/* Primera búsqueda: barra de progreso. */}
      {progreso && (
        <div className="card flex flex-col gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-accent/15">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
              <Icon name="manage_search" className="relative text-xl text-accent" />
            </span>
            <div className="flex-1">
              <p className="font-display text-sm font-bold text-text">Buscando altas y renovaciones…</p>
              <p className="num text-xs text-textSecondary">
                {progreso.total ? `Revisando socios: ${progreso.hechos} de ${progreso.total}` : 'Preparando…'}
              </p>
            </div>
            {progreso.total > 0 && (
              <span className="num font-display text-lg font-extrabold text-accent">
                {Math.round((progreso.hechos / progreso.total) * 100)}%
              </span>
            )}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surfaceLowest">
            <div
              className="barra-carga h-full rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${progreso.total ? Math.max(4, (progreso.hechos / progreso.total) * 100) : 4}%` }}
            />
          </div>
        </div>
      )}

      <section className="card p-4">
        {cargandoPrimeraVez ? (
          <div className="flex flex-col gap-2">
            {/* Mientras carga se ven las altas (son instantáneas) y tarjetas que brillan. */}
            {visibles.filter((i) => i.tipo === 'alta').map(renderFila)}
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="brillo flex items-center gap-3 rounded-xl bg-surfaceLow p-3" style={{ animationDelay: `${i * 120}ms` }}>
                <span className="h-10 w-10 shrink-0 rounded-full bg-surfaceHigh" />
                <span className="flex flex-1 flex-col gap-2">
                  <span className="h-3 w-1/3 rounded bg-surfaceHigh" />
                  <span className="h-2.5 w-1/2 rounded bg-surfaceHigh" />
                </span>
              </div>
            ))}
          </div>
        ) : visibles.length === 0 ? (
          <EmptyState title={`No hubo movimientos en los últimos ${dias} días`} />
        ) : (
          <div className="flex flex-col gap-2">{visibles.map(renderFila)}</div>
        )}
      </section>
    </div>
  );
}
