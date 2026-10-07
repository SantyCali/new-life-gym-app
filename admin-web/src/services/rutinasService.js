// Rutina de un socio, armada desde el panel web. Es la misma colección que usa
// la app (routines/{id}, ver src/services/routineService.js del proyecto Expo),
// así que lo que se guarda acá aparece al instante en el celular del socio.
//
// routines/{id} = { id, clienteId, entrenadorId, nombre, dias, creadaPor,
//                   editadaPor, creadoEn, actualizadoEn, … }
//   dias: [{ id, numero, nombre, ejercicios: [{ id, exerciseId, nombre,
//            grupoMuscular, series, repeticiones, carga, descanso,
//            observaciones, orden }] }]
// El panel agrega: socioDni, objetivos y observacion (los usa la planilla; la
// app los ignora).
//
// Socios sin la app: la rutina se guarda con clienteId "dni:<DNI>". Cuando el
// socio se baja la app y vincula el DNI, al abrir su rutina en el panel se le
// pasa a su cuenta (clienteId = uid) y ya la ve en el celular.
import {
  collection, doc, getDocs, limit, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../firebase';

const COL = collection(db, 'routines');

export const clientePorDni = (dni) => `dni:${String(dni).trim()}`;

export function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function buscar(clienteId) {
  const snap = await getDocs(query(COL, where('clienteId', '==', clienteId), limit(1)));
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// La rutina del socio: la de su cuenta de la app si tiene, o la guardada con
// su DNI. Si tiene cuenta y solo existe la del DNI, se la pasa a la cuenta.
export async function cargarRutina({ dni, uid, entrenadorUid }) {
  if (uid) {
    const deLaApp = await buscar(uid);
    if (deLaApp) return deLaApp;
  }
  const porDni = await buscar(clientePorDni(dni));
  if (porDni && uid) {
    await updateDoc(doc(db, 'routines', porDni.id), {
      clienteId: uid,
      entrenadorId: porDni.entrenadorId ?? entrenadorUid ?? null,
      actualizadoEn: serverTimestamp(),
    });
    return { ...porDni, clienteId: uid, pasadaALaApp: true };
  }
  return porDni;
}

// Guarda la rutina entera (mismo documento si ya existía). Los ejercicios se
// renumeran (orden) según cómo quedaron en cada día.
export async function guardarRutina({ rutina, dni, uid, entrenadorUid }) {
  const id = rutina.id ?? nuevoId();
  const dias = (rutina.dias ?? []).map((d, i) => ({
    id: d.id ?? nuevoId(),
    numero: i + 1,
    nombre: (d.nombre ?? '').trim(),
    ejercicios: (d.ejercicios ?? []).map((e, j) => ({
      id: e.id ?? nuevoId(),
      exerciseId: e.exerciseId ?? null,
      nombre: (e.nombre ?? '').trim() || 'Ejercicio',
      grupoMuscular: e.grupoMuscular ?? null,
      series: Number(e.series) || 4,
      repeticiones: Number(e.repeticiones) || 12,
      carga: e.carga === '' || e.carga == null || Number.isNaN(Number(e.carga)) ? null : Number(e.carga),
      descanso: Number(e.descanso) || 90,
      observaciones: (e.observaciones ?? '').trim(),
      orden: j,
    })),
  }));
  const datos = {
    id,
    clienteId: uid ?? clientePorDni(dni),
    entrenadorId: entrenadorUid ?? rutina.entrenadorId ?? null,
    socioDni: String(dni).trim(),
    nombre: (rutina.nombre ?? '').trim() || 'Rutina',
    objetivos: (rutina.objetivos ?? '').trim(),
    observacion: (rutina.observacion ?? '').trim(),
    dias,
    editadaPor: 'entrenador',
    actualizadoEn: serverTimestamp(),
  };
  if (!rutina.id) {
    datos.creadoEn = serverTimestamp();
    datos.creadaPor = 'entrenador';
  }
  if (rutina.plantillaId !== undefined) datos.plantillaId = rutina.plantillaId ?? null;
  await setDoc(doc(db, 'routines', id), datos, { merge: true });
  return { ...rutina, ...datos, id };
}

// Plantillas del gym (las mismas que arman los entrenadores en la app).
export function subscribePlantillas(onChange) {
  return onSnapshot(collection(db, 'plantillas'),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'))),
    () => onChange([]));
}

// Copia de los días de una plantilla, con ids nuevos (para no compartirlos).
export function diasDePlantilla(plantilla) {
  return (plantilla?.dias ?? []).map((d, i) => ({
    ...d,
    id: nuevoId(),
    numero: i + 1,
    ejercicios: (d.ejercicios ?? []).map((e) => ({ ...e, id: nuevoId() })),
  }));
}
