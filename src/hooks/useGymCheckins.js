import { useState, useEffect, useMemo } from 'react';
import { subscribeToGymCheckins } from '../services/gymService';

const ONE_HOUR_MS = 60 * 60 * 1000;

export default function useGymCheckins() {
  const [all, setAll]         = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow]         = useState(() => Date.now());

  useEffect(() => {
    const unsub = subscribeToGymCheckins((data) => {
      setAll(data);
      setLoading(false);
    });
    // Recalculate every 60 s so entries expire from the UI without a new Firestore event
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => { unsub(); clearInterval(tick); };
  }, []);

  const active = useMemo(() => {
    return all.filter(c => {
      if (c.activo === false) return false;
      const ms = c.fechaHora?.toMillis?.() ?? 0;
      return ms > 0 && (now - ms) < ONE_HOUR_MS;
    });
  }, [all, now]);

  return { active, activeCount: active.length, loading };
}