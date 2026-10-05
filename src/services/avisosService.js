// Avisos para los entrenadores (por ahora: alguien se armó o modificó su
// propia rutina, sea alumno o entrenador; les llega a todos los entrenadores). Llegan por dos caminos:
//   - avisos/{id}: lo lee el panel web y muestra un cartel (ver
//     admin-web/src/context/AvisosContext.jsx).
//   - notificación push al celular de cada entrenador.
//
// Los códigos push de cada celular están en los datos personales, que un
// alumno no puede leer. Por eso cada entrenador publica el suyo, y solo ese
// dato, en pushEntrenadores/{uid} (ver usePushNotifications).
import {
  addDoc, collection, doc, getDocs, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

export async function registrarPushEntrenador(uid, token) {
  if (!uid || !token) return;
  await setDoc(doc(db, 'pushEntrenadores', uid), { token, actualizadoEn: serverTimestamp() });
}

export async function avisarRutinaDelAlumno({ uid, nombre, apellido, nueva }) {
  if (!uid) return;
  const alumno = `${nombre ?? ''} ${apellido ?? ''}`.trim() || 'Un alumno';
  const accion = nueva ? 'se armó su rutina' : 'modificó su rutina';

  await addDoc(collection(db, 'avisos'), {
    tipo: 'rutina',
    alumnoUid: uid,
    alumnoNombre: alumno,
    accion,
    fecha: serverTimestamp(),
  }).catch(() => {});

  try {
    const snap = await getDocs(collection(db, 'pushEntrenadores'));
    // A todos los entrenadores, también a quien hizo el cambio si es uno.
    const tokens = [...new Set(snap.docs.map((d) => d.data().token).filter(Boolean))];
    if (!tokens.length) return;
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(tokens.map((to) => ({
        to,
        title: nueva ? 'Rutina nueva' : 'Rutina modificada',
        body: `${alumno} ${accion}`,
        sound: 'default',
        channelId: 'default',
        priority: 'high',
        data: { tipo: 'rutina', alumnoUid: uid },
      }))),
    });
  } catch {}
}
