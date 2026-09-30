// Espejo intencional de la clasificación que ya usa la app mobile en
// src/services/gymService.js (getSociosQuotaStatus) y el kiosco de control de
// ingresos (control-ingresos/control-ingresosv2.txt). La única fuente de
// verdad es socios.fechaVencimiento — no hay ningún flag manual de
// habilitado/inactivo, así los tres sistemas muestran siempre lo mismo.
//
// Diferencia única con la app mobile: ahí los vencidos hace más de 15 días se
// ocultan de la lista; acá, en administración, se muestran como 'inactivo'
// (son el padrón histórico que dejó de venir).
const DIA_MS = 24 * 60 * 60 * 1000;
const GRACIA_MS   = 1  * DIA_MS; // gracia: el propio día del vencimiento
const PROXIMO_MS  = 4  * DIA_MS; // "se acerca" = vence en ≤4 días
const INACTIVO_MS = 15 * DIA_MS; // vencido hace >15 días

export const ESTADOS = {
  aldia:    { label: 'Al día',     variant: 'success' },
  proximo:  { label: 'Por vencer', variant: 'warning' },
  vencido:  { label: 'Vencido',    variant: 'danger'  },
  inactivo: { label: 'Inactivo',   variant: 'neutral' },
};

export function getEstadoCuota(fechaVencimiento, now = Date.now()) {
  const vencMs = fechaVencimiento?.toMillis?.() ?? null;
  if (vencMs === null) return 'aldia';
  if (vencMs < now - INACTIVO_MS) return 'inactivo';
  if (vencMs < now - GRACIA_MS)   return 'vencido';
  if (vencMs < now + PROXIMO_MS)  return 'proximo';
  return 'aldia';
}

export function getEstadosStats(socios) {
  const stats = { total: socios.length, aldia: 0, proximo: 0, vencido: 0, inactivo: 0 };
  socios.forEach((s) => { stats[s.estado] += 1; });
  return stats;
}
