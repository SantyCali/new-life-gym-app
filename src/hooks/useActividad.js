import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { registrarActividad, salirDeLaApp } from '../services/actividadService';

const LATIDO_MS = 2 * 60 * 1000;     // "estoy acá" cada 2 min con la app al frente (cuida el límite gratis de Firebase)
const NUEVA_APERTURA_MS = 5 * 60 * 1000; // volver después de 5 min cuenta como otra apertura

// Registra la actividad del usuario en la app (ver actividadService).
export default function useActividad(uid, nombre, apellido) {
  const datosRef = useRef({ nombre, apellido });
  datosRef.current = { nombre: nombre ?? '', apellido: apellido ?? '' };

  useEffect(() => {
    if (!uid) return;
    let latido = null;
    let salioEn = 0;

    const arrancar = (abrio) => {
      registrarActividad(uid, { abrio, ...datosRef.current });
      clearInterval(latido);
      latido = setInterval(() => registrarActividad(uid, datosRef.current), LATIDO_MS);
    };

    arrancar(true);
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') {
        arrancar(salioEn > 0 && Date.now() - salioEn >= NUEVA_APERTURA_MS);
        salioEn = 0;
      } else if (estado === 'background') {
        clearInterval(latido);
        salioEn = Date.now();
        salirDeLaApp(uid);
      }
    });
    return () => { clearInterval(latido); sub.remove(); };
  }, [uid]);

  // Cuando termina de cargar el perfil, el nombre se guarda en el momento.
  useEffect(() => {
    if (uid && nombre) registrarActividad(uid, { nombre, apellido: apellido ?? '' });
  }, [uid, nombre, apellido]);
}
