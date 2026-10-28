// Superseries: ejercicios que se hacen seguidos, sin descanso entre ellos
// (dos o más: también sirve para circuitos). El entrenador le pone la misma
// letra a cada ejercicio del grupo (campo `superserie` del ejercicio en la
// rutina) y en la rutina del socio se ven del mismo color y unidos con una
// línea. Mismos colores en el panel web (admin-web/src/rutinas/superseries.js).
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

// Verde de "hecho" (ejercicio marcado con el ✓).
export const VERDE_HECHO = '#22C55E';
