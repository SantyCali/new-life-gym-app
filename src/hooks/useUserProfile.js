import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import useAuth from './useAuth';
import { juntarPerfil, refPrivado } from '../services/perfilPrivadoService';

// Perfil completo del usuario: el público (users/{uid}) más sus datos
// personales (users/{uid}/privado/datos), en un solo objeto como siempre.
export default function useUserProfile() {
  const { user, isAuthenticated } = useAuth();
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !user?.uid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    // undefined = todavía no llegó; se espera a los dos para no mostrar un
    // perfil sin peso/DNI por un instante.
    let publico;
    let privado;
    const publicar = () => {
      if (publico === undefined || privado === undefined) return;
      setProfile(juntarPerfil(publico, privado));
      setLoading(false);
    };

    const unsubPublico = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => { publico = snap.exists() ? snap.data() : null; publicar(); },
      () => setLoading(false),
    );
    const unsubPrivado = onSnapshot(
      refPrivado(user.uid),
      (snap) => { privado = snap.exists() ? snap.data() : {}; publicar(); },
      () => { privado = {}; publicar(); },
    );

    return () => { unsubPublico(); unsubPrivado(); };
  }, [user?.uid, isAuthenticated]);

  return { profile, loading };
}
