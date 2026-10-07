// La planilla de rutina en papel del gimnasio (las dos hojas que se entregan
// en recepción), y cómo se completa con una rutina de la app.
//
// Cada renglón de la planilla es un ejercicio del catálogo de la app
// (src/constants/exercises.js, que salió de esta misma planilla): al imprimir,
// cada ejercicio de la rutina cae en su renglón y se llenan DÍA, ORDEN, SERIE,
// REPETICIÓN, CARGA y OBSERVACIÓN, como lo hace el entrenador a mano. Lo que no
// tiene renglón (Hip thrust, Plancha, cardio…) va a los renglones libres de
// Hombros y, si no entran, al cuadro de OBSERVACIONES.
import { EXERCISE_BY_ID } from '../../../src/constants/exercises.js';

// hoja: 1 (frente) o 2 (dorso). ids: ejercicios del catálogo que van en ese
// renglón (el primero libre que aparezca en la rutina). libres: renglones en
// blanco al final de la sección.
export const SECCIONES = [
  { hoja: 1, titulo: 'PECHO', filas: [
    ['Press banca', 'pecho_01', 'pecho_11'],
    ['Press banca', 'pecho_02'],
    ['Flexiones de brazos', 'pecho_03'],
    ['Apertura', 'pecho_04'],
    ['Apertura', 'pecho_05'],
    ['Pull over', 'pecho_06'],
    ['Cruces en poleas', 'pecho_07'],
    ['Elevación frontales c/rotación', 'pecho_08'],
    ['Fondos', 'pecho_09'],
  ] },
  { hoja: 1, titulo: 'ESPALDA', filas: [
    ['Tirón polea', 'espalda_01'],
    ['Tirón polea', 'espalda_02'],
    ['Remo bajo dorsalera', 'espalda_03'],
    ['Remo con mancuerna', 'espalda_04'],
    ['Dominadas fijas', 'espalda_05'],
    ['Remo T en ruck', 'espalda_06'],
    ['Remo con barra', 'espalda_11', 'espalda_07'],
    ['Hiperextensiones', 'espalda_08'],
    ['Jalón brazos rectos', 'espalda_09'],
    ['Pull over', 'espalda_10'],
  ] },
  { hoja: 1, titulo: 'BICEPS', filas: [
    ['Curl de biceps', 'biceps_01'],
    ['Curl de biceps', 'biceps_02'],
    ['Curl de biceps', 'biceps_03'],
    ['Biceps concentrado', 'biceps_04'],
    ['Biceps banco scott', 'biceps_05'],
    ['Hércules', 'biceps_06'],
  ] },
  { hoja: 1, titulo: 'TRICEPS', filas: [
    ['Triceps en polea', 'triceps_01'],
    ['Triceps en polea', 'triceps_02'],
    ['Triceps en polea', 'triceps_03'],
    ['Fondos', 'triceps_04'],
    ['Empuje con barra', 'triceps_05'],
    ['Patada de burro', 'triceps_06'],
    ['Press francés', 'triceps_07'],
    ['Extensiones de codos', 'triceps_08'],
  ] },
  { hoja: 2, titulo: 'HOMBROS', libres: 2, filas: [
    ['Vuelos laterales', 'hombros_01'],
    ['Vuelos frontales', 'hombros_02'],
    ['Vuelos posteriores', 'hombros_03'],
    ['Press Arnold', 'hombros_04'],
    ['Press militar', 'hombros_05'],
    ['Press con mancuerna', 'hombros_06'],
    ['Manguito rotador', 'hombros_07'],
    ['Elevación de hombros', 'hombros_08'],
    ['Remo al cuello', 'hombros_09'],
    ['Medio movimiento', 'hombros_10'],
  ] },
  { hoja: 2, titulo: 'PIERNAS', filas: [
    ['Femorales parado', 'piernas_04'],
    ['Pantorrilla en prensa', 'piernas_01'],
    ['Pantorrilla sentado', 'piernas_02'],
    ['Pantorrilla parado', 'piernas_03'],
    ['Prensa', 'piernas_05'],
    ['Sentadillas', 'piernas_06'],
    ['Estocadas', 'piernas_07'],
    ['Extensión cuádriceps', 'piernas_08'],
    ['Isquiotibiales', 'piernas_09'],
    ['Abductor', 'piernas_10'],
    ['Aductor', 'piernas_11'],
    ['Ascenso en ruck', 'piernas_12'],
    ['Patada de glúteos', 'piernas_13'],
    ['Elevación de cadera', 'piernas_14'],
    ['Peso muerto', 'piernas_15'],
  ] },
  { hoja: 2, titulo: 'ABDOMINALES', filas: [
    ['Cortos', 'core_02'],
    ['Elevación de tronco', 'core_01'],
    ['Buenos días', 'core_03'],
    ['Hiperextensiones', 'core_04'],
    ['Elevación de pelvis', 'core_05'],
    ['Elevación de rodillas', 'core_06'],
    ['Elevación de piernas colgado', 'core_07'],
    ['Lateralización', 'core_08'],
    ['Flexión de tronco', 'core_09'],
    ['Oblicuos', 'core_10'],
  ] },
];

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const numero = (n) => (n == null || n === '' ? '' : String(n).replace('.', ','));

