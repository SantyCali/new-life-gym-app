import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSocios } from '../context/SociosContext';
import useIngresosDeHoy from '../hooks/useIngresosDeHoy';
import { getEstadosStats } from '../services/estadoCuota';
import {
  filtrarEnSala, estadoAforo, agruparPorHora,
} from '../services/asistenciasService';
import StatCard from '../components/StatCard';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import LiveDot from '../components/LiveDot';
import { Skeleton } from '../components/Skeleton';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { socios, loading } = useSocios();
  const { ingresos, ahora, actualizadoEn } = useIngresosDeHoy();

  const stats     = useMemo(() => (loading ? null : getEstadosStats(socios)), [socios, loading]);
  const porVencer = useMemo(() => ordenar(socios, 'proximo'), [socios]);
  const vencidos  = useMemo(() => ordenar(socios, 'vencido'), [socios]);

  const enSala = ingresos ? filtrarEnSala(ingresos, ahora) : null;
  const aforo  = enSala ? estadoAforo(enSala.length) : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <div className="flex items-center gap-2">
            <LiveDot />
            <span className="font-display text-[0.6875rem] font-bold uppercase tracking-caps text-accent">
              En vivo
            </span>
            <span className="text-textTertiary">•</span>
            <span className="font-display text-[0.6875rem] font-bold uppercase tracking-caps text-textSecondary">
              {new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-text">
            Panel de control
          </h1>
          <p className="mt-1 text-sm text-textSecondary">
            Estado del padrón, vencimientos de cuota y flujo de gente en sala.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/planes" className="btn-outline">
            <Icon name="card_membership" />
            Planes
          </Link>
          <button onClick={() => navigate('/socios?nuevo=1')} className="btn-primary">
            <Icon name="person_add" />
            Nuevo socio
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Al día" value={stats?.aldia} unidad="socios" icono="check_circle"
          variant="success" to="/socios?estado=aldia"
          pie={stats ? `${porcentaje(stats.aldia, stats.total)}% del padrón activo` : null}
        />
        <StatCard
          label="Por vencer (4 días)" value={stats?.proximo} unidad="urgentes" icono="schedule"
          variant="warning" to="/socios?estado=proximo"
          pie="Conviene avisarles antes del vencimiento"
        />
        <StatCard
          label="Vencidos" value={stats?.vencido} unidad="a recuperar" icono="warning"
          variant="danger" to="/socios?estado=vencido"
          pie="Cuota vencida hace menos de 15 días"
        />
        <StatCard
          label={aforo ? `En sala · ${aforo.label}` : 'En sala ahora'}
          value={enSala?.length}
          unidad={enSala?.length === 1 ? 'persona' : 'personas'}
          icono="fitness_center"
          variant={aforo?.id ?? 'neutral'}
          liveColor={aforo?.color}
          actualizadoEn={actualizadoEn}
          to="/en-sala"
          pie={ingresos ? `${ingresos.length} ingresos en el día` : null}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SocioList
          titulo="Vencimientos próximos"
          subtitulo="Caducan dentro de los próximos 4 días"
          icono="alarm"
          variant="warning"
          socios={porVencer}
          cargando={stats === null}
          verTodos="/socios?estado=proximo"
          vacio="No hay cuotas por vencer."
        />
        <SocioList
          titulo="Cuotas vencidas"
          subtitulo="Vencidas hace menos de 15 días"
          icono="cancel"
          variant="danger"
          socios={vencidos}
          cargando={stats === null}
          verTodos="/socios?estado=vencido"
          vacio="No hay cuotas vencidas."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CurvaDeFlujo ingresos={ingresos} />
        <UltimosAccesos ingresos={ingresos} enSala={enSala ?? []} socios={socios} />
      </div>
    </div>
  );
}

function porcentaje(parte, total) {
  if (!total) return 0;
  return Math.round((parte / total) * 100);
}

function ordenar(socios, estado) {
  return socios
    .filter((s) => s.estado === estado)
    .sort((a, b) => a.fechaVencimiento.toMillis() - b.fechaVencimiento.toMillis())
    .slice(0, 6);
}

const ACENTO = {
  warning: { chip: 'bg-cyan/10 text-cyan',     link: 'text-cyan' },
  danger:  { chip: 'bg-danger/10 text-danger', link: 'text-danger' },
};

