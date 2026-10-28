import {
  collection, doc, addDoc, getDocs, getDoc, updateDoc, deleteDoc, setDoc,
  query, orderBy, Timestamp, where, limit,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { setFechaVencimiento, getSocioByDni } from './sociosService';
import { registrarMovimiento } from './pagosService';

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
//
// Cada plan cargado guarda también cómo estaba todo antes (vencimiento, plan
// anterior, qué se cortó o borró) y quién lo cargó: así se puede ver en
// "Altas y renovaciones" y volver atrás si se le cargó al socio equivocado
// (ver volverAlPlanAnterior). Devuelve { excel, entradaId }.
export async function renovarCuota(dni, { plan, desde, hasta }) {
  const anteriores = await getDocs(historialCol(dni));
  let entradaId = null;
  if (plan) {
    const socio = await getSocioByDni(dni).catch(() => null);
    const historial = anteriores.docs.map((d) => ({ id: d.id, ...d.data() }));
    const previo = planVigenteDe(historial.slice().sort((a, b) => (b.fechaInicio?.toMillis?.() ?? 0) - (a.fechaInicio?.toMillis?.() ?? 0)));
    // Los que seguían corriendo después de `desde` se cortan ahí; los que
    // ni habían empezado (una renovación por adelantado) se borran.
    const cortados = [];
    const borrados = [];
    await Promise.all(anteriores.docs
      .filter((d) => d.data().habilitado !== false && (d.data().fechaVencimiento?.toDate?.() ?? 0) > desde)
      .map((d) => {
        if ((d.data().fechaInicio?.toDate?.() ?? 0) >= desde) {
          borrados.push(d.data());
          return deleteDoc(d.ref);
        }
        cortados.push({ id: d.id, fechaVencimiento: d.data().fechaVencimiento ?? null });
        return updateDoc(d.ref, { habilitado: false, fechaVencimiento: Timestamp.fromDate(desde) });
      }));

    const ref = await addDoc(historialCol(dni), {
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
      cargadoPor: auth.currentUser?.email ?? '',
      // Para "Volver al plan anterior":
      planAnteriorNombre: previo?.nombrePlan ?? null,
      vencimientoAnterior: socio?.fechaVencimiento ?? null,
      cortados,
      borrados,
    });
    entradaId = ref.id;
    await updateDoc(doc(db, 'socios', String(dni).trim()), { planCambiadoEn: Timestamp.now() }).catch(() => {});
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
  const r = await setFechaVencimiento(dni, hasta);
  return { ...r, entradaId };
}

// El pago que se cargó junto con el plan (para poder anularlo si se vuelve atrás).
export async function anotarPagoEnPlan(dni, entradaId, { cargo, pago }) {
  if (!entradaId) return;
  await updateDoc(doc(historialCol(dni), entradaId), { pago: { cargo: Number(cargo) || 0, pago: Number(pago) || 0 } });
}

// ¿Se puede volver atrás este cambio? Solo los cargados desde que se guarda
// cómo estaba antes (y que no se hayan deshecho ya).
export function sePuedeVolverAtras(entrada) {
  return !!entrada && Array.isArray(entrada.cortados) && !entrada.anulado;
}

// Volver al plan anterior: borra el plan cargado, le devuelve al anterior su
// vencimiento, recupera lo que se había borrado, vuelve el vencimiento del
// socio a como estaba (también en el Excel) y anula el pago, si hubo.
export async function volverAlPlanAnterior(dni, entrada) {
  if (!sePuedeVolverAtras(entrada)) throw new Error('Este cambio no se puede deshacer desde acá.');
  await deleteDoc(doc(historialCol(dni), entrada.id));
  await Promise.all((entrada.cortados ?? []).map((c) => updateDoc(doc(historialCol(dni), c.id), {
    habilitado: true,
    ...(c.fechaVencimiento ? { fechaVencimiento: c.fechaVencimiento } : {}),
  }).catch(() => {})));
  await Promise.all((entrada.borrados ?? []).map((b) => addDoc(historialCol(dni), b)));
  if (entrada.pago && (entrada.pago.cargo || entrada.pago.pago)) {
    // Al revés: lo que se cobró vuelve, lo que se debía se borra.
    await registrarMovimiento(dni, {
      cargo: entrada.pago.pago, pago: entrada.pago.cargo,
      concepto: `Anulado: ${entrada.nombrePlan ?? 'plan'} (vuelto al plan anterior)`,
    });
  }
  const venc = entrada.vencimientoAnterior?.toDate?.() ?? null;
  return setFechaVencimiento(dni, venc);
}

// "Altas y renovaciones": planes cargados y pagos de deuda de los últimos
// `dias` días, de todos los socios. Pensado para gastar pocas lecturas (el
// plan gratis de Firestore tiene 50.000 por día y la primera versión, que
// leía el historial entero de cada socio, lo agotó):
//   - de cada socio se piden SOLO los planes cargados en el rango (si no hay,
//     cuesta 1 lectura);
//   - desde que el rango es posterior al 22/10/2026, solo a los socios marcados
//     (planCambiadoEn / pagoEn), que son los únicos que pueden tener algo;
//   - los pagos, solo de esos socios.
// Devuelve una lista liviana (sin Timestamps) que se puede guardar en el navegador.
const MARCA_DESDE = new Date('2026-10-22T00:00:00-03:00').getTime();
const ms = (t) => t?.toMillis?.() ?? 0;
export async function movimientosRecientes(socios, dias = 15, onProgreso) {
  const desde = Date.now() - dias * 24 * 60 * 60 * 1000;
  const desdeTs = Timestamp.fromMillis(desde);
  const marcado = (x) => ms(x.planCambiadoEn) >= desde || ms(x.pagoEn) >= desde;
  const lista = desde >= MARCA_DESDE ? socios.filter(marcado) : socios.slice();
  const total = lista.length;
  let hechos = 0;
  onProgreso?.(0, total);
  const planes = [];
  const conPlan = new Set();
  const trabajar = async () => {
    while (lista.length) {
      const so = lista.shift();
      try {
        const snap = await getDocs(query(historialCol(so.dni), where('cargadoEn', '>=', desdeTs)));
        for (const d of snap.docs) {
          const e = d.data();
          let anterior = e.planAnteriorNombre;
          if (anterior === undefined) {
            // Cargado antes de que se guardara el plan anterior: el que empezó antes.
            const prev = await getDocs(query(historialCol(so.dni), where('fechaInicio', '<', e.fechaInicio), orderBy('fechaInicio', 'desc'), limit(1)));
            anterior = prev.docs[0]?.data().nombrePlan ?? null;
          }
          planes.push({
            tipo: 'plan', id: d.id, dni: so.dni, cuando: ms(e.cargadoEn),
            nombrePlan: e.nombrePlan ?? '', anterior: anterior ?? null,
            vence: ms(e.fechaVencimiento) || null, cargadoPor: e.cargadoPor ?? '',
            pago: e.pago ?? null, deshacible: sePuedeVolverAtras(e),
          });
          conPlan.add(so.dni);
        }
      } catch {}
      hechos += 1;
      onProgreso?.(hechos, total);
    }
  };
  await Promise.all(Array.from({ length: 30 }, trabajar));

  // Pagos sueltos (de deuda o a cuenta): de los que tuvieron plan en el rango
  // o están marcados con pagoEn. Los que vinieron con un plan ya están en su fila.
  const pagos = [];
  const candidatos = socios.filter((x) => conPlan.has(x.dni) || ms(x.pagoEn) >= desde);
  await Promise.all(candidatos.map(async (so) => {
    try {
      const snap = await getDocs(query(collection(db, 'socios', so.dni, 'pagos'), where('fecha', '>=', desdeTs)));
      for (const d of snap.docs) {
        const m = d.data();
        if ((m.cargo ?? 0) > 0 || !(m.pago > 0)) continue;   // cuotas y anulaciones: no
        pagos.push({ tipo: 'pago', id: d.id, dni: so.dni, cuando: ms(m.fecha), monto: m.pago, concepto: m.concepto ?? '', cargadoPor: m.cargadoPor ?? '' });
      }
    } catch {}
  }));
  return [...planes, ...pagos].sort((a, b) => b.cuando - a.cuando);
}

// Un plan cargado, leído en el momento (para "Volver al plan anterior").
export async function getPlanCargado(dni, id) {
  const snap = await getDoc(doc(historialCol(dni), id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
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
