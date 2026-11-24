// Novedades del panel: muestran un cartel "¡Nuevo!" durante unos días desde
// que salen y después desaparecen solas.

// Rutinas desde la web: salió el 6/10/2026, se anuncia 2 días (6 y 7/10).
const RUTINA_NUEVA_HASTA = new Date('2026-10-08T00:00:00-03:00').getTime();
// Tarjetas de asistencias de la ficha del socio: solo el 6/10/2026.
const RESUMEN_NUEVO_HASTA = new Date('2026-10-07T00:00:00-03:00').getTime();

export function rutinaEsNueva() {
  return Date.now() < RUTINA_NUEVA_HASTA;
}

export function resumenEsNuevo() {
  return Date.now() < RESUMEN_NUEVO_HASTA;
}

// Imprimir la ficha médica: salió el 19/10/2026, se anuncia 2 días (19 y 20/10).
const FICHA_NUEVA_HASTA = new Date('2026-10-21T00:00:00-03:00').getTime();

export function fichaEsNueva() {
  return Date.now() < FICHA_NUEVA_HASTA;
}

// Pagos (pago parcial, deuda, "Cargar pago"), plan y convenio al dar de alta,
// descuento del convenio y "Altas y renovaciones": salieron el 22/10/2026, se
// anuncian 2 días (22 y 23/10).
const PAGOS_NUEVO_HASTA = new Date('2026-10-24T00:00:00-03:00').getTime();

export function pagosEsNuevo() {
  return Date.now() < PAGOS_NUEVO_HASTA;
}

// Consumos (agua, Powerade, Gatorade…) y notita del socio: salieron el
// 3/11/2026, se anuncian 2 días (3 y 4/11).
const CONSUMOS_NUEVO_HASTA = new Date('2026-11-05T00:00:00-03:00').getTime();

export function consumosEsNuevo() {
  return Date.now() < CONSUMOS_NUEVO_HASTA;
}

// Cumpleaños de hoy en el panel de control: salió el 3/11/2026, mismos 2 días.
export function cumplesEsNuevo() {
  return Date.now() < CONSUMOS_NUEVO_HASTA;
}
