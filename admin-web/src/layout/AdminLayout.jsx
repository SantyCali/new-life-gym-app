import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ToastContainer, Slide } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { useSocios } from '../context/SociosContext';
import { useIngresos } from '../context/IngresosContext';
import { filtrarEnSala, estadoAforo } from '../services/asistenciasService';
import Icon from '../components/Icon';
import LiveDot from '../components/LiveDot';
import LoadingScreen from '../components/LoadingScreen';

const NAV_GROUPS = [
  {
    label: 'Operaciones club',
    items: [
      { to: '/',        label: 'Dashboard', icon: 'grid_view' },
      { to: '/en-sala', label: 'En sala',   icon: 'fitness_center', aforo: true },
      { to: '/socios',  label: 'Socios',    icon: 'group', contador: true },
      { to: '/planes', label: 'Planes',    icon: 'card_membership' },
    ],
  },
  {
    label: 'Administración',
    items: [
      { to: '/caja',          label: 'Caja',          icon: 'payments', soon: true },
      { to: '/reportes',      label: 'Reportes',      icon: 'insights', soon: true },
      { to: '/configuracion', label: 'Configuración', icon: 'settings', soon: true },
    ],
  },
];

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { socios, loading } = useSocios();
  const totalSocios = loading ? null : socios.length;
  const { ingresos, ahora } = useIngresos();
  const enSala = ingresos ? filtrarEnSala(ingresos, ahora).length : null;
  const aforo  = enSala != null ? estadoAforo(enSala) : null;

  const inicial = user?.email?.[0]?.toUpperCase() ?? '?';

  // Tercer paso de la carga: el padrón. Solo la primera vez; después el
  // listener mantiene los datos al día sin volver a bloquear la pantalla.
  if (loading) return <LoadingScreen etapa={2} />;

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Slide en vez del rebote por defecto: es un solo desplazamiento y en
          PCs viejas se dibuja sin tirones. pauseOnFocusLoss apagado: en
          recepción el panel suele quedar abierto sin foco y los avisos se
          quedaban trabados en pantalla. */}
      <ToastContainer
        position="bottom-right"
        theme="dark"
        transition={Slide}
        limit={4}
        newestOnTop
        closeOnClick={false}
        pauseOnFocusLoss={false}
      />
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed z-30 flex h-full w-64 flex-col justify-between bg-surfaceLow transition-transform duration-200 md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-16 items-center gap-2.5 bg-surfaceLowest/50 px-4">
            <img src="/logo-nlg.png" alt="New Life Gym" className="h-8 w-8 shrink-0 rounded-lg" />
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold leading-none tracking-tight text-text">
                New Life
              </p>
              <p className="mt-1 font-display text-[0.6875rem] font-bold uppercase tracking-caps text-accent">
                Gym · Merlo
              </p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 pb-4 pt-4">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mb-2">
                <p className="px-3 pb-2 font-display text-[0.6875rem] font-bold uppercase tracking-caps text-textSecondary">
                  {group.label}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map(({ to, label, icon, soon, contador, aforo: conAforo }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === '/'}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center justify-between rounded-lg px-3 py-2 transition-all duration-200 ${
                          isActive
                            ? 'bg-surfaceHigh font-bold text-cyan shadow-[inset_3px_0_0_#00dbe9]'
                            : 'text-textSecondary hover:bg-surfaceContainer hover:text-text'
                        }`
                      }
                    >
                      <span className="flex items-center gap-3">
                        <Icon name={icon} />
                        <span className="font-display text-sm font-semibold">{label}</span>
                      </span>

                      {conAforo && aforo && (
                        <span
                          className="num flex items-center gap-1.5 rounded-full px-2 py-0.5 font-display text-[0.6875rem] font-bold"
                          style={{ backgroundColor: `${aforo.color}26`, color: aforo.color }}
                          title={aforo.label}
                        >
                          <LiveDot color={aforo.color} size="sm" />
                          {enSala}
                        </span>
                      )}
                      {contador && totalSocios != null && (
                        <span className="num rounded-full bg-accent px-2 py-0.5 font-display text-[0.6875rem] font-bold text-onAccent">
                          {totalSocios}
                        </span>
                      )}
                      {soon && (
                        <span className="rounded bg-surfaceHighest px-1.5 py-0.5 font-display text-[0.6875rem] font-bold text-textTertiary">
                          Pronto
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="bg-surfaceLowest/80 p-2">
          <div className="flex items-center justify-between gap-2 rounded-lg p-2 transition-colors hover:bg-surfaceContainer">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surfaceHigh font-display text-[0.6875rem] font-bold text-cyan">
                {inicial}
              </div>
              <p className="min-w-0 flex-1 truncate text-xs text-textSecondary">{user?.email}</p>
            </div>
            <button
              onClick={signOut}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="shrink-0 cursor-pointer rounded p-1.5 text-textTertiary transition-colors duration-200 hover:bg-surfaceHigh hover:text-danger"
            >
              <Icon name="logout" className="text-base" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surfaceLowest/90 px-4 backdrop-blur-xl md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
            className="cursor-pointer rounded-lg p-2 text-textSecondary transition-colors duration-200 hover:bg-surfaceHigh"
          >
            <Icon name="menu" className="text-xl" />
          </button>
          <span className="font-display text-sm font-bold text-text">New Life Gym</span>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