// "Press banca inclinada" en el renglón "Press banca" → "inclinada". Si el
// nombre no empieza con el del renglón, va entero.
function variante(nombreEjercicio, etiqueta) {
  const n = String(nombreEjercicio ?? '').trim();
  if (!n) return '';
  if (normalizar(n) === normalizar(etiqueta)) return '';
  if (normalizar(n).startsWith(normalizar(etiqueta))) return n.slice(etiqueta.length).trim();
  return n;
}

const unir = (...partes) => partes.filter(Boolean).join(' · ');

// Rutina de la app → contenido de la planilla.
//   secciones: [{ hoja, titulo, filas: [{ etiqueta, dia, orden, serie, rep, carga, obs }] }]
//   extras:    ejercicios sin renglón propio (texto listo para OBSERVACIONES)
//   dias:      "Día 1: Pecho y tríceps", para la leyenda
export function armarPlanilla(rutina) {
  const dias = [...(rutina?.dias ?? [])].sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));

  // Cada ejercicio de la rutina, en orden de día y de orden.
  const items = [];
  dias.forEach((d, i) => {
    const numDia = d.numero ?? i + 1;
    [...(d.ejercicios ?? [])]
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      .forEach((e, j) => items.push({ ...e, dia: numDia, orden: j + 1 }));
  });

  const secciones = SECCIONES.map((s) => ({
    hoja: s.hoja,
    titulo: s.titulo,
    filas: [
      ...s.filas.map(([etiqueta, ...ids]) => ({ etiqueta, ids, dia: '', orden: '', serie: '', rep: '', carga: '', obs: '' })),
      ...Array.from({ length: s.libres ?? 0 }, () => ({ etiqueta: '', ids: [], libre: true, dia: '', orden: '', serie: '', rep: '', carga: '', obs: '' })),
    ],
  }));
  const filaPorId = new Map();
  secciones.forEach((s) => s.filas.forEach((f) => f.ids.forEach((id) => filaPorId.has(id) || filaPorId.set(id, f))));

  const llenar = (f, it, etiqueta) => {
    f.dia = String(it.dia);
    f.orden = String(it.orden);
    f.serie = numero(it.series);
    f.rep = numero(it.repeticiones);
    f.carga = it.carga != null && it.carga !== '' ? `${numero(it.carga)} kg` : '';
    f.obs = unir(variante(it.nombre, etiqueta), it.observaciones);
    f.usada = it;
  };
  const mismo = (a, b) => a.series === b.series && a.repeticiones === b.repeticiones
    && (a.carga ?? null) === (b.carga ?? null) && (a.observaciones ?? '') === (b.observaciones ?? '');

  const sobrantes = [];
  for (const it of items) {
    // El renglón de su ejercicio, o el de otro ejercicio del mismo renglón
    // (p. ej. Press banca declinada va en el primer "Press banca").
    const f = filaPorId.get(it.exerciseId);
    if (f && !f.usada) { llenar(f, it, f.etiqueta); continue; }
    // El mismo ejercicio en otro día, igual: se anotan los dos días.
    if (f?.usada && f.usada.exerciseId === it.exerciseId && mismo(f.usada, it)) {
      f.dia = `${f.dia}-${it.dia}`;
      continue;
    }
    // Renglón libre del otro "Press banca"/"Curl de biceps"/… si está vacío.
    const etiqueta = f?.etiqueta;
    const gemela = etiqueta && secciones.flatMap((s) => s.filas).find((g) => g !== f && g.etiqueta === etiqueta && !g.usada);
    if (gemela) { llenar(gemela, it, etiqueta); continue; }
    sobrantes.push(it);
  }

  // Sin renglón propio. Los renglones libres están en Hombros: primero son
  // para ejercicios de hombros; el resto va a OBSERVACIONES, y solo si ahí ya
  // no entran (más de MAX_EXTRAS) se usan los renglones libres que quedan.
  const MAX_EXTRAS = 6;
  const libres = secciones.flatMap((s) => s.filas).filter((f) => f.libre);
  const aLibre = (it) => {
    const libre = libres.find((f) => !f.usada);
    if (!libre) return false;
    llenar(libre, it, '');
    libre.etiqueta = it.nombre ?? '';
    libre.obs = it.observaciones ?? '';
    return true;
  };
  const resto = sobrantes.filter((it) => !(it.grupoMuscular === 'hombros' && aLibre(it)));
  const extras = [];
  resto.forEach((it, k) => {
    if (resto.length - k > MAX_EXTRAS - extras.length && aLibre(it)) return;
    extras.push(`Día ${it.dia} · ${it.orden}° ${it.nombre ?? 'Ejercicio'}: ${unir(
      it.series && it.repeticiones ? `${numero(it.series)} x ${numero(it.repeticiones)}` : '',
      it.carga != null && it.carga !== '' ? `${numero(it.carga)} kg` : '',
      it.observaciones,
    )}`);
  });

  return {
    secciones,
    extras,
    dias: dias.map((d, i) => `Día ${d.numero ?? i + 1}${d.nombre ? `: ${d.nombre}` : ''}`),
  };
}

// Nombre del catálogo para mostrar en el editor.
export const nombreDeCatalogo = (id) => EXERCISE_BY_ID[id]?.nombre ?? '';
