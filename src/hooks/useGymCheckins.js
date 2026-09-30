import { useState, useEffect, useMemo } from 'react';
import { subscribeToGymCheckins, ACTIVE_MS } from '../services/gymService';

// Quiénes están en el gym ahora y cuántos ingresos hubo hoy. La lista trae
// nombres: las pantallas se la muestran solo a los entrenadores; al resto
// solo el número.
export default function useGymCheckins() {
  const [all, setAll]         = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow]         = useState(() => Date.now());

  useEffect(() => {
    const unsub = subscribeToGymCheckins((data) => {
      setAll(data);
      setLoading(false);
    });
    // Recalcula cada 60 s para que los ingresos venzan sin esperar a Firestore.
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => { unsub(); clearInterval(tick); };
  }, []);

  const active = useMemo(() => {
    return all.filter(c => {
      if (c.activo === false) return false;
      const ms = c.fechaHora?.toMillis?.() ?? 0;
      return ms > 0 && (now - ms) < ACTIVE_MS;
    });
  }, [all, now]);

  const ingresosHoy = useMemo(() => {
    const medianoche = new Date(now);
    medianoche.setHours(0, 0, 0, 0);
    return all.filter(c => (c.fechaHora?.toMillis?.() ?? 0) >= medianoche.getTime()).length;
  }, [all, now]);

  return { active, activeCount: active.length, ingresosHoy: loading ? null : ingresosHoy, loading };
}
