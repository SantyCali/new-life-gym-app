// Logros repetibles: al completarse quedan en verde VENTANA_LOGRO_MS y después
// vuelven a contar desde cero (ver services/logrosService.js).
//
// `campo` es el dato real del perfil del que sale el progreso. El progreso se
// mide contra una base guardada al completarlo, SIN tocar ese dato: antes se
// ponía en 0 para "reiniciar" el logro, y eso borraba los puntos de los
// torneos (xpTotal), la racha del fueguito y las visitas al gym.
export const VENTANA_LOGRO_MS = 5 * 60 * 1000;

export const LOGROS_DEF = [
  {
    id: 'racha_7',
    title: 'Racha Semanal',
    description: 'Cumplí tu objetivo de pasos 7 días seguidos.',
    total: 7,
    type: 'bronze',
    icon: 'flame-outline',
    xp: 100,
    campo: 'racha',
  },
  {
    id: 'gym_10',
    title: 'Visitante Frecuente',
    description: 'Registrá 10 visitas al gimnasio.',
    total: 10,
    type: 'silver',
    icon: 'barbell-outline',
    xp: 150,
    campo: 'gymVisitCount',
  },
  {
    id: 'xp_1000',
    title: 'Primeras 1.000 XP',
    description: 'Alcanzá 1.000 XP en total.',
    total: 1000,
    type: 'gold',
    icon: 'star-outline',
    xp: 200,
    campo: 'xpTotal',
  },
];
