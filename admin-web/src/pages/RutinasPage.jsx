import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { useSocios } from '../context/SociosContext';
import { rutinaEsNueva } from '../utils/novedades';

// Entrada directa a las rutinas: buscar al socio y abrir su rutina (la que ve
// en la app, y la que se imprime en la planilla o se baja en Excel).
const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function RutinasPage() {
  const { socios, loading } = useSocios();
  const [busqueda, setBusqueda] = useState('');

  const lista = useMemo(() => {
    const t = sinTildes(busqueda.trim());
    return socios
      .filter((s) => !t || sinTildes(`${s.nombre ?? ''} ${s.apellido ?? ''}`).includes(t) || String(s.dni ?? '').includes(t))
      .sort((a, b) => `${a.nombre ?? ''} ${a.apellido ?? ''}`.localeCompare(`${b.nombre ?? ''} ${b.apellido ?? ''}`, 'es'))
      .slice(0, 60);
  }, [socios, busqueda]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-3xl font-extrabold tracking-tight text-text">Rutinas</h1>
        <p className="mt-1 text-sm text-textSecondary">Elegí un socio para armar o cambiar su rutina.</p>
      </div>

      {rutinaEsNueva() && (
        <section className="mb-4 flex items-start gap-4 rounded-xl border border-cyan/40 bg-cyan/10 p-4">
          <span className="rounded-full bg-cyan px-2 py-0.5 font-display text-[0.6875rem] font-extrabold uppercase tracking-caps text-onAccent">¡Nuevo!</span>
          <div className="text-sm text-text">
            <p className="font-semibold">Ahora la rutina se arma desde la web.</p>
            <p className="mt-0.5 text-textSecondary">
              Lo que guardes acá lo ve el socio en su app al instante. Y si la quiere en papel, la imprimís en la
              planilla del gym o la bajás en Excel. También está en la ficha de cada socio, en el botón “Rutina”.
            </p>
          </div>
        </section>
      )}

      <section className="card p-5">
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-surfaceHigh px-3">
          <Icon name="search" className="text-lg text-textTertiary" />
          <input
            className="w-full bg-transparent py-2.5 text-sm text-text outline-none placeholder:text-textTertiary"
            autoFocus
            placeholder="Buscar socio por nombre o DNI…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-textSecondary">Cargando socios…</p>
        ) : lista.length === 0 ? (
          <EmptyState icon={<Icon name="person_search" className="text-xl" />} title="No hay socios con ese nombre o DNI" />
        ) : (
          <div className="flex flex-col">
            {lista.map((s) => (
              <Link
                key={s.dni}
                to={`/socios/${s.dni}/rutina`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surfaceHigh"
              >
                {s.fotoApp || s.fotoBase64 ? (
                  <img src={`data:image/jpeg;base64,${s.fotoApp || s.fotoBase64}`} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surfaceHighest font-display text-xs font-bold text-cyan">
                    {`${s.nombre?.[0] ?? ''}${s.apellido?.[0] ?? ''}`.toUpperCase() || '?'}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-text">{[s.nombre, s.apellido].filter(Boolean).join(' ')}</span>
                  <span className="num text-xs text-textSecondary">DNI {s.dni}</span>
                </span>
                {s.tieneCuentaApp && (
                  <span className="hidden items-center gap-1 text-xs text-cyan sm:flex"><Icon name="smartphone" className="text-sm" /> App</span>
                )}
                <span className="flex items-center gap-1 text-sm font-semibold text-accent">
                  Rutina <Icon name="chevron_right" className="text-lg" />
                </span>
              </Link>
            ))}
            {!busqueda && socios.length > lista.length && (
              <p className="px-3 pt-3 text-xs text-textSecondary">Mostrando {lista.length} de {socios.length}. Buscá para encontrar al resto.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
