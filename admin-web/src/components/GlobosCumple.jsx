import { useLayoutEffect, useMemo, useRef, useState } from 'react';

// Festejo de cumpleaños (como el cumple de Twitter y el de la app). No recibe
// clics: no tapa nada. Animaciones en index.css.
//   - Por defecto, en toda la pantalla: una tanda de globos que suben
//     meciéndose y papelitos que siguen cayendo mientras se está en la página
//     (ficha del socio que cumple hoy, panel de control).
//   - dentro: solo papelitos, dentro de su contenedor (que tiene que tener
//     `relative overflow-hidden`), p. ej. la tarjeta "Cumpleaños de hoy".
const COLORES = ['#F472B6', '#FACC15', '#22C55E', '#38BDF8', '#A78BFA', '#FB923C', '#F87171'];
const GLOBOS = 16;

export default function GlobosCumple({ dentro = false, papelitos: cantidad = dentro ? 18 : 36, globos: conGlobos = !dentro }) {
  // Dentro de una tarjeta caen lo que mide la tarjeta, no la pantalla.
  const caja = useRef(null);
  const [alto, setAlto] = useState(null);
  useLayoutEffect(() => {
    if (dentro && caja.current) setAlto(caja.current.offsetHeight);
  }, [dentro]);

  const globos = useMemo(() => (conGlobos ? Array.from({ length: GLOBOS }, (_, i) => {
    const t = 0.8 + Math.random() * 0.5;
    return {
      left: `${(100 / GLOBOS) * i + Math.random() * 4 - 2}%`,
      w: Math.round(54 * t),
      h: Math.round(68 * t),
      color: COLORES[(i * 3) % COLORES.length],
      dura: `${3.8 + Math.random() * 2}s`,
      espera: `${i % 3 === 0 ? Math.random() * 0.3 : 0.3 + Math.random() * 1.6}s`,
      vaiven: `${10 + Math.random() * 16}px`,
      mece: `${-Math.random() * 2}s`,
    };
  }) : []), [conGlobos]);
  const papelitos = useMemo(() => Array.from({ length: cantidad }, (_, i) => ({
    left: `${Math.random() * 100}%`,
    w: 6 + Math.random() * 6,
    h: 10 + Math.random() * 8,
    redondo: i % 5 === 0,
    color: COLORES[i % COLORES.length],
    dura: `${(dentro ? 2.4 : 3.2) + Math.random() * 2.6}s`,
    // La primera tanda sale enseguida; después cada uno vuelve a caer solo.
    espera: `${Math.random() * (dentro ? 2.5 : 1.8)}s`,
    vueltas: `${(Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 900)}deg`,
  })), [cantidad, dentro]);

  return (
    <div
      ref={caja}
      className={`pointer-events-none overflow-hidden ${dentro ? 'absolute inset-0 z-0' : 'fixed inset-0 z-[60]'}`}
      style={alto ? { '--caida': `${alto + 40}px` } : undefined}
      aria-hidden="true"
    >
      {papelitos.map((p, i) => (
        <span
          key={`p${i}`}
          className="papelito-cae absolute top-0"
          style={{
            left: p.left, width: p.w, height: p.redondo ? p.w : p.h,
            borderRadius: p.redondo ? '50%' : 2, backgroundColor: p.color,
            opacity: dentro ? 0.7 : 1,
            '--dura': p.dura, '--espera': p.espera, '--vueltas': p.vueltas,
          }}
        />
      ))}
      {globos.map((g, i) => (
        <div
          key={`g${i}`}
          className="globo-sube absolute"
          style={{ left: g.left, top: '100%', '--dura': g.dura, '--espera': g.espera }}
        >
          <div className="globo-mece flex flex-col items-center" style={{ '--vaiven': g.vaiven, animationDelay: g.mece }}>
            <div className="relative" style={{ width: g.w, height: g.h, borderRadius: '50%', backgroundColor: g.color, boxShadow: 'inset -6px -8px 0 rgba(0,0,0,0.12)' }}>
              <span className="absolute" style={{ left: '20%', top: '14%', width: '22%', height: '30%', borderRadius: '50%', background: 'rgba(255,255,255,0.4)', transform: 'rotate(20deg)' }} />
            </div>
            {/* Nudito e hilo */}
            <span style={{ width: 0, height: 0, marginTop: -2, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: `7px solid ${g.color}` }} />
            <span style={{ width: 1.5, height: 80, background: 'rgba(255,255,255,0.4)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
