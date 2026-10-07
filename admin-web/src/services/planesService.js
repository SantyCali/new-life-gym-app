import {
  collection, doc, addDoc, getDocs, getDoc, updateDoc, deleteDoc, setDoc,
  query, orderBy, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { setFechaVencimiento } from './sociosService';

// Catálogo de planes — colección nueva, no la usa la app mobile.
// Campos confirmados por la referencia: nombre, grupoActividad,
// cantidadMeses, diasPorMes (cupo de asistencias), precio.
const CATALOGO = collection(db, 'planes');

// El catálogo queda en memoria: la ventana de "Renovar cuota" lo muestra al
// instante (se precarga al abrir la ficha del socio) y lo refresca de fondo.
let catalogoEnMemoria = null;

export function catalogoGuardado() {
  return catalogoEnMemoria;
}

export async function getCatalogoPlanes() {
  const snap = await getDocs(query(CATALOGO, orderBy('nombre')));
  catalogoEnMemoria = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return catalogoEnMemoria;
}

export async function createPlan({ nombre, grupoActividad, cantidadMeses, diasPorMes, precio }) {
  catalogoEnMemoria = null;
  const ref = await addDoc(CATALOGO, {
    nombre: nombre.trim(),
    grupoActividad: (grupoActividad ?? '').trim(),
    cantidadMeses: Number(cantidadMeses) || 1,
    diasPorMes: Number(diasPorMes) || 0,
    precio: Number(precio) || 0,
    habilitado: true,
  });
  return ref.id;
}

export async function updatePlan(id, data) {
  catalogoEnMemoria = null;
  await updateDoc(doc(db, 'planes', id), data);
}

export async function deletePlan(id) {
  catalogoEnMemoria = null;
  await deleteDoc(doc(db, 'planes', id));
}

// Historial de planes asignados a un socio: subcolección socios/{dni}/planesAsignados.
// Es información nueva (la app mobile no la lee ni la escribe), así que crearla
// no pisa nada existente.
function historialCol(dni) {
  return collection(db, 'socios', dni, 'planesAsignados');
}

export async function getPlanesDeSocio(dni) {
  const snap = await getDocs(query(historialCol(dni), orderBy('fechaInicio', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Renovar la cuota: el único lugar que cambia el vencimiento del socio. Antes
// "Asignar plan" calculaba otro vencimiento por su cuenta (desde hoy) y pisaba
// el de "Renovar cuota": quedaban un mes de más o fechas mezcladas, y dos
// planes vigentes a la vez.
//   plan:  el plan del catálogo que se le carga (o null: solo se corrige la fecha)
//   desde: desde cuándo corre (el vencimiento actual al renovar, u hoy)
//   hasta: el nuevo vencimiento (socios/{dni}.fechaVencimiento, el mismo campo
//          que usa la app mobile para "vencido / por vencer / al día")
// Si el plan anterior todavía corría después de `desde`, se corta ahí y deja
// de ser el vigente.
export async function renovarCuota(dni, { plan, desde, hasta }) {
  const anteriores = await getDocs(historialCol(dni));
  if (plan) {
    // Los que seguían corriendo después de `desde` se cortan ahí; los que
    // ni habían empezado (una renovación por adelantado) se borran.
    await Promise.all(anteriores.docs
      .filter((d) => d.data().habilitado !== false && (d.data().fechaVencimiento?.toDate?.() ?? 0) > desde)
      .map((d) => ((d.data().fechaInicio?.toDate?.() ?? 0) >= desde
        ? deleteDoc(d.ref)
        : updateDoc(d.ref, { habilitado: false, fechaVencimiento: Timestamp.fromDate(desde) }))));

    await addDoc(historialCol(dni), {
      planId: plan.id,
      nombrePlan: plan.nombre,
      grupoActividad: plan.grupoActividad ?? '',
      cantidadMeses: plan.cantidadMeses ?? 1,
      diasPorMes: plan.diasPorMes ?? 0,
      precio: plan.precio ?? 0,
      fechaInicio: Timestamp.fromDate(desde),
      fechaVencimiento: Timestamp.fromDate(hasta),
      habilitado: true,
      cargadoEn: Timestamp.now(),
    });
  } else {
    // Solo se corrige la fecha: el plan que corre ahora pasa a terminar ahí,
    // así el historial coincide con el vencimiento.
    const historial = anteriores.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }))
      .sort((a, b) => (b.fechaInicio?.toMillis?.() ?? 0) - (a.fechaInicio?.toMillis?.() ?? 0));
    const vigente = planVigenteDe(historial);
    if (vigente && (vigente.fechaInicio?.toDate?.() ?? 0) < hasta) {
      await updateDoc(vigente.ref, { fechaVencimiento: Timestamp.fromDate(hasta) });
    }
  }

  // Por sociosService y no con updateDoc directo: así el nuevo vencimiento
  // también llega al Excel, que es lo que consulta el control de acceso.
  return setFechaVencimiento(dni, hasta);
}

// El plan que corre hoy: el que incluye la fecha de hoy (si se renovó por
// adelantado, el nuevo recién cuenta cuando empieza); si no, el último cargado.
export function planVigenteDe(historial) {
  const ahora = Date.now();
  const enCurso = historial.filter((p) => (p.fechaInicio?.toMillis?.() ?? 0) <= ahora
    && ahora < (p.fechaVencimiento?.toMillis?.() ?? 0));
  return enCurso.find((p) => p.habilitado !== false) ?? enCurso[0]
    ?? historial.find((p) => p.habilitado !== false) ?? historial[0] ?? null;
}

export async function eliminarPlanAsignado(dni, planAsignadoId) {
  await deleteDoc(doc(db, 'socios', dni, 'planesAsignados', planAsignadoId));
}
