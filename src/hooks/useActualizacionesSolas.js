// Updates (EAS Update) sin tener que cerrar la app del todo.
//
// Expo busca updates solo cuando la app arranca de cero. En Android eso casi
// nunca pasa: el contador de pasos (la notificación fija) mantiene la app viva,
// y aunque la deslicen para cerrarla, al abrirla de nuevo no arranca de cero.
// Por eso a ningún Android le llegaban los updates.
//
// Ahora, cada vez que la app pasa al frente (como mucho una vez cada 15 min):
//   1. se fija si hay un update nuevo y, si hay, lo baja en silencio;
//   2. la próxima vez que la abren, se recarga con el update nuevo (se ve el
//      logo un segundito). No se recarga mientras la están usando.
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

const CADA_MS = 15 * 60 * 1000;

export default function useActualizacionesSolas() {
  const ultimaRevision = useRef(0);
  const listo = useRef(false);     // ya se bajó un update: aplicarlo al volver
  const revisando = useRef(false);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    const revisar = async () => {
      if (revisando.current || listo.current) return;
      if (Date.now() - ultimaRevision.current < CADA_MS) return;
      revisando.current = true;
      ultimaRevision.current = Date.now();
      try {
        const r = await Updates.checkForUpdateAsync();
        if (r.isAvailable) {
          const bajado = await Updates.fetchUpdateAsync();
          if (bajado.isNew) listo.current = true;
        }
      } catch {}
      revisando.current = false;
    };

    revisar();
    let estado = AppState.currentState;
    const sub = AppState.addEventListener('change', (nuevo) => {
      const volvio = estado !== 'active' && nuevo === 'active';
      estado = nuevo;
      if (!volvio) return;
      if (listo.current) {
        Updates.reloadAsync().catch(() => {});
        return;
      }
      revisar();
    });
    return () => sub.remove();
  }, []);
}
