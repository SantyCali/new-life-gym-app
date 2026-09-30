import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { Skeleton } from './Skeleton';

const VARIANTS = {
  success: {
    bar:  'from-accent via-accent/70 to-transparent',
    dot:  'bg-accent shadow-glowSoft',
    text: 'text-accent',
    chip: 'bg-accent/10 text-accent',
  },
  warning: {
    bar:  'from-cyan via-cyan/50 to-transparent',
    dot:  'bg-cyan shadow-glowCyan',
    text: 'text-cyan',
    chip: 'bg-cyan/10 text-cyan',
  },
  danger: {
    bar:  'from-danger via-danger/50 to-transparent',
    dot:  'bg-danger',
    text: 'text-danger',
    chip: 'bg-danger/10 text-danger',
  },
  neutral: {
    bar:  'from-surfaceHighest to-transparent',
    dot:  'bg-textTertiary',
    text: 'text-text',
    chip: 'bg-surfaceHigh text-textSecondary',
  },
  // Aforo: colores exactos de statusFor() en GymScreen.js de la app mobile,
  // para que "tranquilo / moderado / lleno" se vea igual en los dos lados.
  vacio: {
    bar:  'from-[#6B7280] via-[#6B7280]/50 to-transparent',
    dot:  'bg-[#6B7280]',
    text: 'text-[#9CA3AF]',
    chip: 'bg-[#6B7280]/15 text-[#9CA3AF]',
  },
  tranquilo: {
    bar:  'from-[#22C55E] via-[#22C55E]/50 to-transparent',
    dot:  'bg-[#22C55E] shadow-[0_0_8px_rgba(34,197,94,0.5)]',
    text: 'text-[#22C55E]',
    chip: 'bg-[#22C55E]/15 text-[#22C55E]',
  },
  moderado: {
    bar:  'from-[#EAB308] via-[#EAB308]/50 to-transparent',
    dot:  'bg-[#EAB308] shadow-[0_0_8px_rgba(234,179,8,0.5)]',
    text: 'text-[#EAB308]',
    chip: 'bg-[#EAB308]/15 text-[#EAB308]',
  },
  lleno: {
    bar:  'from-[#EF4444] via-[#EF4444]/50 to-transparent',
    dot:  'animate-pulse bg-[#EF4444] shadow-[0_0_8px_rgba(239,68,68,0.6)]',
    text: 'text-[#EF4444]',
    chip: 'bg-[#EF4444]/15 text-[#EF4444]',
  },
};

// Sirve como link (to), como filtro (onClick) o como dato estático.
// Con `liveColor` pasa a modo en vivo: haz de luz en la línea superior, punto
// que respira y resplandor de fondo, todo en ese color.
export default function StatCard({
  label, value, unidad, icono, variant = 'neutral', pie, to, onClick, active,
  liveColor, actualizadoEn,
}) {
  const v = VARIANTS[variant];

  const content = (
    <>
      {liveColor ? (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-[2.5px] overflow-hidden bg-[#1a2332]">
          <span
            className="absolute inset-y-0 left-0 w-2/5"
            style={{ background: `linear-gradient(90deg, ${liveColor}99, ${liveColor}e6, transparent)` }}
          />
          <span
            className="beam-sweep absolute inset-y-0 left-0 w-2/3 blur-[0.5px]"
            style={{ background: `linear-gradient(90deg, transparent, ${liveColor}, transparent)` }}
          />
        </span>
      ) : (
        <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${v.bar}`} />
      )}

      <span className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          {liveColor ? (
            <span
              className="dot-breathe h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: liveColor, boxShadow: `0 0 10px ${liveColor}, 0 0 20px ${liveColor}8c` }}
            />
          ) : (
            <span className={`h-2 w-2 rounded-full ${v.dot}`} />
          )}
          <span className="font-display text-[0.6875rem] font-bold uppercase tracking-caps text-textSecondary">
            {label}
          </span>
        </span>
        {icono && (
          <span className={`flex items-center justify-center rounded-lg p-1.5 ${v.chip}`}>
            <Icon name={icono} className="text-base" />
          </span>
        )}
      </span>

      <span className="my-3 flex items-baseline gap-2">
        {value == null ? (
          <Skeleton className="h-9 w-16" />
        ) : (
          <>
            <span className={`kpi ${v.text}`}>{value}</span>
            {unidad && <span className="text-xs text-textSecondary">{unidad}</span>}
          </>
        )}
      </span>

      {pie && <span className="block text-xs text-textSecondary">{pie}</span>}
    </>
  );

  const base = `card relative block overflow-hidden p-4 text-left transition-colors duration-200 ${
    active ? 'border-accent' : ''
  }`;
  const interactive = 'cursor-pointer hover:bg-surfaceHigh';

  let card;
  if (to)           card = <Link to={to} className={`${base} ${interactive}`}>{content}</Link>;
  else if (onClick) card = <button onClick={onClick} className={`${base} ${interactive} w-full`}>{content}</button>;
  else              card = <div className={base}>{content}</div>;

  if (!liveColor) return card;

  return (
    <div className="relative">
      {/* Resplandor detrás de la tarjeta: va afuera porque la tarjeta
          recorta todo lo que sobresale (overflow-hidden). */}
      <div
        className="pointer-events-none absolute -inset-6 -z-0 rounded-3xl blur-2xl"
        style={{ background: `radial-gradient(55% 55% at 50% 50%, ${liveColor}2e 0%, transparent 100%)` }}
      />
      <div className="relative h-full [&>*]:h-full">{card}</div>
      {actualizadoEn && <Actualizado desde={actualizadoEn} />}
    </div>
  );
}

// Tiempo desde el último dato recibido del listener. Se refresca solo cada
// pocos segundos para que el contador avance aunque no lleguen cambios.
function Actualizado({ desde }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const seg = Math.max(0, Math.round((ahora - desde) / 1000));
  const texto = seg < 10 ? 'recién'
    : seg < 60 ? `hace ${seg} seg`
    : `hace ${Math.floor(seg / 60)} min`;

  return (
    // Absoluto debajo de la tarjeta: si ocupara lugar, esta tarjeta quedaría
    // más baja que las otras de la misma fila.
    <p className="absolute left-0 top-full mt-1.5 flex items-center gap-1.5 whitespace-nowrap px-2 text-[11px] text-textTertiary">
      <span className="h-1.5 w-1.5 rounded-full bg-textTertiary/60" />
      Actualizado {texto}
    </p>
  );
}
