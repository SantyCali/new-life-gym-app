import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { registrarMovimiento } from './pagosService';

// Lo que el socio saca del gym (agua, Powerade, Gatorade…) y su notita.
//
// Cada consumo es un movimiento más en socios/{dni}/pagos (tipo 'consumo'):
// si lo paga en el momento queda cargo = pago y el balance no cambia; si lo
// debe, el cargo se suma a la deuda de siempre y se cobra con "Cargar pago".
//
// Los productos y sus precios los editan los entrenadores y quedan en
// config/consumos (las reglas de config ya dejan escribir solo a ellos).

const CONFIG = doc(db, 'config', 'consumos');

export const PRODUCTOS_BASE = [
  { nombre: 'Agua', precio: 0 },
  { nombre: 'Powerade', precio: 0 },
  { nombre: 'Gatorade', precio: 0 },
];

// Una sola lectura por visita al panel: los precios casi no cambian.
let productosLeidos = null;

export async function getProductos() {
  if (productosLeidos) return productosLeidos;
  const snap = await getDoc(CONFIG);
  const lista = snap.exists() && Array.isArray(snap.data().productos) ? snap.data().productos : PRODUCTOS_BASE;
  productosLeidos = lista;
  return lista;
}

export async function guardarProductos(lista) {
  const limpia = lista
    .map((p) => ({ nombre: String(p.nombre ?? '').trim(), precio: Math.max(0, Math.round(Number(p.precio) || 0)) }))
    .filter((p) => p.nombre);
  await setDoc(CONFIG, { productos: limpia, editadoPor: auth.currentUser?.email ?? '', editadoEn: Timestamp.now() });
  productosLeidos = limpia;
  return limpia;
}

// items: [{ nombre, precio, cantidad }]. Devuelve el total anotado.
export async function anotarConsumo(dni, items, pagaAhora) {
  const validos = items.filter((it) => it.cantidad > 0);
  const total = validos.reduce((s, it) => s + it.precio * it.cantidad, 0);
  if (!validos.length || total <= 0) return 0;
  const detalle = validos.map((it) => (it.cantidad > 1 ? `${it.cantidad} ${it.nombre}` : it.nombre)).join(', ');
  await registrarMovimiento(dni, {
    cargo: total,
    pago: pagaAhora ? total : 0,
    concepto: `Consumo: ${detalle}`,
    tipo: 'consumo',
  });
  return total;
}

// La notita del socio: aparte del socio a propósito, porque socios/{dni} lo
// puede leer el propio socio desde la app; esto lo ven solo los entrenadores.
const notaRef = (dni) => doc(db, 'socios', String(dni).trim(), 'documentos', 'nota');

export async function getNota(dni) {
  const snap = await getDoc(notaRef(dni));
  return snap.exists() ? snap.data() : null;
}

export async function guardarNota(dni, texto) {
  await setDoc(notaRef(dni), {
    texto: String(texto ?? '').trim(),
    editadoPor: auth.currentUser?.email ?? '',
    editadoEn: Timestamp.now(),
  });
}
