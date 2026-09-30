import { useIngresos } from '../context/IngresosContext';

// Los ingresos del día vienen del listener compartido de IngresosContext.
export default function useIngresosDeHoy() {
  return useIngresos();
}
