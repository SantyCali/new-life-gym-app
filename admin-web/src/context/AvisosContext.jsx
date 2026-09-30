import { useEffect, useRef } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { db } from '../firebase';
import Icon from '../components/Icon';

// Avisos de la app para los entrenadores (por ahora: alguien se armó o
// modificó su propia rutina; ver src/services/avisosService.js de la app). Muestra un
// cartel por cada aviso nuevo mientras el panel está abierto. Los que ya
// existían al abrirlo no se muestran.
export function AvisosProvider({ children }) {
  const vistos = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'avisos'), orderBy('fecha', 'desc'), limit(20));
    return onSnapshot(q, (snap) => {
      const ids = snap.docs.map((d) => d.id);
      if (vistos.current) {
        snap.docs
          .filter((d) => !vistos.current.has(d.id))
          .forEach((d) => mostrarAviso(d.data()));
      }
      vistos.current = new Set(ids);
    }, (error) => console.error('[admin-web] avisos:', error));
  }, []);

  return children;
}

function mostrarAviso(aviso) {
  if (aviso.tipo !== 'rutina') return;
  toast(
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Icon name="fitness_center" className="text-lg" />
      </span>
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-bold text-text">{aviso.alumnoNombre}</p>
        <p className="text-xs text-textSecondary">{aviso.accion} en la app</p>
      </div>
    </div>,
    { icon: false, style: { borderLeft: '3px solid #00dbe9' }, autoClose: 8000 },
  );
}
