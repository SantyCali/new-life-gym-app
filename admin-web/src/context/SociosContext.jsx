import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { subscribeSocios } from '../services/sociosService';
import { getCuentasPorDni, combinarSocioConApp } from '../services/usersService';
import { getEstadoCuota } from '../services/estadoCuota';
import useAhora from '../hooks/useAhora';

const SociosContext = createContext(null);

// Un único listener del padrón para todo el panel: Dashboard, Socios, la
// ficha y el contador del menú leen de acá. Si cada pantalla abriera el suyo,
// navegar entre ellas volvería a leer los 200+ documentos cada vez.
export function SociosProvider({ children }) {
  const [crudos, setCrudos]   = useState([]);
  const [cuentas, setCuentas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const ahora = useAhora();

  useEffect(() => subscribeSocios(
    (data) => { setCrudos(data); setError(null); setLoading(false); },
    (err)  => {
      console.error('[admin-web] socios:', err);
      setError('No se pudo cargar el listado de socios.');
      setLoading(false);
    },
  ), []);

  // Las cuentas de la app (fotos, nombre separado) no van en vivo: son la
  // lectura más pesada y casi no cambian. Ver usersService.
  useEffect(() => {
    getCuentasPorDni()
      .then(setCuentas)
      .catch((err) => console.error('[admin-web] cuentas de la app:', err));
  }, []);

  const socios = useMemo(() => crudos.map((s) => {
    const conApp = cuentas ? combinarSocioConApp(s, cuentas.get(s.dni)) : s;
    // Se recalcula con el reloj: la cuota vence a medianoche sin que cambie
    // ningún documento.
    return { ...conApp, estado: getEstadoCuota(s.fechaVencimiento, ahora) };
  }), [crudos, cuentas, ahora]);

  return (
    <SociosContext.Provider value={{ socios, loading, error }}>
      {children}
    </SociosContext.Provider>
  );
}

export function useSocios() {
  const ctx = useContext(SociosContext);
  if (!ctx) throw new Error('useSocios debe usarse dentro de <SociosProvider>');
  return ctx;
}
