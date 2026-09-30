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

export async function getCatalogoPlanes() {
  const snap = await getDocs(query(CATALOGO, orderBy('nombre')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createPlan({ nombre, grupoActividad, cantidadMeses, diasPorMes, precio }) {
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
  await updateDoc(doc(db, 'planes', id), data);
}

export async function deletePlan(id) {
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

// Asigna un plan del catálogo a un socio: agrega la entrada al historial y
// actualiza socios/{dni}.fechaVencimiento (el mismo campo que ya usa la app
// mobile para calcular "vencido / próximo a vencer / al día").
export async function asignarPlan(dni, plan, fechaInicio) {
  const inicio = fechaInicio ?? new Date();
  const vencimiento = new Date(inicio);
  vencimiento.setMonth(vencimiento.getMonth() + (Number(plan.cantidadMeses) || 1));

  await addDoc(historialCol(dni), {
    planId: plan.id,
    nombrePlan: plan.nombre,
    grupoActividad: plan.grupoActividad ?? '',
    cantidadMeses: plan.cantidadMeses ?? 1,
    diasPorMes: plan.diasPorMes ?? 0,
    precio: plan.precio ?? 0,
    fechaInicio: Timestamp.fromDate(inicio),
    fechaVencimiento: Timestamp.fromDate(vencimiento),
    habilitado: true,
  });

  // Por sociosService y no con updateDoc directo: así el nuevo vencimiento
  // también llega al Excel, que es lo que consulta el control de acceso.
  const { excel } = await setFechaVencimiento(dni, vencimiento);

  return { vencimiento, excel };
}

export async function eliminarPlanAsignado(dni, planAsignadoId) {
  await deleteDoc(doc(db, 'socios', dni, 'planesAsignados', planAsignadoId));
}
