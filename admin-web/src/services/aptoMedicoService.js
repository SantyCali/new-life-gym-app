import { doc, getDoc, setDoc, deleteDoc, updateDoc, deleteField, Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

// Apto médico (certificado) de cada socio.
//
// No hay Firebase Storage en el proyecto, así que el archivo (foto comprimida
// o PDF chico) se guarda como texto en su propio documento:
// socios/{dni}/documentos/aptoMedico. Aparte del socio a propósito: la lista
// de socios se carga entera y no conviene arrastrar el certificado de todos.
// Las reglas de socios/{dni}/{sub}/{doc} ya dejan leerlo y escribirlo solo a
// los entrenadores (es un dato de salud).
//
// En el socio quedan solo los datos para mostrar el estado sin abrir el
// archivo: certificadoMedico (true/false, como antes), aptoEmision y aptoVence.

// Firestore acepta hasta 1 MB por documento: se deja margen para lo demás.
export const MAX_CARACTERES = 900_000;

const ref = (dni) => doc(db, 'socios', String(dni).trim(), 'documentos', 'aptoMedico');

export async function getAptoMedico(dni) {
  const snap = await getDoc(ref(dni));
  return snap.exists() ? snap.data() : null;
}

// archivo: data URL (image/jpeg o application/pdf).
export async function guardarAptoMedico(dni, { archivo, tipo, nombreArchivo, emision, vence }) {
  if (!archivo || archivo.length > MAX_CARACTERES) throw new Error('El archivo es demasiado pesado.');
  const em = Timestamp.fromDate(emision);
  const ve = Timestamp.fromDate(vence);
  await setDoc(ref(dni), {
    archivo,
    tipo,
    nombreArchivo: nombreArchivo ?? '',
    emision: em,
    vence: ve,
    cargadoEn: Timestamp.now(),
    cargadoPor: auth.currentUser?.email ?? '',
  });
  await updateDoc(doc(db, 'socios', String(dni).trim()), {
    certificadoMedico: true,
    aptoEmision: em,
    aptoVence: ve,
  });
}

// Solo cambiar las fechas, sin volver a subir el archivo.
export async function cambiarFechasApto(dni, { emision, vence }) {
  const em = Timestamp.fromDate(emision);
  const ve = Timestamp.fromDate(vence);
  await updateDoc(ref(dni), { emision: em, vence: ve });
  await updateDoc(doc(db, 'socios', String(dni).trim()), { aptoEmision: em, aptoVence: ve });
}

export async function borrarAptoMedico(dni) {
  await deleteDoc(ref(dni)).catch(() => {});
  await updateDoc(doc(db, 'socios', String(dni).trim()), {
    certificadoMedico: false,
    aptoEmision: deleteField(),
    aptoVence: deleteField(),
  });
}

// Estado para mostrar: sin cargar, vigente, por vencer (≤ 30 días) o vencido.
// Los socios que tenían "presentado" tildado a mano (sin archivo ni fecha)
// figuran como presentados, igual que antes.
export function estadoApto(socio, ahora = new Date()) {
  const vence = socio?.aptoVence?.toDate?.();
  if (!socio?.certificadoMedico) return { id: 'falta', label: 'No presentado' };
  if (!vence) return { id: 'presentado', label: 'Presentado' };
  const dias = Math.ceil((vence - ahora) / 86_400_000);
  if (dias < 0) return { id: 'vencido', label: `Vencido el ${vence.toLocaleDateString('es-AR')}`, vence };
  if (dias <= 30) return { id: 'porVencer', label: `Vence el ${vence.toLocaleDateString('es-AR')}`, vence };
  return { id: 'vigente', label: `Vigente hasta el ${vence.toLocaleDateString('es-AR')}`, vence };
}

// Foto → JPEG comprimido que se lea bien (letra chica de un certificado) y
// entre en el documento: arranca grande y achica hasta que entre.
export async function prepararArchivo(file) {
  const esPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (esPdf) {
    const url = await leerComoDataUrl(file);
    if (url.length > MAX_CARACTERES) {
      throw new Error('El PDF es muy pesado (más de ~650 KB). Sacale una foto al certificado y subí la foto.');
    }
    return { archivo: url, tipo: 'pdf', nombreArchivo: file.name };
  }
  if (!file.type.startsWith('image/')) throw new Error('Subí una foto (JPG, PNG) o un PDF.');
  const img = await cargarImagen(await leerComoDataUrl(file));
  for (const [lado, calidad] of [[1800, 0.8], [1500, 0.75], [1200, 0.7], [1000, 0.65], [800, 0.6]]) {
    const url = comprimir(img, lado, calidad);
    if (url.length <= MAX_CARACTERES) return { archivo: url, tipo: 'imagen', nombreArchivo: file.name };
  }
  throw new Error('No se pudo achicar la foto lo suficiente. Probá con otra foto.');
}

function leerComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
}

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('No se pudo abrir la foto. Probá con JPG o PNG.'));
    img.onload = () => resolve(img);
    img.src = src;
  });
}

function comprimir(img, lado, calidad) {
  const escala = Math.min(1, lado / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * escala);
  canvas.height = Math.round(img.height * escala);
  const ctx = canvas.getContext('2d');
  // Fondo blanco: los PNG transparentes quedaban negros en JPEG.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', calidad);
}
