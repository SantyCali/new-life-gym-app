import { addDoc, collection, doc, getDocs, increment, limit, orderBy, query, Timestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

// Pagos de cuota de cada socio, como el "Pago alumno" del sistema de la
// recepción: se carga lo que corresponde pagar (el plan, con el descuento del
// convenio) y lo que entrega. Si entrega menos (pago parcial), la diferencia
// queda como deuda en socios.balance (negativo = debe). Después se cargan
// pagos sueltos para ir cancelándola.
//
// Cada movimiento queda en socios/{dni}/pagos (las reglas de socios/{dni}/{sub}
// ya dejan leer y escribir solo a los entrenadores).
const pagosCol = (dni) => collection(db, 'socios', String(dni).trim(), 'pagos');

// cargo: lo que corresponde pagar (0 si es solo un pago de deuda).
// pago: lo que entrega ahora.
export async function registrarMovimiento(dni, { cargo = 0, pago = 0, concepto = '', planNombre = null, precioLista = null, descuentoPct = 0 }) {
  const c = Math.max(0, Math.round(Number(cargo) || 0));
  const p = Math.max(0, Math.round(Number(pago) || 0));
  if (!c && !p) return;
  await addDoc(pagosCol(dni), {
    fecha: Timestamp.now(),
    cargo: c,
    pago: p,
    concepto,
    planNombre,
    precioLista,
    descuentoPct: Number(descuentoPct) || 0,
    cargadoPor: auth.currentUser?.email ?? '',
  });
  // Balance: lo pagado menos lo que correspondía. Negativo = queda debiendo.
  // pagoEn: marca para que "Altas y renovaciones" sepa a quién revisar sin leer a todos.
  await updateDoc(doc(db, 'socios', String(dni).trim()), { balance: increment(p - c), pagoEn: Timestamp.now() });
}

// Texto del balance: "$0 (sin deuda)", "Debe $4.000" o "A favor $2.000".
export function textoBalance(balance) {
  const b = Number(balance) || 0;
  if (b === 0) return { texto: '$0 (sin deuda)', debe: false };
  if (b < 0) return { texto: `Debe $${Math.abs(b).toLocaleString('es-AR')}`, debe: true };
  return { texto: `A favor $${b.toLocaleString('es-AR')}`, debe: false };
}

// Últimos movimientos (más nuevo primero), para mostrar en la ficha.
export async function getPagos(dni, cantidad = 15) {
  const snap = await getDocs(query(pagosCol(dni), orderBy('fecha', 'desc'), limit(cantidad)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
