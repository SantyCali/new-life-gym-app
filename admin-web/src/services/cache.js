// Caché en memoria para las colecciones que se leen enteras (socios, cuentas
// de la app). Sin esto, cada navegación entre Dashboard, Socios y la ficha
// volvía a leer todo el padrón, y Firestore cobra por documento leído.
// Dura lo que dura la pestaña abierta; al recargar se vuelve a pedir.
const store = new Map();

export async function cached(key, ttlMs, fetcher) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.guardadoEn < ttlMs) return hit.valor;

  const valor = await fetcher();
  store.set(key, { valor, guardadoEn: Date.now() });
  return valor;
}

// Se llama después de cada escritura para que la próxima lectura traiga los
// datos frescos en vez de los de la caché.
export function invalidate(key) {
  store.delete(key);
}
