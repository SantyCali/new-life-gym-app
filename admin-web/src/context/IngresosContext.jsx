import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { subscribeIngresosDesde } from '../services/asistenciasService';
import { useSocios } from './SociosContext';
import useAhora from '../hooks/useAhora';
import Avatar from '../components/Avatar';
import { entroVencido } from '../services/estadoCuota';

const IngresosContext = createContext(null);

// Listener único de los ingresos del día. Lo usan el Dashboard, la pantalla
// En sala y las notificaciones: con uno solo alcanza para todo el panel.
export function IngresosProvider({ children }) {
  const navigate = useNavigate();
  const { socios } = useSocios();
  const ahora = useAhora();
  const dia = new Date(ahora).toDateString();
  const [ingresos, setIngresos] = useState(null);
  const [actualizadoEn, setActualizadoEn] = useState(null);

  // Refs para leer el valor más reciente desde el callback del listener sin
  // tener que resuscribirlo cada vez que cambia el padrón.
  const vistos = useRef(null);
  const sociosRef = useRef(socios);
  sociosRef.current = socios;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    vistos.current = null;
    const medianoche = new Date();
    medianoche.setHours(0, 0, 0, 0);

    return subscribeIngresosDesde(medianoche, (data) => {
      // La primera tanda son los ingresos que ya existían: se toman como
      // punto de partida, sin notificar. Solo avisan los que llegan después.
      if (vistos.current) {
        data
          .filter((i) => !vistos.current.has(i.id))
          .forEach((i) => notificarIngreso(i, sociosRef.current, navigateRef.current));
      }
      vistos.current = new Set(data.map((i) => i.id));
      setIngresos(data);
      setActualizadoEn(Date.now());
    }, (error) => {
      console.error('[admin-web] ingresos de hoy:', error);
      setIngresos([]);
    });
  }, [dia]);

  return (
    <IngresosContext.Provider value={{ ingresos, ahora, actualizadoEn }}>
      {children}
    </IngresosContext.Provider>
  );
}

export function useIngresos() {
  const ctx = useContext(IngresosContext);
  if (!ctx) throw new Error('useIngresos debe usarse dentro de <IngresosProvider>');
  return ctx;
}

function notificarIngreso(ingreso, socios, navigate) {
  const socio   = socios.find((s) => s.dni === ingreso.dni);
  const vencido = entroVencido(ingreso, socio);
  const hora    = (ingreso.fechaHora?.toDate?.() ?? new Date())
    .toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  toast(
    <div className="flex items-center gap-3">
      <Avatar
        nombre={socio?.nombre ?? ingreso.nombre ?? '?'}
        apellido={socio?.apellido}
        foto={socio?.fotoBase64 ?? socio?.fotoApp}
        size="md"
      />
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-bold text-text">{ingreso.nombre}</p>
        <p className="num text-xs text-textSecondary">
          Ingresó a las {hora}
          {' · '}
          <span className={vencido ? 'font-bold text-danger' : 'font-bold text-accent'}>
            {ingreso.estado === 'manual' ? (vencido ? 'carga manual · cuota vencida' : 'carga manual') : vencido ? 'cuota vencida' : 'al día'}
          </span>
        </p>
      </div>
    </div>,
    {
      icon: false,
      onClick: () => navigate(`/socios/${ingreso.dni}`),
      // Un vencido que entra es lo que más le importa a recepción: se
      // distingue con el borde rojo y queda más tiempo en pantalla.
      style: vencido ? { borderLeft: '3px solid #ffb4ab' } : { borderLeft: '3px solid #c3f400' },
      autoClose: vencido ? 9000 : 5000,
    },
  );
}
