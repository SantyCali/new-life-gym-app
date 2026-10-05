// Lista de "Mis clientes", rápida.
//
// Antes, cada vez que se entraba se bajaba el perfil de TODOS los usuarios con
// la foto adentro (texto base64: varios MB) más sus datos privados, y recién
// ahí se mostraba la lista. Ahora:
//   - se precarga de fondo cuando el entrenador abre la app (Inicio);
//   - en memoria queda la lista completa (con fotos) durante la sesión;
//   - en el celular se guarda la lista sin fotos, para mostrarla al instante
//     también la primera vez del día (las fotos aparecen al terminar de cargar);
//   - al entrar se muestra lo guardado y se actualiza de fondo.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { juntarPerfil, leerPrivadoDeTodos } from './perfilPrivadoService';

const CLAVE = 'misClientes_v1';
const FRESCO_MS = 60 * 1000;
let enMemoria = null;   // { en, lista }
let enCurso = null;

export async function clientesGuardados() {
  if (enMemoria) return enMemoria.lista;
  try {
    const guardado = JSON.parse((await AsyncStorage.getItem(CLAVE)) ?? 'null');
    return guardado?.lista ?? null;
  } catch { return null; }
}

export function cargarClientes({ forzar = false } = {}) {
  if (!forzar && enMemoria && Date.now() - enMemoria.en < FRESCO_MS) return Promise.resolve(enMemoria.lista);
  if (enCurso) return enCurso;
  enCurso = Promise.all([getDocs(collection(db, 'users')), leerPrivadoDeTodos().catch(() => ({}))])
    .then(([snap, privados]) => {
      const lista = snap.docs.map((d) => ({ uid: d.id, ...juntarPerfil(d.data(), privados[d.id]) }));
      enMemoria = { en: Date.now(), lista };
      // Al celular, sin fotos (pesan mucho).
      const liviana = lista.map(({ photoBase64, ...resto }) => resto);
      AsyncStorage.setItem(CLAVE, JSON.stringify({ en: Date.now(), lista: liviana })).catch(() => {});
      return lista;
    })
    .finally(() => { enCurso = null; });
  return enCurso;
}

export function precargarClientes() {
  cargarClientes().catch(() => {});
}
