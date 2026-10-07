import { useMemo, useState } from 'react';
import { useSocios } from '../context/SociosContext';
import { useIngresos } from '../context/IngresosContext';
import { registrarAsistencia, filtrarEnSala } from '../services/asistenciasService';
import { ESTADOS, etiquetaEstado } from '../services/estadoCuota';
import { avisarError } from '../utils/avisos';
import Modal from './Modal';
import Avatar from './Avatar';
import Badge from './Badge';
import Icon from './Icon';
import NuevoSocioModal from './NuevoSocioModal';

// Carga manual de un ingreso desde recepción, para cuando alguien entra sin
// pasar por el control de acceso. Si el DNI no existe, permite darlo de alta
// ahí mismo y registrarle el ingreso.
export default function RegistrarIngresoModal({ onClose }) {
  const { socios } = useSocios();
  const [busqueda, setBusqueda] = useState('');
  const [guardando, setGuardando] = useState(null);
  const [altaDni, setAltaDni] = useState(null);

  const { ingresos, ahora } = useIngresos();
  const enSala = useMemo(
    () => new Set(filtrarEnSala(ingresos ?? [], ahora).map((i) => i.dni)),
    [ingresos, ahora],
  );

  const term = busqueda.trim().toLowerCase();
  const resultados = useMemo(() => (
    term
      ? socios.filter((s) => s.nombre.toLowerCase().includes(term) || s.dni.includes(term))
      : socios
  ), [socios, term]);

  const pareceDni = /^\d{6,}$/.test(term);
  const dniExiste = socios.some((s) => s.dni === term);

  async function registrar(nombre, dni) {
    setGuardando(dni);
    try {
      await registrarAsistencia(nombre, dni);
      onClose();
    } catch (error) {
      avisarError('No se pudo registrar el ingreso', error);
      setGuardando(null);
    }
  }

  if (altaDni !== null) {
    return (
      <NuevoSocioModal
        dniInicial={altaDni}
        onClose={() => setAltaDni(null)}
        onCreated={async (dni) => {
          const creado = socios.find((s) => s.dni === dni);
          await registrar(creado?.nombre ?? dni, dni);
        }}
      />
    );
  }

  return (
    <Modal title="Registrar ingreso" onClose={onClose}>
      <div className="space-y-4">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-textTertiary">
            <Icon name="search" className="text-base" />
          </span>
          <input
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre o DNI del socio..."
            aria-label="Buscar socio"
            className="input py-3 pl-10"
          />
        </div>

        <p className="num text-xs text-textTertiary">
          {term
            ? `${resultados.length} ${resultados.length === 1 ? 'resultado' : 'resultados'}`
            : `${socios.length} socios · tocá uno para registrarle la entrada`}
        </p>

        <div className="-mr-2 flex max-h-[55vh] flex-col gap-1.5 overflow-y-auto pr-2">
          {resultados.map((s) => {
            const estado = etiquetaEstado(s);
            const adentro = enSala.has(s.dni);
            return (
              <button
                key={s.dni}
                onClick={() => registrar(s.nombre, s.dni)}
                disabled={guardando !== null}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg bg-surfaceLow p-2.5 text-left transition-colors hover:bg-surfaceHigh disabled:opacity-60"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar nombre={s.nombre} foto={s.fotoBase64 ?? s.fotoApp} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-display text-sm font-bold text-text">{s.nombre}</span>
                    <span className="num block text-xs text-textTertiary">DNI {s.dni}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {adentro && (
                    <span className="rounded bg-[#22C55E]/15 px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-caps text-[#22C55E]">
                      En sala
                    </span>
                  )}
                  <Badge variant={estado.variant}>{estado.label}</Badge>
                  <Icon name={guardando === s.dni ? 'hourglass_top' : 'login'} className="text-lg text-accent" />
                </span>
              </button>
            );
          })}
        </div>

        {term && resultados.length === 0 && (
          <div className="rounded-lg bg-surfaceLowest p-4 text-center">
            <p className="text-sm text-textSecondary">No hay ningún socio con “{busqueda}”.</p>
            {pareceDni && !dniExiste && (
              <button onClick={() => setAltaDni(term)} className="btn-primary btn-sm mt-3">
                <Icon name="person_add" className="text-base" />
                Dar de alta DNI {term}
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
