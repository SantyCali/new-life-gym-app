import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSocios } from '../context/SociosContext';
import { ESTADOS, getEstadosStats, etiquetaEstado } from '../services/estadoCuota';
import NuevoSocioModal from '../components/NuevoSocioModal';
import Badge from '../components/Badge';
import Avatar from '../components/Avatar';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import { SkeletonRows } from '../components/Skeleton';

export default function SociosPage() {
  const navigate = useNavigate();
  // El filtro vive en la URL (?estado=vencido) para que el Dashboard pueda
  // linkear directo a una lista ya filtrada.
  const [searchParams, setSearchParams] = useSearchParams();
  const estadoFiltro = searchParams.get('estado');

  const { socios, loading, error } = useSocios();
  const [search, setSearch]   = useState('');
  const [ocultarInactivos, setOcultarInactivos] = useState(false);
  // ?nuevo=1 abre el alta directo (lo usa el botón del Dashboard).
  const [showNuevo, setShowNuevo] = useState(() => searchParams.get('nuevo') === '1');

  const stats = useMemo(() => getEstadosStats(socios), [socios]);

  const filtrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    return socios.filter((s) => {
      if (estadoFiltro) {
        if (s.estado !== estadoFiltro) return false;
      } else if (ocultarInactivos && s.estado === 'inactivo') {
        return false;
      }
      if (!term) return true;
      const nombreCompleto = `${s.nombre ?? ''} ${s.apellido ?? ''}`.toLowerCase();
      return nombreCompleto.includes(term) || (s.dni ?? '').includes(term);
    });
  }, [socios, search, ocultarInactivos, estadoFiltro]);

  function toggleEstado(estado) {
    setSearchParams(estadoFiltro === estado || !estado ? {} : { estado });
  }

  return (
    <div>
      <PageHeader title="Socios" description="Padrón completo del gimnasio y estado de cuota.">
        <button onClick={() => setShowNuevo(true)} className="btn-primary">
          <Icon name="person_add" className="text-base" />
          Nuevo socio
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total" value={loading ? null : stats.total} icono="groups"
          onClick={() => toggleEstado(null)} active={!estadoFiltro} />
        <StatCard label="Al día" value={loading ? null : stats.aldia} variant="success" icono="check_circle"
          onClick={() => toggleEstado('aldia')} active={estadoFiltro === 'aldia'} />
        <StatCard label="Por vencer" value={loading ? null : stats.proximo} variant="warning" icono="schedule"
          onClick={() => toggleEstado('proximo')} active={estadoFiltro === 'proximo'} />
        <StatCard label="Vencidos" value={loading ? null : stats.vencido} variant="danger" icono="warning"
          onClick={() => toggleEstado('vencido')} active={estadoFiltro === 'vencido'} />
        <StatCard label="Inactivos" value={loading ? null : stats.inactivo} icono="person_off"
          onClick={() => toggleEstado('inactivo')} active={estadoFiltro === 'inactivo'} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-textTertiary">
            <Icon name="search" className="text-base" />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, apellido o DNI..."
            aria-label="Buscar socio"
            className="input pl-10"
          />
        </div>

        {estadoFiltro ? (
          <button
            onClick={() => toggleEstado(null)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-accent/10 px-3 py-2 text-sm font-medium text-accent transition-colors duration-200 hover:bg-accent/20"
          >
            {ESTADOS[estadoFiltro].label}
            <span aria-hidden="true" className="text-base leading-none">×</span>
            <span className="sr-only">Quitar filtro</span>
          </button>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-textSecondary">
            <input
              type="checkbox"
              checked={ocultarInactivos}
              onChange={(e) => setOcultarInactivos(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-border accent-accent"
            />
            Ocultar inactivos
          </label>
        )}

        {!loading && (
          <span className="ml-auto text-sm text-textTertiary">
            {filtrados.length} {filtrados.length === 1 ? 'socio' : 'socios'}
          </span>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <div className="card mt-4 overflow-hidden">
        <div className="max-h-[calc(100vh-22rem)] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-surfaceHigh text-xs uppercase tracking-wide text-textTertiary">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Socio</th>
                <th scope="col" className="px-4 py-2.5 font-medium">DNI</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Estado</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Convenio</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Vencimiento</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows rows={8} cols={5} />}

              {!loading && filtrados.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/socios/${s.dni}`)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/socios/${s.dni}`)}
                  className="cursor-pointer border-t border-border transition-colors duration-150 hover:bg-surfaceHigh"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar nombre={s.nombre} apellido={s.apellido} foto={s.fotoBase64 ?? s.fotoApp} size="sm" />
                      <span className="font-medium text-text">{s.nombre} {s.apellido}</span>
                    </div>
                  </td>
                  <td className="num px-4 py-2.5 text-textSecondary">{s.dni}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={etiquetaEstado(s).variant}>{etiquetaEstado(s).label}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-textSecondary">{s.tieneConvenio ? 'Sí' : '—'}</td>
                  <td className="num px-4 py-2.5 text-right text-textSecondary">{formatDate(s.fechaVencimiento)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && filtrados.length === 0 && (
            <EmptyState
              icon={<Icon name="search_off" className="text-xl" />}
              title="Sin resultados"
              description={
                search || estadoFiltro
                  ? 'Probá con otro término de búsqueda o quitá el filtro.'
                  : 'Todavía no hay socios cargados.'
              }
              action={
                (search || estadoFiltro) ? (
                  <button
                    onClick={() => { setSearch(''); toggleEstado(null); }}
                    className="btn-outline btn-sm"
                  >
                    Limpiar filtros
                  </button>
                ) : (
                  <button onClick={() => setShowNuevo(true)} className="btn-primary btn-sm">
                    Crear el primero
                  </button>
                )
              }
            />
          )}
        </div>
      </div>

      {showNuevo && (
        <NuevoSocioModal
          onClose={() => setShowNuevo(false)}
          onCreated={(dni) => { setShowNuevo(false); navigate(`/socios/${dni}`); }}
        />
      )}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function formatDate(ts) {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : ts;
  return date.toLocaleDateString('es-AR');
}

