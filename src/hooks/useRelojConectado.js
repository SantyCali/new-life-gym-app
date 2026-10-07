// ¿Hay un reloj o pulsera pasando pasos? Para el puntito naranja del Inicio.
//   - Android: la lectura del reloj está activa, con permiso, y alguna app de
//     reloj (Mi Fitness, Samsung Health…) escribe pasos en Health Connect.
//   - iPhone: alguna app que no es el propio iPhone pasó pasos a Salud en la
//     última semana (Apple Watch, Mi Fitness…).
// Se revisa al entrar a la pantalla, al volver a la app y cada 2 minutos.
// En Android, al volver a la app también pide leer el reloj en el momento,
// así los pasos que el reloj ya sincronizó aparecen enseguida.
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { relojDisponible, estadoReloj, leerRelojAhora } from '../services/nativeStepService';
import { relojEnSalud } from '../services/stepService';

const ES_IOS = Platform.OS === 'ios';
const CADA_MS = 2 * 60 * 1000;

async function leerEstado() {
  if (ES_IOS) {
    const r = await relojEnSalud();
    const apps = r?.apps ?? [];
    return apps.length ? { apps } : null;
  }
  if (!relojDisponible) return null;
  const e = await estadoReloj();
  if (!e?.activa || !e?.permiso) return null;
  const apps = (e.apps ?? []).filter((a) => a !== 'Este celular');
  return apps.length ? { apps, pasosHoy: e.pasosHoy ?? 0 } : null;
}

export default function useRelojConectado() {
  const [reloj, setReloj] = useState(null);   // null = sin reloj; { apps, pasosHoy? }

  const refrescar = useCallback(() => {
    leerEstado().then(setReloj).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => {
    refrescar();
    const t = setInterval(refrescar, CADA_MS);
    return () => clearInterval(t);
  }, [refrescar]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      if (!ES_IOS) leerRelojAhora();
      setTimeout(refrescar, 1500);
    });
    return () => sub.remove();
  }, [refrescar]);

  return reloj;
}
