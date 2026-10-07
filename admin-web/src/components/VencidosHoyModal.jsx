import { Link } from 'react-router-dom';
import { ESTADOS, entroVencido, etiquetaEstado } from '../services/estadoCuota';
import Modal from './Modal';
import Avatar from './Avatar';
import Badge from './Badge';
import EmptyState from './EmptyState';
import Icon from './Icon';

// Quién entró hoy con la cuota vencida, según lo que registró el control de
// acceso en ese momento. Muestra además el estado actual, porque puede que
// ya haya pagado después de entrar.
export default function VencidosHoyModal({ ingresos, porDni, onClose }) {
  // Incluye las cargas manuales de quien tenía la cuota vencida (ver entroVencido).
  const vencidos = ingresos.filter((i) => entroVencido(i, porDni.get(i.dni)));

  return (
    <Modal title={`Entraron con la cuota vencida · ${vencidos.length}`} onClose={onClose} wide>
      {vencidos.length === 0 ? (
        <EmptyState
          icon={<Icon name="verified" className="text-xl" />}
          title="Nadie entró vencido hoy"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {vencidos.map((i) => {
            const socio = porDni.get(i.dni);
            const ahora = socio ? etiquetaEstado(socio) : null;
            const yaPago = socio && (socio.estado === 'aldia' || socio.estado === 'proximo');
            return (
              <div key={i.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surfaceLow p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar nombre={socio?.nombre ?? i.nombre ?? '?'} foto={socio?.fotoBase64 ?? socio?.fotoApp} size="md" />
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-bold text-text">{i.nombre}</p>
                    <p className="num text-xs text-textSecondary">
                      Entró {i.fechaHora?.toDate?.().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      {' · '}DNI {i.dni}
                    </p>
                    {socio?.fechaVencimiento && (
                      <p className="num text-xs text-textTertiary">
                        Vence {socio.fechaVencimiento.toDate().toLocaleDateString('es-AR')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {yaPago
                    ? <Badge variant="success">Ya renovó</Badge>
                    : ahora && <Badge variant={ahora.variant}>{ahora.label}</Badge>}
                  <Link to={`/socios/${i.dni}`} onClick={onClose} className="btn-outline btn-sm">
                    {yaPago ? 'Ver ficha' : 'Cobrar / renovar'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
