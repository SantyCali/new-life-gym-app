import {
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField,
  Timestamp, query, orderBy, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getEstadoCuota } from './estadoCuota';

// La colección `socios` es compartida con la app mobile y con el Excel (vía
// Apps Script, ver control-ingresos/control-ingresosv2.txt). Doc ID = DNI.
//
// Nombre: el Excel tiene Nombre y Apellido en columnas separadas, pero al
// subir a Firestore los junta en un solo campo `nombre` ("Santiago
// Calivares"), y así lo usa también la app. Acá se respeta lo mismo: `nombre`
// es siempre el nombre completo. No se guarda un apellido aparte, porque se
// desincronizaría la primera vez que alguien edite el nombre en el Excel.
//
// El Excel es la fuente que consulta el control de acceso de la entrada, así
// que TODO cambio de nombre o de vencimiento tiene que llegarle: si no, en la
// puerta seguiría figurando la cuota vieja.
const SHEETS_SYNC_URL = 'https://script.google.com/macros/s/AKfycbwsM2B2MFSzH9QHGBQnaGaDJ29CpUlhJgTrKwjetjNejrxSYu_HM8NBpH-y3rRNbiO6/exec';

// text/plain a propósito: con application/json el navegador hace antes una
// consulta de permisos (CORS) que Apps Script no contesta bien, y el pedido no
// sale. La app mobile no tiene ese problema porque no corre en un navegador.
// Apps Script lee el cuerpo igual (e.postData.contents).
async function syncToSheet(payload) {
  try {
    const res = await fetch(SHEETS_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.ok === false) {
      console.error('[admin-web] Excel:', data?.error ?? res.status);
      return { ok: false, error: data?.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    console.error('[admin-web] Excel:', error);
    return { ok: false, error: error.message };
  }
}

// Firestore guarda el nombre completo, pero hubo un momento en que este panel
// guardaba nombre y apellido por separado; esos documentos se leen igual.
function nombreCompletoDe(data) {
  const nombre = (data.nombre ?? '').trim();
  const apellido = (data.apellido ?? '').trim();
  if (!apellido || nombre.toLowerCase().endsWith(apellido.toLowerCase())) return nombre;
  return `${nombre} ${apellido}`;
}

// Misma regla que usa el Apps Script al escribir en el Excel: la primera
// palabra es el nombre y el resto el apellido.
export function separarNombre(nombreCompleto = '') {
  const partes = nombreCompleto.trim().split(/\s+/);
  return { nombre: partes[0] ?? '', apellido: partes.slice(1).join(' ') };
}

function toSocio(d) {
  const data = d.data();
  return {
    id: d.id,
    dni: d.id,
    ...data,
    nombre: nombreCompletoDe(data),
    apellido: '',
    // Derivado, no almacenado: misma regla que la app mobile y el control de
    // acceso, para que coincidan siempre. Ver estadoCuota.js.
    estado: getEstadoCuota(data.fechaVencimiento),
  };
}

// Listener en vivo del padrón. La primera vez lee todo; después Firestore solo
// manda (y cobra) los documentos que cambian. Recibe también lo que se edita
// desde el Excel, que el Apps Script sube a esta misma colección.
export function subscribeSocios(onData, onError) {
  return onSnapshot(
    query(collection(db, 'socios'), orderBy('nombre')),
    (snap) => onData(snap.docs.map(toSocio)),
    onError,
  );
}

export async function getSocioByDni(dni) {
  const snap = await getDoc(doc(db, 'socios', dni.trim()));
  if (!snap.exists()) return null;
  return toSocio(snap);
}

function isoOrNull(fecha) {
  return fecha ? fecha.toISOString() : null;
}

// Alta. Devuelve { excel } con el resultado de avisarle a la planilla, para
// que la pantalla pueda advertir si no llegó.
export async function createSocio(dni, data) {
  const id = dni.trim();
  const existente = await getDoc(doc(db, 'socios', id));
  if (existente.exists()) {
    throw new Error(`Ya existe un socio con DNI ${id}.`);
  }

  const nombre = (data.nombre ?? '').trim();
  const payload = {
    nombre,
    dni:                 id,
    email:               data.email ?? '',
    telefono:            data.telefono ?? '',
    telefonoEmergencia:  data.telefonoEmergencia ?? '',
    direccion:           data.direccion ?? '',
    localidad:           data.localidad ?? '',
    rfid:                data.rfid ?? '',
    fotoBase64:          data.fotoBase64 ?? null,
    certificadoMedico:   data.certificadoMedico ?? false,
    tieneConvenio:       data.tieneConvenio ?? false,
    convenioId:          data.convenioId ?? null,
    balance:             data.balance ?? 0,
    fechaVencimiento:    data.fechaVencimiento ? Timestamp.fromDate(data.fechaVencimiento) : null,
    creadoEn:            Timestamp.now(),
  };
  await setDoc(doc(db, 'socios', id), payload);

  const excel = await syncToSheet({
    action: 'add',
    nombre,
    dni: id,
    fechaVencimiento: isoOrNull(data.fechaVencimiento),
  });

  return { id, excel };
}

// Edición parcial: solo pisa los campos provistos. Si cambia el nombre o el
// vencimiento, avisa al Excel mandando la fila completa, porque el script
// reescribe nombre, apellido y fecha de una: un dato faltante lo borraría.
export async function updateSocio(dni, data) {
  const id = dni.trim();
  const payload = { ...data };

  if ('nombre' in payload) {
    payload.nombre = (payload.nombre ?? '').trim();
    payload.apellido = deleteField();
  }
  if ('fechaVencimiento' in payload) {
    payload.fechaVencimiento = data.fechaVencimiento
      ? Timestamp.fromDate(data.fechaVencimiento)
      : null;
  }
  await updateDoc(doc(db, 'socios', id), payload);

  if (!('nombre' in data) && !('fechaVencimiento' in data)) return { excel: null };

  const actual = await getSocioByDni(id);
  const excel = await syncToSheet({
    originalDni: id,
    dni: id,
    nombre: actual?.nombre ?? '',
    fechaVencimiento: isoOrNull(actual?.fechaVencimiento?.toDate?.()),
  });
  return { excel };
}

export async function deleteSocio(dni) {
  const id = dni.trim();
  await deleteDoc(doc(db, 'socios', id));
  const excel = await syncToSheet({ action: 'delete', dni: id });
  return { excel };
}

// Renovar la cuota es mover la fecha de vencimiento: el estado (al día,
// vencido...) se deriva de ella en todos lados.
export async function setFechaVencimiento(dni, fecha) {
  return updateSocio(dni, { fechaVencimiento: fecha });
}
