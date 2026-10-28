// Superseries: ejercicios que se hacen seguidos (2 o más). Misma letra = mismo
// grupo. Mismos colores que la app (src/constants/superseries.js).
export const SUPERSERIES = [
  { letra: 'A', color: '#FF9F1A' },
  { letra: 'B', color: '#A78BFA' },
  { letra: 'C', color: '#38BDF8' },
  { letra: 'D', color: '#F472B6' },
  { letra: 'E', color: '#34D399' },
];

export function colorSuperserie(letra) {
  return SUPERSERIES.find((s) => s.letra === letra)?.color ?? null;
}

export const VERDE_HECHO = '#22C55E';