function SocioList({ titulo, subtitulo, icono, variant, socios, cargando, verTodos, vacio }) {
  const a = ACENTO[variant];

  return (
    <section className="card flex flex-col p-4">
      <div className="flex items-start justify-between gap-3 pb-3">
        <div className="flex items-center gap-3">
          <span className={`flex items-center justify-center rounded-lg p-2 ${a.chip}`}>
            <Icon name={icono} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-text">{titulo}</h2>
              {!cargando && socios.length > 0 && (
                <span className={`rounded-full px-2 py-0.5 font-display text-[0.6875rem] font-bold ${a.chip}`}>
                  {socios.length}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-textSecondary">{subtitulo}</p>
          </div>
        </div>
        <Link to={verTodos} className={`flex shrink-0 items-center gap-0.5 font-display text-xs font-bold ${a.link} hover:underline`}>
          Ver todos
          <Icon name="chevron_right" className="text-sm" />
        </Link>
      </div>

      {cargando ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : socios.length === 0 ? (
        <EmptyState title={vacio} />
      ) : (
        <div className="flex flex-col gap-2">
          {socios.map((s) => (
            <Link
              key={s.id}
              to={`/socios/${s.dni}`}
              className="flex items-center justify-between gap-3 rounded-xl bg-surfaceLow p-2 transition-colors duration-150 hover:bg-surfaceHigh"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar nombre={s.nombre} apellido={s.apellido} foto={s.fotoBase64 ?? s.fotoApp} size="md" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-display text-sm font-bold text-text">
                      {s.nombre} {s.apellido}
                    </span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 font-display text-[0.6875rem] font-bold uppercase tracking-caps ${a.chip}`}>
                      {diasRelativos(s.fechaVencimiento)}
                    </span>
                  </div>
                  <span className="num truncate text-xs text-textSecondary">
                    DNI {s.dni} · vence {s.fechaVencimiento.toDate().toLocaleDateString('es-AR')}
                  </span>
                </div>
              </div>
              <Icon name="chevron_right" className="shrink-0 text-base text-textTertiary" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function CurvaDeFlujo({ ingresos }) {
  // Franja del gimnasio: 7 a 23. Fuera de ese rango no se grafica.
  const DESDE = 7;
  const HASTA = 23;

  if (!ingresos) {
    return <section className="card p-4"><Skeleton className="h-40" /></section>;
  }

  const porHora = agruparPorHora(ingresos);
  const franja  = porHora.slice(DESDE, HASTA + 1);
  const maximo  = Math.max(...franja, 1);
  const pico    = franja.indexOf(Math.max(...franja)) + DESDE;
  const total   = franja.reduce((a, b) => a + b, 0);

  return (
    <section className="card flex flex-col p-4">
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Icon name="insights" className="text-lg text-accent" />
          <h3 className="text-base font-bold text-text">Curva de flujo de hoy</h3>
        </div>
        <span className="font-display text-[0.6875rem] font-bold uppercase tracking-caps text-textSecondary">
          {DESDE}h — {HASTA}h
        </span>
      </div>

      {total === 0 ? (
        <EmptyState title="Todavía no hubo ingresos hoy" />
      ) : (
        <>
          <div className="flex h-28 items-end gap-1">
            {franja.map((cantidad, i) => {
              const hora = DESDE + i;
              const esPico = hora === pico && cantidad > 0;
              return (
                <div key={hora} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    title={`${hora}:00 — ${cantidad} ingreso${cantidad === 1 ? '' : 's'}`}
                    style={{ height: `${Math.max((cantidad / maximo) * 100, 3)}%` }}
                    className={`w-full rounded-t transition-colors ${
                      esPico ? 'bg-accent shadow-glowSoft' : 'bg-surfaceHigh hover:bg-accent/40'
                    }`}
                  />
                  <span className={`num text-[9px] ${esPico ? 'font-bold text-accent' : 'text-textTertiary'}`}>
                    {String(hora).padStart(2, '0')}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between pt-3 text-xs text-textSecondary">
            <span>Hora pico: <strong className="text-accent">{pico}:00</strong></span>
            <span className="num">{total} ingresos hoy</span>
          </div>
        </>
      )}
    </section>
  );
}

function UltimosAccesos({ ingresos, enSala, socios }) {
  const porDni = useMemo(() => new Map(socios.map((s) => [s.dni, s])), [socios]);

  if (!ingresos) {
    return <section className="card p-4"><Skeleton className="h-40" /></section>;
  }

  const adentro = new Set(enSala.map((i) => i.id));

  return (
    <section className="card flex flex-col p-4">
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Icon name="door_sliding" className="text-lg text-accent" />
          <h3 className="text-base font-bold text-text">Últimos accesos</h3>
          <LiveDot size="sm" />
        </div>
        <Link to="/en-sala" className="flex shrink-0 items-center gap-0.5 font-display text-xs font-bold text-accent hover:underline">
          Ver todos
          <Icon name="chevron_right" className="text-sm" />
        </Link>
      </div>

      {ingresos.length === 0 ? (
        <EmptyState title="Sin ingresos registrados hoy" />
      ) : (
        <div className="flex flex-col gap-2">
          {ingresos.slice(0, 6).map((i) => {
            const socio = porDni.get(i.dni);
            return (
            <Link
              key={i.id}
              to={`/socios/${i.dni}`}
              className="flex items-center justify-between gap-3 rounded-lg bg-surfaceLow p-2 transition-colors duration-150 hover:bg-surfaceHigh"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Avatar
                  nombre={socio?.nombre ?? i.nombre ?? '?'}
                  apellido={socio?.apellido}
                  foto={socio?.fotoBase64 ?? socio?.fotoApp}
                  size="sm"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-display text-xs font-bold text-text">{i.nombre}</p>
                    {adentro.has(i.id) && (
                      <span className="shrink-0 rounded bg-[#22C55E]/15 px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-caps text-[#22C55E]">
                        En sala
                      </span>
                    )}
                  </div>
                  <p className="num truncate text-[11px] text-textSecondary">DNI {i.dni}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="num font-display text-[0.6875rem] font-bold text-accent">
                  {i.fechaHora?.toDate?.().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </p>
                {/* El kiosco guarda el estado de cuota al momento de entrar. */}
                <p className="text-[10px] uppercase tracking-caps text-textTertiary">
                  {i.estado === 'manual' ? 'Manual' : i.estado}
                </p>
              </div>
            </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

// Día de calendario en Argentina, como número de días desde 1970.
// Antes se restaban milisegundos y se redondeaba: a la noche un vencimiento
// de hoy (00:00) quedaba "-0,9 días" → "Ayer", y el de mañana "Hoy".
const diaArgentina = (fecha) => {
  const [y, m, d] = fecha
    .toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
    .split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

function diasRelativos(ts) {
  const dias = diaArgentina(ts.toDate()) - diaArgentina(new Date());
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  if (dias > 1) return `En ${dias} días`;
  if (dias === -1) return 'Ayer';
  return `Hace ${Math.abs(dias)} días`;
}
