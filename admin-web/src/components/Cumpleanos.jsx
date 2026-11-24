import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCuentasPorDni } from '../services/usersService';
import { cumplesEsNuevo } from '../utils/novedades';
import Avatar from './Avatar';
import Icon from './Icon';
import Modal from './Modal';
import NuevoBadge from './NuevoBadge';
import GlobosCumple from './GlobosCumple';
import { Skeleton } from './Skeleton';

// Cumpleaños de los socios, según la fecha de nacimiento de su cuenta de la
// app (el padrón del gym no la tiene). Ese día la app también los saluda.
//   - BotonCumpleanos: la tortita de arriba a la derecha del panel; abre la
//     lista de hoy y de todo el mes.
//   - CumpleanosDeHoy: la tarjeta del panel, solo si alguien cumple hoy.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ROSA = '#F472B6';

// fechaNacimiento de la app: "DD/MM/AAAA". Día del cumple si es en el mes de
// `hoy`, o null. Los del 29/2, el 28/2 si no es bisiesto (como en la app).
function diaDelMes(fecha, hoy) {
  const [d, m] = String(fecha ?? '').split('/').map((x) => parseInt(x, 10));
  if (!(d >= 1 && d <= 31) || m !== hoy.getMonth() + 1) return null;
  const bisiesto = new Date(hoy.getFullYear(), 1, 29).getMonth() === 1;
  return d === 29 && m === 2 && !bisiesto ? 28 : d;
}

export function esCumpleHoy(fecha, hoy = new Date()) {
  return diaDelMes(fecha, hoy) === hoy.getDate();
}

// Los del mes ordenados por día, y los de hoy. null mientras carga. Las
// cuentas salen de la copia del navegador si se leyeron hace poco (ver
// usersService), así que casi no gasta lecturas.
export function useCumpleanos(socios) {
  const [cuentas, setCuentas] = useState(null);
  useEffect(() => {
    getCuentasPorDni().then(setCuentas).catch(() => setCuentas(new Map()));
  }, []);

  const porDni = useMemo(() => new Map(socios.map((s) => [s.dni, s])), [socios]);
  const hoy = new Date();
  const delMes = useMemo(() => {
    if (!cuentas) return null;
    const vistos = new Set();
    const res = [];
    for (const [dni, c] of cuentas) {
      const dia = diaDelMes(c.fechaNacimiento, hoy);
      if (vistos.has(c) || dia == null) continue;
      vistos.add(c);
      const socio = porDni.get(dni);
      const anio = Number(String(c.fechaNacimiento).split('/')[2]);
      res.push({
        dni,
        socio,
        dia,
        nombre: socio ? `${socio.nombre} ${socio.apellido ?? ''}`.trim() : [c.nombre, c.apellido].filter(Boolean).join(' '),
        foto: socio?.fotoBase64 ?? c.photoBase64 ?? null,
        cumple: anio > 1900 ? hoy.getFullYear() - anio : null,
      });
    }
    return res.sort((a, b) => a.dia - b.dia || a.nombre.localeCompare(b.nombre));
  }, [cuentas, porDni]);

  return {
    delMes,
    deHoy: delMes?.filter((p) => p.dia === hoy.getDate()) ?? null,
    mes: MESES[hoy.getMonth()],
    diaHoy: hoy.getDate(),
  };
}

export function BotonCumpleanos({ cumples }) {
  const [abierto, setAbierto] = useState(false);
  const n = cumples.deHoy?.length ?? 0;
  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="btn-outline relative !px-3"
        title={n ? `${n} ${n === 1 ? 'cumple' : 'cumplen'} años hoy` : 'Cumpleaños del mes'}
        aria-label="Cumpleaños"
      >
        <Icon name="cake" className={`text-xl ${n ? 'text-[#F472B6]' : ''}`} />
        {n > 0 && (
          <span className="num absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F472B6] px-1 text-[0.6875rem] font-bold text-[#1A0B22] shadow-lg">
            {n}
          </span>
        )}
        {!n && <NuevoBadge mostrar={cumplesEsNuevo()} />}
      </button>
      {abierto && <CumpleanosModal cumples={cumples} onClose={() => setAbierto(false)} />}
    </>
  );
}

