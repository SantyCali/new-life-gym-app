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

export async function updateConvenio(id, data) {
  await updateDoc(doc(db, 'convenios', id), data);
}

export async function deleteConvenio(id) {
  await deleteDoc(doc(db, 'convenios', id));
}
