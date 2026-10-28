import {
  collection, doc, addDoc, getDocs, updateDoc, deleteDoc, query, orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';

// Catálogo nuevo — la app mobile no lo usa, así que no hay riesgo de
// pisar nada existente. Referenciado desde socios.convenioId.
const COL = collection(db, 'convenios');

export async function getAllConvenios() {
  const snap = await getDocs(query(COL, orderBy('nombre')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createConvenio({ nombre, descuentoPorcentaje }) {
  const ref = await addDoc(COL, {
    nombre: nombre.trim(),
    descuentoPorcentaje: Number(descuentoPorcentaje) || 0,
    activo: true,
  });
  return ref.id;
}

// Porcentaje de descuento del convenio. Los creados desde la ficha del socio
// quedaban con 0 y el porcentaje solo en el nombre ("descuento 10%"): si no
// tiene uno cargado, se toma el del nombre.
export function porcentajeDeConvenio(convenio) {
  const guardado = Number(convenio?.descuentoPorcentaje) || 0;
  if (guardado > 0) return Math.min(100, guardado);
  const m = String(convenio?.nombre ?? '').match(/(\d+(?:[.,]\d+)?)\s*%/);
  return m ? Math.min(100, Number(m[1].replace(',', '.'))) : 0;
}

// Precio con el descuento aplicado, redondeado a pesos.
export function precioConDescuento(precio, porcentaje) {
  const p = Number(precio) || 0;
  return Math.round(p * (1 - (Number(porcentaje) || 0) / 100));
}

export async function updateConvenio(id, data) {
  await updateDoc(doc(db, 'convenios', id), data);
}

export async function deleteConvenio(id) {
  await deleteDoc(doc(db, 'convenios', id));
}
