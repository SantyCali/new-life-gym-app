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
