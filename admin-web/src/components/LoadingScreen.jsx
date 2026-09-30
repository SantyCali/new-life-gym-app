import { useEffect, useState } from 'react';
import pkg from '../../package.json';

// Los pasos reales que hace el panel al abrir. La barra avanza cuando
// termina cada uno de verdad, en vez de simular un porcentaje.
const ETAPAS = [
  'Verificando tu sesión...',
  'Comprobando permisos de entrenador...',
  'Cargando el padrón de socios...',
];

export default function LoadingScreen({ etapa = 0 }) {
  const online = useOnline();
  const paso = Math.min(etapa, ETAPAS.length - 1);
  // Arranca en un tramo del paso actual para que la barra nunca se vea vacía.
  const progreso = Math.round(((paso + 0.6) / ETAPAS.length) * 100);

  return (
    <div className="relative flex h-screen w-full flex-col justify-between overflow-hidden bg-surfaceLowest">
      <div className="pointer-events-none absolute inset-0 bg-grid-glow" />
      <div className="pulse-glow pointer-events-none absolute -top-32 left-1/2 h-[350px] w-[700px] -translate-x-1/2 rounded-full bg-accent/10 blur-[140px]" />

      <header className="relative z-10 flex w-full items-center justify-between border-b border-white/5 bg-surfaceLowest/40 px-8 py-5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <img src="/logo-nlg.png" alt="" className="h-7 w-7 rounded-lg" />
          <span className="font-mono text-xs font-medium uppercase tracking-wider text-textSecondary">
            New Life Gym
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-textTertiary">
          <span className="relative flex h-1.5 w-1.5">
            {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />}
            <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${online ? 'bg-accent' : 'bg-danger'}`} />
          </span>
          {online ? 'CONECTADO' : 'SIN CONEXIÓN'}
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4">
        <div className="relative mb-10 flex h-36 w-36 items-center justify-center">
          <div className="pulse-glow pointer-events-none absolute inset-0 rounded-full bg-accent/10 blur-xl" />
          <div className="absolute inset-0 rounded-full border border-white/10" />
          <div className="rotate-ring absolute inset-0 rounded-full border-t border-accent" />

          <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-surfaceContainer/90 p-2 shadow-2xl backdrop-blur-md">
            <img
              src="/logo-nlg.png"
              alt="New Life Gym"
              className="h-full w-full rounded-xl drop-shadow-[0_0_12px_rgba(195,244,0,0.35)]"
            />
          </div>
        </div>

        <div className="mb-10 w-full max-w-xs space-y-2 text-center">
          <h1 className="text-xl font-bold tracking-tight text-text">Iniciando panel</h1>
          <p key={paso} className="h-4 animate-[fadeIn_300ms_ease-out] font-mono text-xs tracking-wide text-textTertiary">
            {online ? ETAPAS[paso] : 'Esperando conexión a internet...'}
          </p>
        </div>

        <div className="w-full max-w-xs">
          <div className="mb-2.5 flex items-center justify-between font-mono">
            <span className="text-[10px] uppercase tracking-wider text-textTertiary">Carga</span>
            <span className="text-xs font-medium tracking-wider text-accent">
              Paso {paso + 1} de {ETAPAS.length}
            </span>
          </div>
          <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="energy-bar h-full rounded-full shadow-[0_0_10px_rgba(195,244,0,0.5)] transition-all duration-500 ease-out"
              style={{ width: `${progreso}%` }}
            />
          </div>
        </div>
      </main>

      <footer className="relative z-10 flex w-full items-center justify-between border-t border-white/5 px-8 py-4 font-mono text-[11px] text-textTertiary">
        <span>NEW LIFE GYM · MERLO</span>
        <span>v{pkg.version}</span>
      </footer>
    </div>
  );
}

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
