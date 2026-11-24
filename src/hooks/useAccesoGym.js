import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { refPrivado } from '../services/perfilPrivadoService';

// Rutina y gym son para los socios con la cuota al día. Si no, la app queda
// como podómetro (sin rutina ni gente en el gym; RutinaScreen, HomeScreen,
// GymScreen y el Perfil):
//   - 'noSocio': cuenta creada desde CORTE cuyo DNI no está en el padrón
//     (socios = el Excel de recepción). Las de antes siguen como estaban
//     (familiares que se sumaron para probar antes de salir en las tiendas).
//   - 'vencida': su cuota venció (misma regla que la web y el control de la
//     entrada: el propio día del vencimiento todavía vale). Se destraba sola
//     apenas recepción la renueva.
// Los entrenadores siempre pueden. Excepciones sin pasar por el Excel: uids
// en config/accesoApp.permitidos (lo cargan los entrenadores).
//
// Se calcula una sola vez para toda la app (AccesoGymProvider). Ante un error
// de red se usa lo último que se supo, y si no se sabe nada, se deja pasar:
// mejor eso que dejar afuera a un socio por mala señal.
export const CORTE = new Date('2026-10-31T00:00:00-03:00').getTime();
const GRACIA_MS = 24 * 60 * 60 * 1000;
const claveEstado = (uid) => `accesoGym_${uid}`;
const soloNumeros = (v) => String(v ?? '').replace(/\D/g, '');

// Sin control: entrenadores y sin sesión.
export function esExento(user, isTrainer) {
  return !user || !!isTrainer;
}

export function creadaAntesDelCorte(user) {
  const creada = Date.parse(user?.metadata?.creationTime ?? '') || 0;
  return creada > 0 && creada < CORTE;
}

export function dnisDe(...fuentes) {
  return [...new Set(fuentes.flatMap((f) => [f?.gymDni, f?.dni]).map(soloNumeros).filter(Boolean))];
}

export function cuotaVencida(fechaVencimiento, ahora = Date.now()) {
  const ms = fechaVencimiento?.toMillis?.() ?? null;
  return ms != null && ms < ahora - GRACIA_MS;
}

// { estado: 'ok' | 'noSocio' | 'vencida', socio }
export async function revisarAcceso(user, dnis) {
  for (const dni of dnis) {
    const snap = await getDoc(doc(db, 'socios', dni));
    if (snap.exists()) {
      const socio = { dni, ...snap.data() };
      return { estado: cuotaVencida(socio.fechaVencimiento) ? 'vencida' : 'ok', socio };
    }
  }
  if (creadaAntesDelCorte(user)) return { estado: 'ok', socio: null };
  const cfg = await getDoc(doc(db, 'config', 'accesoApp'));
  const permitido = cfg.exists() && (cfg.data().permitidos ?? []).includes(user.uid);
  return { estado: permitido ? 'ok' : 'noSocio', socio: null };
}

const AccesoCtx = createContext({ estado: 'ok', dni: '', vence: null, reintentar: () => {} });

export function AccesoGymProvider({ user, isTrainer, children }) {
  const exento = esExento(user, isTrainer);
  const [res, setRes] = useState({ estado: 'cargando', dni: '', vence: null });
  const [intento, setIntento] = useState(0);
  const dnisRef = useRef([]);

  useEffect(() => {
    if (exento) return;
    let vivo = true;
    const uid = user.uid;
    let unsubSocio = () => {};
    if (dnisRef.uid !== uid) {
      // Otra cuenta: se empieza de cero.
      dnisRef.uid = uid;
      dnisRef.current = [];
      setRes({ estado: 'cargando', dni: '', vence: null });
    }

    const guardar = (r) => {
      if (!vivo) return;
      setRes(r);
      AsyncStorage.setItem(claveEstado(uid), JSON.stringify({ estado: r.estado, dni: r.dni })).catch(() => {});
    };

    // Lo último que se supo, para no mostrar la rutina un instante y sacarla.
    AsyncStorage.getItem(claveEstado(uid)).then((v) => {
      const g = v ? JSON.parse(v) : null;
      if (vivo && g?.estado) setRes((r) => (r.estado === 'cargando' ? { estado: g.estado, dni: g.dni ?? '', vence: null } : r));
    }).catch(() => {});
    // Sin señal y sin nada guardado no se queda colgado en la carga.
    const tope = setTimeout(() => { if (vivo) setRes((r) => (r.estado === 'cargando' ? { ...r, estado: 'ok' } : r)); }, 8000);

    const revisar = async () => {
      try {
        let dnis = dnisRef.current;
        if (!dnis.length) {
          // Cuentas viejas que todavía tienen el DNI en el perfil público.
          const pub = await getDoc(doc(db, 'users', uid));
          dnis = dnisDe(pub.exists() ? pub.data() : null);
        }
        const r = await revisarAcceso(user, dnis);
        if (!vivo) return;
        guardar({ estado: r.estado, dni: r.socio?.dni ?? dnis[0] ?? '', vence: r.socio?.fechaVencimiento ?? null });
        // Escucha su cuota: si recepción la renueva, se destraba sola (y si
        // vence con la app abierta, se traba).
        unsubSocio();
        if (r.socio) {
          unsubSocio = onSnapshot(doc(db, 'socios', r.socio.dni), (s) => {
            if (!s.exists()) { revisar(); return; }
            const vence = s.data().fechaVencimiento ?? null;
            guardar({ estado: cuotaVencida(vence) ? 'vencida' : 'ok', dni: r.socio.dni, vence });
          }, () => {});
        }
      } catch {
        if (vivo) setRes((x) => (x.estado === 'cargando' ? { ...x, estado: 'ok' } : x));
      }
    };

    // El DNI está en el perfil privado; recién registrado puede tardar un
    // instante en existir, por eso se escucha en vez de leerlo una vez.
    let primera = true;
    const unsubPriv = onSnapshot(refPrivado(uid), (snap) => {
      if (!snap.exists() && snap.metadata.fromCache) return; // todavía no llegó
      const dnis = dnisDe(snap.exists() ? snap.data() : null);
      const cambio = dnis.join() !== dnisRef.current.join();
      dnisRef.current = dnis;
      if (cambio || primera) revisar();
      primera = false;
    }, () => revisar());

    // La cuota vence a la medianoche: al volver a la app se revisa de nuevo.
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') revisar(); });

    return () => { vivo = false; clearTimeout(tope); unsubPriv(); unsubSocio(); sub.remove(); };
  }, [user?.uid, exento, intento]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);
  const valor = exento ? { estado: 'ok', dni: '', vence: null, reintentar } : { ...res, reintentar };
  return createElement(AccesoCtx.Provider, { value: valor }, children);
}

// { estado: 'cargando' | 'ok' | 'noSocio' | 'vencida', dni, vence, reintentar }
export default function useAccesoGym() {
  return useContext(AccesoCtx);
}

// Rutina y gym bloqueados (la app queda como podómetro).
export function esSoloPodometro(estado) {
  return estado === 'noSocio' || estado === 'vencida';
}