function CumpleanosModal({ cumples, onClose }) {
  const { delMes, deHoy, mes } = cumples;
  // Si alguien cumple hoy, arranca en Hoy; si no, en todo el mes.
  const [vista, setVista] = useState(deHoy?.length ? 'hoy' : 'mes');
  const lista = vista === 'hoy' ? deHoy : delMes;

  return (
    <Modal title="Cumpleaños" onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-textSecondary">De los que tienen la app: ese día la app también los saluda.</p>
          <div className="flex shrink-0 rounded-lg bg-surfaceLowest p-0.5">
            {[['hoy', `Hoy${deHoy?.length ? ` (${deHoy.length})` : ''}`], ['mes', `Todo ${mes}${delMes?.length ? ` (${delMes.length})` : ''}`]].map(([v, txt]) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={`rounded-md px-3 py-1 font-display text-xs font-bold transition-colors ${vista === v ? 'bg-[#F472B6]/20 text-[#F472B6]' : 'text-textSecondary hover:text-text'}`}
              >
                {txt}
              </button>
            ))}
          </div>
        </div>
        <ListaCumples lista={lista} vista={vista} mes={mes} diaHoy={cumples.diaHoy} onIr={onClose} />
      </div>
    </Modal>
  );
}

// La tarjeta del panel: solo aparece si alguien cumple hoy.
export function CumpleanosDeHoy({ cumples }) {
  const { deHoy, mes, diaHoy } = cumples;
  if (!deHoy?.length) return null;
  // Al entrar suben los globos por toda la pantalla (una vez; fuera de la
  // tarjeta, que recorta lo que se sale); en la tarjeta quedan cayendo papelitos.
  return (
    <>
    <GlobosCumple papelitos={0} />
    <section className="card relative flex flex-col gap-3 overflow-hidden p-4">
      <GlobosCumple dentro />
      <div className="relative z-10 flex items-center gap-3">
        <span className="flex items-center justify-center rounded-lg p-2" style={{ backgroundColor: `${ROSA}26`, color: ROSA }}>
          <Icon name="cake" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-text">Cumpleaños de hoy</h2>
            <span className="rounded-full bg-[#F472B6]/15 px-2 py-0.5 font-display text-[0.6875rem] font-bold text-[#F472B6]">
              {deHoy.length}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-textSecondary">De los que tienen la app: ese día la app también los saluda.</p>
        </div>
      </div>
      <div className="relative z-10">
        <ListaCumples lista={deHoy} vista="hoy" mes={mes} diaHoy={diaHoy} />
      </div>
    </section>
    </>
  );
}

function ListaCumples({ lista, vista, mes, diaHoy, onIr }) {
  if (lista == null) return <Skeleton className="h-12 rounded-xl" />;
  if (!lista.length) {
    return <p className="py-4 text-center text-sm text-textTertiary">{vista === 'hoy' ? 'Hoy no cumple nadie.' : `Nadie cumple en ${mes}.`}</p>;
  }
  return (
    <div className={`grid grid-cols-1 gap-2 ${vista === 'hoy' ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {lista.map((p) => {
        const esHoy = p.dia === diaHoy;
        const paso = p.dia < diaHoy;
        const contenido = (
          <>
            {vista === 'mes' && (
              <span className={`num flex w-10 shrink-0 flex-col items-center rounded-lg py-1 leading-none ${esHoy ? 'bg-[#F472B6] text-[#1A0B22]' : 'bg-surfaceHigh text-text'}`}>
                <span className="font-display text-base font-extrabold">{p.dia}</span>
                <span className="text-[0.625rem] font-bold uppercase">{mes.slice(0, 3)}</span>
              </span>
            )}
            <Avatar nombre={p.nombre} foto={p.foto} size="md" />
            <div className="min-w-0">
              <span className="block truncate font-display text-sm font-bold text-text">{esHoy ? '🎂 ' : ''}{p.nombre}</span>
              <span className="num block truncate text-xs text-textSecondary">
                {esHoy ? (p.cumple ? `Cumple ${p.cumple} hoy` : 'Cumple hoy') : p.cumple ? `${paso ? 'Cumplió' : 'Cumple'} ${p.cumple}` : paso ? 'Ya cumplió' : 'Cumple este mes'}
                {p.socio ? ` · DNI ${p.dni}` : ' · sin ficha en el gym'}
              </span>
            </div>
          </>
        );
        const clases = `flex items-center gap-3 rounded-xl p-2 ${esHoy && vista === 'mes' ? 'bg-[#F472B6]/10 ring-1 ring-[#F472B6]/40' : 'bg-surfaceLow'} ${paso && vista === 'mes' ? 'opacity-60' : ''}`;
        return p.socio ? (
          <Link key={p.dni} to={`/socios/${p.dni}`} onClick={onIr} className={`${clases} transition-colors duration-150 hover:bg-surfaceHigh`}>
            {contenido}
          </Link>
        ) : (
          <div key={p.dni} className={clases}>{contenido}</div>
        );
      })}
    </div>
  );
}
