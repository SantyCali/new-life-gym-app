// `new Date('2026-10-23')` es medianoche UTC, que en Argentina cae el 22 a las
// 21 h: el vencimiento terminaría un día antes en el Excel y en la puerta. Por
// eso las fechas de los inputs se arman siempre en hora local.
export function inputAFecha(valor) {
  if (!valor) return null;
  const [y, m, d] = valor.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function fechaAInput(fecha) {
  if (!fecha) return '';
  const f = fecha.toDate ? fecha.toDate() : fecha;
  const mm = String(f.getMonth() + 1).padStart(2, '0');
  const dd = String(f.getDate()).padStart(2, '0');
  return `${f.getFullYear()}-${mm}-${dd}`;
}

export function hoySinHora() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function sumarMeses(fecha, meses) {
  const d = new Date(fecha);
  d.setMonth(d.getMonth() + meses);
  return d;
}

export function sumarDias(fecha, dias) {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d;
}
