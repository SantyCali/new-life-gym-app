import { useState, useEffect } from 'react';
import { subscribeToDailyMissions } from '../services/misionesService';

export default function useDailyMissions() {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const unsub = subscribeToDailyMissions((data) => {
      setMissions(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { missions, loading };
}