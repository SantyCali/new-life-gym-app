// Exercise media from hasaneyldrm/exercises-dataset (jsDelivr CDN)
// Each entry: [datasetId, mediaId]
const CDN = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main';

// GIFs propios para ejercicios que no están en el dataset (por ahora ninguno).
const LOCAL_GIFS = {};

const DATASET = {
  // ── PECHO ──────────────────────────────────────────────────────────
  pecho_01: ['0025', 'EIeI8Vf'],  // barbell bench press
  pecho_02: ['0047', '3TZduzM'],  // barbell incline bench press
  pecho_03: ['3216', '7E06s6d'],  // chest tap push-up
  pecho_04: ['0319', 'ESOd5Pl'],  // dumbbell incline fly (apertura 45°)
  pecho_05: ['0308', 'yz9nUhF'],  // dumbbell fly
  pecho_06: ['0375', '9XjtHvS'],  // dumbbell pullover
  pecho_07: ['1262', 'w4dLzSx'],  // cable one arm decline chest fly
  pecho_08: ['0335', 'xMjBKwn'],  // dumbbell lateral to front raise
  pecho_09: ['0251', '9WTm7dq'],  // chest dip (fondos)
  pecho_10: ['0596', 'v3xmPAR'],  // lever seated fly (mariposa)
  pecho_11: ['0033', 'GrO65fd'],  // barbell decline bench press

  // ── ESPALDA ────────────────────────────────────────────────────────
  espalda_01: ['2330', 'LEprlgG'], // cable lat pulldown full ROM
  espalda_02: ['0198', 'RVwzP10'], // cable pulldown
  espalda_03: ['0239', 'Tq6gbK6'], // cable straight back seated row (remo bajo)
  espalda_04: ['0293', 'BJ0Hz5L'], // dumbbell bent over row
  espalda_05: ['0651', '0V2YQjW'], // pull-up neutral grip
  espalda_06: ['1349', 'BgljGjd'], // lever reverse t-bar row
  espalda_07: ['0180', 'hvV79Si'], // cable low seated row (remo con barra polea)
  espalda_08: ['0489', 'zhMwOwE'], // hyperextension
  espalda_09: ['0238', 'x69MAlq'], // cable straight arm pulldown
  espalda_10: ['0237', 'DT14T9T'], // cable straight arm pulldown (rope)
  espalda_11: ['0027', 'eZyBC3j'], // barbell bent over row
  espalda_12: ['0203', 'wqNPGCg'], // cable rear delt row with rope (face pull)

  // ── HOMBROS ────────────────────────────────────────────────────────
  hombros_01: ['0334', 'DsgkuIt'], // dumbbell lateral raise
  hombros_02: ['0310', '3eGE2JC'], // dumbbell front raise
  hombros_03: ['0380', 'v1qBec9'], // dumbbell rear lateral raise
  hombros_04: ['2137', 'Xy4jlWA'], // dumbbell arnold press
  hombros_05: ['0091', 'kTbSH9h'], // barbell seated overhead press
  hombros_06: ['0405', 'znQUdHY'], // dumbbell seated shoulder press
  hombros_07: ['0235', 'FWdVhcW'], // cable shoulder external rotation
  hombros_08: ['0406', 'NJzBsGJ'], // dumbbell shrug
  hombros_09: ['0120', 'UDlhcO8'], // barbell upright row
  hombros_10: ['0406', 'NJzBsGJ'], // dumbbell shrug
  hombros_11: ['0747', 'Gpn4ADc'], // smith behind neck press

  // ── BÍCEPS ─────────────────────────────────────────────────────────
  biceps_01: ['0031', '25GPyDY'],  // barbell curl
  biceps_02: ['0165', 'HPlPoQA'],  // cable hammer curl (with rope)
  biceps_03: ['0285', 'BU15nH4'],  // dumbbell alternate biceps curl
  biceps_04: ['0297', 'gvsWLQw'],  // dumbbell concentration curl
  biceps_05: ['0070', 'qOgPVf6'],  // barbell preacher curl
  biceps_06: ['1636', 'wDUqY2u'],  // cable overhead curl (hércules)
  biceps_07: ['0312', '2NpxjC1'],  // dumbbell hammer curl v.2 (curl martillo)

  // ── TRÍCEPS ────────────────────────────────────────────────────────
  triceps_01: ['0241', 'gAwDzB3'], // cable triceps pushdown v-bar
  triceps_02: ['0201', '3ZflifB'], // cable pushdown (no hay con barra W: la más parecida)
  triceps_03: ['0201', '3ZflifB'], // cable pushdown
  triceps_04: ['0814', 'X6C6i5Y'], // triceps dip
  triceps_05: ['0030', 'J6Dx1Mu'], // barbell close-grip bench press
  triceps_06: ['1739', 'Gi2BXfK'], // dumbbell standing tricep kickback
  triceps_07: ['0060', 'h8LFzo9'], // barbell skull crusher
  triceps_08: ['0453', 'iaapw0g'], // ez barbell seated triceps extension
  triceps_09: ['0194', '2IxROQ1'], // cable overhead triceps extension rope (extensiones sobre cabeza)

  // ── PIERNAS ────────────────────────────────────────────────────────
  piernas_01: ['1391', 'ykHcWme'], // sled calf press on leg press
  piernas_02: ['0594', 'bOOdeyc'], // lever seated calf raise
  piernas_03: ['0605', 'ykUOVze'], // lever standing calf raise
  piernas_04: ['0582', 'nnmCTLN'], // lever kneeling leg curl
  piernas_05: ['2287', 'V07qpXy'], // lever alternate leg press
  piernas_06: ['0043', 'qXTaZnJ'], // barbell full squat
  piernas_07: ['0336', 'RRWFUcw'], // dumbbell lunge
  piernas_08: ['0585', 'my33uHU'], // lever leg extension
  piernas_09: ['0586', '17lJ1kr'], // lever lying leg curl
  piernas_10: ['0597', 'CHpahtl'], // lever seated hip abduction
  piernas_11: ['0598', 'oHsrypV'], // lever seated hip adduction
  piernas_12: ['0114', 'Kxquu2E'], // barbell step-up
  piernas_13: ['2286', 'OPqShYN'], // lever hip extension
  piernas_14: ['1409', 'qKBpF7I'], // barbell glute bridge
  piernas_15: ['0032', 'ila4NZS'], // barbell deadlift
  piernas_16: ['0586', '17lJ1kr'], // lever lying leg curl (curl femoral tumbado)
  piernas_17: ['0085', 'wQ2c4XD'], // barbell romanian deadlift

  // ── CORE ───────────────────────────────────────────────────────────
  core_01: ['0001', '2gPfomN'],   // 3/4 sit-up
  core_02: ['0274', 'TFqbd8t'],   // crunch floor
  core_03: ['0044', 'XlZ4lAC'],   // barbell good morning
  core_04: ['0489', 'zhMwOwE'],   // hyperextension
  core_05: ['0872', 'nCU1Ekp'],   // reverse crunch
  core_06: ['0011', '03lzqwk'],   // assisted hanging knee raise
  core_07: ['0472', 'I3tsCnC'],   // hanging leg raise
  core_08: ['0407', 'IpONWYv'],   // dumbbell side bend
  core_09: ['3204', 'NAkmgdx'],   // arms overhead full sit-up
  core_10: ['1495', 'cJgSTmh'],   // oblique crunch
  core_11: ['2135', 'VBAWRPG'],   // weighted front plank
  core_12: ['0857', 'NAgVB3t'],   // wheel rollerout kneeling (rueda abdominal)
  core_13: ['0212', '8xUv4J7'],   // cable seated crunch (crunch en máquina)
  core_14: ['0687', 'XVDdcoj'],   // russian twist
  core_15: ['0705', 'RKjH6Lt'],   // side bridge v. 2 (plancha lateral)
  core_16: ['0972', 'tZkGYZ9'],   // band bicycle crunch (bicicleta abdominal)
  core_17: ['0620', 'WhuFnR7'],   // lying leg raise flat bench (tijeras)
  core_18: ['0175', 'WW95auq'],   // cable kneeling crunch (encogimientos en polea)

  // ── GLÚTEOS ────────────────────────────────────────────────────────
  gluteos_01: ['1409', 'qKBpF7I'], // barbell glute bridge (hip thrust)
  gluteos_02: ['3142', 'dzz6BiV'], // smith sumo squat
  gluteos_03: ['3561', 'GibBPPg'], // glute bridge march
  gluteos_04: ['0410', 'qx4fgX7'], // dumbbell single leg split squat (búlgara)
  gluteos_05: ['0228', 'Kpajagk'], // cable standing hip extension
  gluteos_06: ['1427', 'mQ1tBXn'], // straight leg outer hip abductor
  gluteos_07: ['0228', 'Kpajagk'], // cable standing hip extension (patada de glúteo)

  // ── CARDIO ─────────────────────────────────────────────────────────
  cardio_01: ['3666', 'rjiM4L3'], // walking on incline treadmill
  cardio_02: ['0798', 'a8VDgLw'], // stationary bike walk
  cardio_03: ['1350', '7I6LNUG'], // lever seated row (no hay máquina de remo: la más parecida)
  cardio_04: ['2311', 'j9Q5crt'], // walking on stepmill
  cardio_05: ['2141', 'rjtuP6X'], // walk elliptical cross trainer
  cardio_06: ['1160', 'dK9394r'], // burpee
  cardio_07: ['2612', 'e1e76I2'], // jump rope
  cardio_08: ['3666', 'rjiM4L3'], // walking on incline treadmill
};

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=640&h=360&fit=crop&auto=format&q=80';

export function getExerciseGif(exercise) {
  const key = exercise.exerciseId ?? exercise.id;
  if (LOCAL_GIFS[key]) return LOCAL_GIFS[key];
  const e = DATASET[key];
  if (!e) return null;
  return `${CDN}/videos/${e[0]}-${e[1]}.gif`;
}

export function getExerciseImage(exercise) {
  const e = DATASET[exercise.exerciseId] ?? DATASET[exercise.id];
  if (!e) return FALLBACK_IMG;
  return `${CDN}/images/${e[0]}-${e[1]}.jpg`;
}