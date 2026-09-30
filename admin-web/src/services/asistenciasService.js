import {
  collection, addDoc, query, where, serverTimestamp, Timestamp, onSnapshot,
  doc, updateDoc, deleteField,
} from 'firebase/firestore';
import { db } from '../firebase';

// Reutiliza `ingresosActivos`, la misma colección que ya usa la app mobile
// para el check-in en vivo (ventana de 90 min). Los documentos no se borran
// al salir de esa ventana — solo se filtran por fecha en las queries que
// necesitan "presencia actual" (gymService.js) — así que también sirve, sin
// crear ninguna colección nueva, como historial permanente de asistencias
// por socio.
const COL = collection(db, 'ingresosActivos');

function porFechaDesc(a, b) {
  return (b.fechaHora?.toMillis?.() ?? 0) - (a.fechaHora?.toMillis?.() ?? 0);
}

// El orden se hace en cliente a propósito: combinar where('dni') con
// orderBy('fechaHora') obliga a crear un índice compuesto en Firestore, y los
// ingresos de un solo socio son pocos como para que valga la pena.
export function subscribeAsistenciasDeSocio(dni, onData, onError) {
  return onSnapshot(
    query(COL, where('dni', '==', dni.trim())),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(porFechaDesc)),
    onError,
  );
}

// Ingresos desde `desde` (la medianoche de hoy): alimenta el conteo de gente
// en sala, la curva por hora y los últimos accesos con un solo listener.
export function subscribeIngresosDesde(desde, onData, onError) {
  return onSnapshot(
    query(COL, where('fechaHora', '>', Timestamp.fromDate(desde))),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(porFechaDesc)),
    onError,
  );
}

export function contarIngresosDelMes(asistencias) {
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const desde = inicioMes.getTime();
  return asistencias.filter((a) => (a.fechaHora?.toMillis?.() ?? 0) >= desde).length;
}

// Marca que la persona se fue antes de los 90 min. No se borra el documento
// (la app mobile lo hace) para que el ingreso siga contando en el historial
// de asistencias; `activo: false` ya lo excluye del conteo en sala tanto acá
// como en la app.
export async function marcarSalida(ingresoId) {
  await updateDoc(doc(db, 'ingresosActivos', ingresoId), {
    activo: false,
    salidaEn: serverTimestamp(),
  });
}

export async function deshacerSalida(ingresoId) {
  await updateDoc(doc(db, 'ingresosActivos', ingresoId), {
    activo: true,
    salidaEn: deleteField(),
  });
}

export async function registrarAsistencia(nombre, dni) {
  await addDoc(COL, {
    nombre,
    dni: dni.trim(),
    estado: 'manual',
    fechaHora: serverTimestamp(),
    activo: true,
  });
}

// Espejo de src/hooks/useGymCheckins.js de la app mobile: cuenta cada ingreso
// (no personas distintas) de los últimos 90 min que no esté marcado inactivo.
// Se replica tal cual para que el panel y el celular muestren el mismo número.
const VENTANA_EN_SALA_MS = 90 * 60 * 1000;

export function filtrarEnSala(ingresos, ahora) {
  return ingresos.filter((i) => {
    if (i.activo === false) return false;
    const ms = i.fechaHora?.toMillis?.() ?? 0;
    return ms > 0 && ahora - ms < VENTANA_EN_SALA_MS;
  });
}

// Mismos umbrales y colores que statusFor() en src/screens/GymScreen.js.
export function estadoAforo(cantidad) {
  if (cantidad === 0)  return { id: 'vacio',     label: 'Vacío',     color: '#6B7280' };
  if (cantidad <= 14)  return { id: 'tranquilo', label: 'Tranquilo', color: '#22C55E' };
  if (cantidad <= 21)  return { id: 'moderado',  label: 'Moderado',  color: '#EAB308' };
  return                      { id: 'lleno',     label: 'Lleno',     color: '#EF4444' };
}

// Ingresos agrupados por hora del día, para el histograma de flujo.
export function agruparPorHora(ingresos) {
  const porHora = Array(24).fill(0);
  ingresos.forEach((i) => {
    const fecha = i.fechaHora?.toDate?.();
    if (fecha) porHora[fecha.getHours()] += 1;
  });
  return porHora;
}

// Pases restantes bajo el plan vigente: cupo del plan (diasPorMes) menos
// asistencias registradas desde que empezó ese plan.
export function calcularPasesRestantes(planVigente, asistencias) {
  if (!planVigente) return null;
  const inicioMs = planVigente.fechaInicio?.toMillis?.() ?? 0;
  const usados = asistencias.filter((a) => (a.fechaHora?.toMillis?.() ?? 0) >= inicioMs).length;
  return Math.max((planVigente.diasPorMes ?? 0) - usados, 0);
}
