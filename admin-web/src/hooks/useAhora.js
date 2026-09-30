import { useEffect, useState } from 'react';

// Hora actual que se refresca sola. Hace falta porque varias cosas dependen
// del reloj y no de Firestore: un ingreso sale de "en sala" a los 90 min y
// una cuota pasa a vencida a medianoche, sin que cambie ningún documento.
export default function useAhora(intervaloMs = 60_000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return ahora;
}
