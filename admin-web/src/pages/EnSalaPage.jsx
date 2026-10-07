import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSocios } from '../context/SociosContext';
import { useIngresos } from '../context/IngresosContext';
import { ESTADOS, entroVencido, etiquetaEstado } from '../services/estadoCuota';
import { toast } from 'react-toastify';
import {
  filtrarEnSala, estadoAforo, agruparPorHora, marcarSalida, deshacerSalida,
} from '../services/asistenciasService';
import { avisarError } from '../utils/avisos';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import LiveDot from '../components/LiveDot';
import StatCard from '../components/StatCard';
import RegistrarIngresoModal from '../components/RegistrarIngresoModal';
import VencidosHoyModal from '../components/VencidosHoyModal';
import { Skeleton } from '../components/Skeleton';

// Misma ventana que la app mobile: a los 90 min el ingreso deja de contar.
const VENTANA_MIN = 90;
// Tope visual del medidor: por encima de esto ya es "Lleno" de sobra.
const ESCALA_MAX = 30;

export default function EnSalaPage() {
  const { socios } = useSocios();
  const { ingresos, ahora, actualizadoEn } = useIngresos();
  const [busqueda, setBusqueda] = useState('');
  const [showRegistrar, setShowRegistrar] = useState(false);
  const [showVencidos, setShowVencidos]   = useState(false);

  const porDni = useMemo(() => new Map(socios.map((s) => [s.dni, s])), [socios]);

  if (!ingresos) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const enSala   = filtrarEnSala(ingresos, ahora);
  const aforo    = estadoAforo(enSala.length);
  const adentro  = new Set(enSala.map((i) => i.id));
  const vencidos = ingresos.filter((i) => entroVencido(i, porDni.get(i.dni))).length;

  const porHora = agruparPorHora(ingresos);
  const maxHora = Math.max(...porHora);
  const pico    = maxHora > 0 ? porHora.indexOf(maxHora) : null;

  const term = busqueda.trim().toLowerCase();
  const listaDelDia = ingresos.filter((i) =>
    !term || (i.nombre ?? '').toLowerCase().includes(term) || (i.dni ?? '').includes(term));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <LiveDot color={aforo.color} />
            <span className="font-display text-[0.6875rem] font-bold uppercase tracking-caps" style={{ color: aforo.color }}>
              En vivo
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-text">En sala</h1>
          <p className="mt-1 text-sm text-textSecondary">
            Quién está entrenando ahora. Cada ingreso cuenta durante {VENTANA_MIN} minutos, igual que en la app.
          </p>
        </div>
        <button onClick={() => setShowRegistrar(true)} className="btn-primary">
          <Icon name="how_to_reg" className="text-lg" />
          Registrar ingreso
        </button>
      </header>

      <Medidor cantidad={enSala.length} aforo={aforo} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="En sala ahora" value={enSala.length} unidad="personas" icono="fitness_center"
          variant={aforo.id} liveColor={aforo.color} actualizadoEn={actualizadoEn} />
        <StatCard label="Ingresos hoy" value={ingresos.length} unidad="en el día" icono="login" />
        <StatCard label="Entraron vencidos" value={vencidos} unidad="hoy · ver quiénes" icono="warning"
          variant={vencidos > 0 ? 'danger' : 'neutral'} onClick={() => setShowVencidos(true)} />
        <StatCard label="Hora pico" value={pico != null ? `${pico}h` : '—'} icono="schedule"
          unidad={pico != null ? `${maxHora} ingresos` : null} />
      </div>

      <section className="card p-5">
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <Icon name="fitness_center" className="text-lg" />
            <h2 className="text-base font-bold text-text">Entrenando ahora</h2>
            <span className="rounded-full px-2 py-0.5 font-display text-[0.6875rem] font-bold"
              style={{ backgroundColor: `${aforo.color}26`, color: aforo.color }}>
              {enSala.length}
            </span>
          </div>
        </div>

        {enSala.length === 0 ? (
          <EmptyState
            icon={<Icon name="self_improvement" className="text-xl" />}
            title="No hay nadie en sala"
            description="Cuando alguien ingrese por el control de acceso va a aparecer acá al instante."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {enSala.map((i) => (
              <PersonaEnSala key={i.id} ingreso={i} socio={porDni.get(i.dni)} ahora={ahora} />
            ))}
          </div>
        )}
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div className="flex items-center gap-2">
            <Icon name="door_sliding" className="text-lg text-accent" />
            <h2 className="text-base font-bold text-text">Todos los ingresos de hoy</h2>
          </div>
          <div className="relative w-full max-w-xs">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-textTertiary">
              <Icon name="search" className="text-base" />
            </span>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o DNI..."
              aria-label="Buscar ingreso"
              className="input pl-10"
            />
          </div>
        </div>

        {listaDelDia.length === 0 ? (
          <EmptyState title={term ? 'Sin resultados' : 'Todavía no hubo ingresos hoy'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="font-display text-[0.6875rem] uppercase tracking-caps text-textSecondary">
                <tr>
                  <th scope="col" className="px-3 py-2 font-bold">Hora</th>
                  <th scope="col" className="px-3 py-2 font-bold">Socio</th>
                  <th scope="col" className="px-3 py-2 font-bold">Al ingresar</th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">Ahora</th>
                </tr>
              </thead>
              <tbody>
                {listaDelDia.map((i) => {
                  const socio = porDni.get(i.dni);
                  const esta  = adentro.has(i.id);
                  return (
                    <tr key={i.id} className="border-t border-border transition-colors hover:bg-surfaceHigh">
                      <td className="num px-3 py-2.5 font-display font-bold text-accent">{hora(i.fechaHora)}</td>
                      <td className="px-3 py-2.5">
                        <Link to={`/socios/${i.dni}`} className="flex items-center gap-2.5 hover:text-accent">
                          <Avatar nombre={socio?.nombre ?? i.nombre ?? '?'} apellido={socio?.apellido}
                            foto={socio?.fotoBase64 ?? socio?.fotoApp} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-display font-bold text-text">{i.nombre}</p>
                            <p className="num text-xs text-textTertiary">DNI {i.dni}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        {/* Estado de cuota que registró el control de acceso al momento de entrar. */}
                        {i.estado === 'VENCIDO'
                          ? <Badge variant="danger">Vencido</Badge>
                          : i.estado === 'manual'
                            ? (entroVencido(i, socio)
                              ? <Badge variant="danger">Manual · vencido</Badge>
                              : <Badge variant="neutral">Carga manual</Badge>)
                            : <Badge variant="success">Al día</Badge>}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {esta ? (
                          <span className="inline-flex items-center gap-1.5 font-display text-[0.6875rem] font-bold uppercase tracking-caps text-[#22C55E]">
                            <LiveDot color="#22C55E" size="sm" />
                            En sala
                          </span>
                        ) : (
                          <span className="font-display text-[0.6875rem] font-bold uppercase tracking-caps text-textTertiary">
                            {i.activo === false && i.salidaEn ? `Salió ${hora(i.salidaEn)}` : 'Se fue'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showRegistrar && <RegistrarIngresoModal onClose={() => setShowRegistrar(false)} />}
      {showVencidos && (
        <VencidosHoyModal ingresos={ingresos} porDni={porDni} onClose={() => setShowVencidos(false)} />
      )}
    </div>
  );
}

// Barra con los tramos de la app (tranquilo / moderado / lleno) y una aguja
// en la cantidad actual, para ver de un vistazo qué tan cerca está de llenarse.
function Medidor({ cantidad, aforo }) {
  const pos = Math.min(cantidad / ESCALA_MAX, 1) * 100;
  const tramo = (hasta) => `${(hasta / ESCALA_MAX) * 100}%`;

  return (
    <section className="card relative overflow-hidden p-6">
      <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full blur-3xl"
        style={{ backgroundColor: `${aforo.color}22` }} />

      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-[0.6875rem] font-bold uppercase tracking-caps text-textSecondary">
            Estado del gimnasio
          </p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="kpi text-6xl" style={{ color: aforo.color }}>{cantidad}</span>
            <span className="font-display text-2xl font-extrabold" style={{ color: aforo.color }}>
              {aforo.label}
            </span>
          </div>
        </div>
        <p className="text-sm text-textSecondary">
          {cantidad === 0
            ? 'El gym está vacío ahora mismo.'
            : `${cantidad === 1 ? 'Hay 1 persona' : `Hay ${cantidad} personas`} entrenando.`}
        </p>
      </div>

      <div className="relative mt-6">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-surfaceLowest">
          <div style={{ width: tramo(14), backgroundColor: '#22C55E' }} className="opacity-70" />
          <div style={{ width: `calc(${tramo(21)} - ${tramo(14)})`, backgroundColor: '#EAB308' }} className="opacity-70" />
          <div className="flex-1 opacity-70" style={{ backgroundColor: '#EF4444' }} />
        </div>
        <div
          className="absolute -top-1.5 h-5 w-1.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] transition-all duration-700"
          style={{ left: `${pos}%` }}
        />
        <div className="relative mt-2 h-4 font-mono text-[10px] text-textTertiary">
          <span className="absolute left-0">0</span>
          <span className="absolute -translate-x-1/2" style={{ left: tramo(14) }}>14</span>
          <span className="absolute -translate-x-1/2" style={{ left: tramo(21) }}>21</span>
          <span className="absolute right-0">{ESCALA_MAX}+</span>
        </div>
      </div>
    </section>
  );
}

function PersonaEnSala({ ingreso, socio, ahora }) {
  const entro   = ingreso.fechaHora?.toMillis?.() ?? ahora;
  const minutos = Math.max(0, Math.floor((ahora - entro) / 60000));
  const restan  = Math.max(0, VENTANA_MIN - minutos);
  const estado  = socio ? etiquetaEstado(socio) : null;
  const [saliendo, setSaliendo] = useState(false);

  // Dentro de la tarjeta (que es un link a la ficha): hay que frenar la
  // navegación. Sin confirmación previa, pero con "Deshacer" en el aviso por
  // si lo tocan sin querer.
  async function sacar(e) {
    e.preventDefault();
    e.stopPropagation();
    setSaliendo(true);
    try {
      await marcarSalida(ingreso.id);
      toast(
        ({ closeToast }) => (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-text">
              <strong className="font-display">{ingreso.nombre}</strong> salió del gym.
            </span>
            <button
              onClick={async () => {
                closeToast();
                try { await deshacerSalida(ingreso.id); }
                catch (error) { avisarError('No se pudo deshacer', error); }
              }}
              className="shrink-0 font-display text-xs font-bold uppercase tracking-caps text-accent hover:underline"
            >
              Deshacer
            </button>
          </div>
        ),
        { icon: false, autoClose: 6000, closeOnClick: false },
      );
    } catch (error) {
      avisarError('No se pudo sacar a la persona', error);
      setSaliendo(false);
    }
  }

  return (
    <Link
      to={`/socios/${ingreso.dni}`}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-surfaceLow p-3 transition-colors hover:border-surfaceHighest hover:bg-surfaceHigh"
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar nombre={socio?.nombre ?? ingreso.nombre ?? '?'} apellido={socio?.apellido}
            foto={socio?.fotoBase64 ?? socio?.fotoApp} size="md" />
          <span className="absolute -bottom-0.5 -right-0.5">
            <LiveDot color="#22C55E" size="sm" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold text-text">{ingreso.nombre}</p>
          <p className="num text-xs text-textSecondary">
            Entró {hora(ingreso.fechaHora)} · hace {minutos} min
          </p>
        </div>
        {estado && <Badge variant={estado.variant}>{estado.label}</Badge>}
      </div>

      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <div className="h-1 overflow-hidden rounded-full bg-surfaceLowest">
            <div className="h-full rounded-full bg-[#22C55E] transition-all duration-700"
              style={{ width: `${(restan / VENTANA_MIN) * 100}%` }} />
          </div>
          <p className="num mt-1 text-[10px] text-textTertiary">
            Sale del conteo en {restan} min
          </p>
        </div>
        <button
          onClick={sacar}
          disabled={saliendo}
          title="Marcar que se fue"
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-surfaceHigh px-2.5 py-1.5 font-display text-xs font-bold text-textSecondary transition-colors hover:bg-danger/15 hover:text-danger disabled:opacity-50"
        >
          <Icon name="logout" className="text-sm" />
          Sacar
        </button>
      </div>
    </Link>
  );
}

function hora(ts) {
  return ts?.toDate?.().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) ?? '—';
}
