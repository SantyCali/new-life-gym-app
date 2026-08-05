export const MUSCLE_GROUPS = [
  { id: 'pecho',    label: 'Pecho',    icon: 'fitness-outline'       },
  { id: 'espalda',  label: 'Espalda',  icon: 'arrow-up-outline'      },
  { id: 'hombros',  label: 'Hombros',  icon: 'body-outline'          },
  { id: 'biceps',   label: 'Bíceps',   icon: 'flash-outline'         },
  { id: 'triceps',  label: 'Tríceps',  icon: 'flash-outline'         },
  { id: 'piernas',  label: 'Piernas',  icon: 'walk-outline'          },
  { id: 'core',     label: 'Core',     icon: 'ellipse-outline'       },
  { id: 'gluteos',  label: 'Glúteos',  icon: 'heart-outline'         },
  { id: 'cardio',   label: 'Cardio',   icon: 'speedometer-outline'   },
];

export const EXERCISES = [
  // ── PECHO ────────────────────────────────────────────────
  { id: 'pecho_01', nombre: 'Press banca plana',            grupoMuscular: 'pecho',   maquina: 'Barra',       tipo: 'fuerza'   },
  { id: 'pecho_02', nombre: 'Press banca inclinada',        grupoMuscular: 'pecho',   maquina: 'Barra',       tipo: 'fuerza'   },
  { id: 'pecho_03', nombre: 'Flexiones de brazos',          grupoMuscular: 'pecho',   maquina: 'Ninguna',     tipo: 'fuerza'   },
  { id: 'pecho_04', nombre: 'Apertura 45 grados',           grupoMuscular: 'pecho',   maquina: 'Mancuernas',  tipo: 'fuerza'   },
  { id: 'pecho_05', nombre: 'Apertura plana',               grupoMuscular: 'pecho',   maquina: 'Mancuernas',  tipo: 'fuerza'   },
  { id: 'pecho_06', nombre: 'Pull over',                    grupoMuscular: 'pecho',   maquina: 'Mancuernas',  tipo: 'fuerza'   },
  { id: 'pecho_07', nombre: 'Cruces en poleas bajo',        grupoMuscular: 'pecho',   maquina: 'Polea',       tipo: 'fuerza'   },
  { id: 'pecho_08', nombre: 'Elevación frontales c/rotación', grupoMuscular: 'pecho', maquina: 'Mancuernas',  tipo: 'fuerza'   },
  { id: 'pecho_09', nombre: 'Fondos',                       grupoMuscular: 'pecho',   maquina: 'Paralelas',   tipo: 'fuerza'   },
  { id: 'pecho_10', nombre: 'Mariposa',                     grupoMuscular: 'pecho',   maquina: 'Máquina',     tipo: 'fuerza'   },
  { id: 'pecho_11', nombre: 'Press banca declinada',        grupoMuscular: 'pecho',   maquina: 'Barra',       tipo: 'fuerza'   },

  // ── ESPALDA ──────────────────────────────────────────────
  { id: 'espalda_01', nombre: 'Tirón polea ángulo',         grupoMuscular: 'espalda', maquina: 'Polea',       tipo: 'fuerza'   },
  { id: 'espalda_02', nombre: 'Tirón polea',                grupoMuscular: 'espalda', maquina: 'Polea',       tipo: 'fuerza'   },
  { id: 'espalda_03', nombre: 'Remo bajo dorsalera supino', grupoMuscular: 'espalda', maquina: 'Polea',       tipo: 'fuerza'   },
  { id: 'espalda_04', nombre: 'Remo con mancuerna',         grupoMuscular: 'espalda', maquina: 'Mancuernas',  tipo: 'fuerza'   },
  { id: 'espalda_05', nombre: 'Dominadas fijas',            grupoMuscular: 'espalda', maquina: 'Barra fija',  tipo: 'fuerza'   },
  { id: 'espalda_06', nombre: 'Remo T en ruck',             grupoMuscular: 'espalda', maquina: 'Ruck',        tipo: 'fuerza'   },
  { id: 'espalda_07', nombre: 'Remo con barra polea',       grupoMuscular: 'espalda', maquina: 'Polea',       tipo: 'fuerza'   },
  { id: 'espalda_08', nombre: 'Hiperextensiones',           grupoMuscular: 'espalda', maquina: 'Banco romano', tipo: 'fuerza'  },
  { id: 'espalda_09', nombre: 'Jalón brazos rectos',        grupoMuscular: 'espalda', maquina: 'Polea',       tipo: 'fuerza'   },
  { id: 'espalda_10', nombre: 'Pull over polea',            grupoMuscular: 'espalda', maquina: 'Polea',       tipo: 'fuerza'   },
  { id: 'espalda_11', nombre: 'Remo con barra',             grupoMuscular: 'espalda', maquina: 'Barra',       tipo: 'fuerza'   },
  { id: 'espalda_12', nombre: 'Face pull',                  grupoMuscular: 'espalda', maquina: 'Polea',       tipo: 'fuerza'   },

  // ── HOMBROS ──────────────────────────────────────────────
  { id: 'hombros_01', nombre: 'Vuelos laterales',           grupoMuscular: 'hombros', maquina: 'Mancuernas',  tipo: 'fuerza'   },
  { id: 'hombros_02', nombre: 'Vuelos frontales',           grupoMuscular: 'hombros', maquina: 'Mancuernas',  tipo: 'fuerza'   },
  { id: 'hombros_03', nombre: 'Vuelos posteriores',         grupoMuscular: 'hombros', maquina: 'Mancuernas',  tipo: 'fuerza'   },
  { id: 'hombros_04', nombre: 'Press Arnold',               grupoMuscular: 'hombros', maquina: 'Mancuernas',  tipo: 'fuerza'   },
  { id: 'hombros_05', nombre: 'Press militar',              grupoMuscular: 'hombros', maquina: 'Barra',       tipo: 'fuerza'   },
  { id: 'hombros_06', nombre: 'Press con mancuerna',        grupoMuscular: 'hombros', maquina: 'Mancuernas',  tipo: 'fuerza'   },
  { id: 'hombros_07', nombre: 'Manguito rotador',           grupoMuscular: 'hombros', maquina: 'Polea',       tipo: 'fuerza'   },
  { id: 'hombros_08', nombre: 'Elevación de hombros',       grupoMuscular: 'hombros', maquina: 'Mancuernas',  tipo: 'fuerza'   },
  { id: 'hombros_09', nombre: 'Remo al cuello',             grupoMuscular: 'hombros', maquina: 'Barra',       tipo: 'fuerza'   },
  { id: 'hombros_10', nombre: 'Medio movimiento',           grupoMuscular: 'hombros', maquina: 'Mancuernas',  tipo: 'fuerza'   },
  { id: 'hombros_11', nombre: 'Press tras nuca',            grupoMuscular: 'hombros', maquina: 'Barra',       tipo: 'fuerza'   },

  // ── BÍCEPS ───────────────────────────────────────────────
  { id: 'biceps_01', nombre: 'Curl de bíceps barra',        grupoMuscular: 'biceps',  maquina: 'Barra',       tipo: 'fuerza'   },
  { id: 'biceps_02', nombre: 'Curl de bíceps polea soga',   grupoMuscular: 'biceps',  maquina: 'Polea',       tipo: 'fuerza'   },
  { id: 'biceps_03', nombre: 'Curl de bíceps',              grupoMuscular: 'biceps',  maquina: 'Mancuernas',  tipo: 'fuerza'   },
  { id: 'biceps_04', nombre: 'Bíceps concentrado',          grupoMuscular: 'biceps',  maquina: 'Mancuernas',  tipo: 'fuerza'   },
  { id: 'biceps_05', nombre: 'Bíceps banco scott con W',    grupoMuscular: 'biceps',  maquina: 'Scott',       tipo: 'fuerza'   },
  { id: 'biceps_06', nombre: 'Hércules',                    grupoMuscular: 'biceps',  maquina: 'Polea',       tipo: 'fuerza'   },
  { id: 'biceps_07', nombre: 'Curl martillo',               grupoMuscular: 'biceps',  maquina: 'Mancuernas',  tipo: 'fuerza'   },

  // ── TRÍCEPS ──────────────────────────────────────────────
  { id: 'triceps_01', nombre: 'Tríceps en polea W cerrado', grupoMuscular: 'triceps', maquina: 'Polea',       tipo: 'fuerza'   },
  { id: 'triceps_02', nombre: 'Tríceps en polea W',         grupoMuscular: 'triceps', maquina: 'Polea',       tipo: 'fuerza'   },
  { id: 'triceps_03', nombre: 'Tríceps en polea',           grupoMuscular: 'triceps', maquina: 'Polea',       tipo: 'fuerza'   },
  { id: 'triceps_04', nombre: 'Fondos en paralelas',        grupoMuscular: 'triceps', maquina: 'Paralelas',   tipo: 'fuerza'   },
  { id: 'triceps_05', nombre: 'Empuje con barra',           grupoMuscular: 'triceps', maquina: 'Barra',       tipo: 'fuerza'   },
  { id: 'triceps_06', nombre: 'Patada de burro',            grupoMuscular: 'triceps', maquina: 'Mancuernas',  tipo: 'fuerza'   },
  { id: 'triceps_07', nombre: 'Press francés',              grupoMuscular: 'triceps', maquina: 'Barra',       tipo: 'fuerza'   },
  { id: 'triceps_08', nombre: 'Extensiones de codos W',     grupoMuscular: 'triceps', maquina: 'Barra W',     tipo: 'fuerza'   },
  { id: 'triceps_09', nombre: 'Extensiones sobre cabeza',   grupoMuscular: 'triceps', maquina: 'Polea',       tipo: 'fuerza'   },

  // ── PIERNAS ──────────────────────────────────────────────
  { id: 'piernas_01', nombre: 'Pantorrilla en prensa',      grupoMuscular: 'piernas', maquina: 'Prensa',      tipo: 'fuerza'   },
  { id: 'piernas_02', nombre: 'Pantorrilla sentado',        grupoMuscular: 'piernas', maquina: 'Máquina',     tipo: 'fuerza'   },
  { id: 'piernas_03', nombre: 'Pantorrilla parado',         grupoMuscular: 'piernas', maquina: 'Máquina',     tipo: 'fuerza'   },
  { id: 'piernas_04', nombre: 'Femorales parado',           grupoMuscular: 'piernas', maquina: 'Máquina',     tipo: 'fuerza'   },
  { id: 'piernas_05', nombre: 'Prensa',                     grupoMuscular: 'piernas', maquina: 'Prensa',      tipo: 'fuerza'   },
  { id: 'piernas_06', nombre: 'Sentadillas',                grupoMuscular: 'piernas', maquina: 'Barra',       tipo: 'fuerza'   },
  { id: 'piernas_07', nombre: 'Estocadas',                  grupoMuscular: 'piernas', maquina: 'Mancuernas',  tipo: 'fuerza'   },
  { id: 'piernas_08', nombre: 'Extensión cuádriceps',       grupoMuscular: 'piernas', maquina: 'Máquina',     tipo: 'fuerza'   },
  { id: 'piernas_09', nombre: 'Isquiotibiales',             grupoMuscular: 'piernas', maquina: 'Máquina',     tipo: 'fuerza'   },
  { id: 'piernas_10', nombre: 'Abductor multicadera',       grupoMuscular: 'piernas', maquina: 'Multicadera', tipo: 'fuerza'   },
  { id: 'piernas_11', nombre: 'Aductor sentada',            grupoMuscular: 'piernas', maquina: 'Máquina',     tipo: 'fuerza'   },
  { id: 'piernas_12', nombre: 'Ascenso en ruck',            grupoMuscular: 'piernas', maquina: 'Ruck',        tipo: 'fuerza'   },
  { id: 'piernas_13', nombre: 'Patada de glúteos',          grupoMuscular: 'piernas', maquina: 'Multicadera', tipo: 'fuerza'   },
  { id: 'piernas_14', nombre: 'Elevación de cadera',        grupoMuscular: 'piernas', maquina: 'Ninguna',     tipo: 'fuerza'   },
  { id: 'piernas_15', nombre: 'Peso muerto',                grupoMuscular: 'piernas', maquina: 'Barra',       tipo: 'fuerza'   },
  { id: 'piernas_16', nombre: 'Curl femoral tumbado',       grupoMuscular: 'piernas', maquina: 'Máquina',     tipo: 'fuerza'   },
  { id: 'piernas_17', nombre: 'Peso muerto rumano',         grupoMuscular: 'piernas', maquina: 'Barra',       tipo: 'fuerza'   },

  // ── CORE ─────────────────────────────────────────────────
  { id: 'core_01', nombre: 'Elevación de tronco',           grupoMuscular: 'core',    maquina: 'Ninguna',     tipo: 'fuerza'   },
  { id: 'core_02', nombre: 'Cortos',                        grupoMuscular: 'core',    maquina: 'Ninguna',     tipo: 'fuerza'   },
  { id: 'core_03', nombre: 'Buenos días',                   grupoMuscular: 'core',    maquina: 'Barra',       tipo: 'fuerza'   },
  { id: 'core_04', nombre: 'Hiperextensiones',              grupoMuscular: 'core',    maquina: 'Banco romano', tipo: 'fuerza'  },
  { id: 'core_05', nombre: 'Elevación de pelvis',           grupoMuscular: 'core',    maquina: 'Ninguna',     tipo: 'fuerza'   },
  { id: 'core_06', nombre: 'Elevación de rodillas',         grupoMuscular: 'core',    maquina: 'Ninguna',     tipo: 'fuerza'   },
  { id: 'core_07', nombre: 'Elevación piernas colgado',     grupoMuscular: 'core',    maquina: 'Barra fija',  tipo: 'fuerza'   },
  { id: 'core_08', nombre: 'Lateralización',                grupoMuscular: 'core',    maquina: 'Mancuernas',  tipo: 'fuerza'   },
  { id: 'core_09', nombre: 'Flexión de tronco',             grupoMuscular: 'core',    maquina: 'Ninguna',     tipo: 'fuerza'   },
  { id: 'core_10', nombre: 'Oblicuos',                      grupoMuscular: 'core',    maquina: 'Ninguna',     tipo: 'fuerza'   },
  { id: 'core_11', nombre: 'Plancha',                       grupoMuscular: 'core',    maquina: 'Ninguna',     tipo: 'tiempo'   },
  { id: 'core_12', nombre: 'Rueda abdominal',              grupoMuscular: 'core',    maquina: 'Rueda',       tipo: 'fuerza'   },
  { id: 'core_13', nombre: 'Crunch en máquina',            grupoMuscular: 'core',    maquina: 'Máquina',     tipo: 'fuerza'   },
  { id: 'core_14', nombre: 'Russian twist',                grupoMuscular: 'core',    maquina: 'Ninguna',     tipo: 'fuerza'   },
  { id: 'core_15', nombre: 'Plancha lateral',              grupoMuscular: 'core',    maquina: 'Ninguna',     tipo: 'tiempo'   },
  { id: 'core_16', nombre: 'Bicicleta abdominal',          grupoMuscular: 'core',    maquina: 'Ninguna',     tipo: 'fuerza'   },
  { id: 'core_17', nombre: 'Tijeras',                      grupoMuscular: 'core',    maquina: 'Ninguna',     tipo: 'fuerza'   },
  { id: 'core_18', nombre: 'Encogimientos en polea',       grupoMuscular: 'core',    maquina: 'Polea',       tipo: 'fuerza'   },

  // ── GLÚTEOS ──────────────────────────────────────────────
  { id: 'gluteos_01', nombre: 'Hip thrust',                 grupoMuscular: 'gluteos', maquina: 'Barra',       tipo: 'fuerza'   },
  { id: 'gluteos_02', nombre: 'Sentadilla sumo',            grupoMuscular: 'gluteos', maquina: 'Barra',       tipo: 'fuerza'   },
  { id: 'gluteos_03', nombre: 'Puente de glúteos',          grupoMuscular: 'gluteos', maquina: 'Ninguna',     tipo: 'fuerza'   },
  { id: 'gluteos_04', nombre: 'Sentadilla búlgara',         grupoMuscular: 'gluteos', maquina: 'Mancuernas',  tipo: 'fuerza'   },
  { id: 'gluteos_05', nombre: 'Kickback en máquina',        grupoMuscular: 'gluteos', maquina: 'Multicadera', tipo: 'fuerza'   },
  { id: 'gluteos_06', nombre: 'Abductor de pie',            grupoMuscular: 'gluteos', maquina: 'Polea',       tipo: 'fuerza'   },
  { id: 'gluteos_07', nombre: 'Patada trasera polea',       grupoMuscular: 'gluteos', maquina: 'Polea',       tipo: 'fuerza'   },

  // ── CARDIO ───────────────────────────────────────────────
  { id: 'cardio_01', nombre: 'Cinta',                       grupoMuscular: 'cardio',  maquina: 'Cinta',       tipo: 'cardio'   },
  { id: 'cardio_02', nombre: 'Bicicleta estática',          grupoMuscular: 'cardio',  maquina: 'Bicicleta',   tipo: 'cardio'   },
  { id: 'cardio_03', nombre: 'Remo ergómetro',              grupoMuscular: 'cardio',  maquina: 'Remo',        tipo: 'cardio'   },
  { id: 'cardio_04', nombre: 'Escalera',                    grupoMuscular: 'cardio',  maquina: 'Escalera',    tipo: 'cardio'   },
  { id: 'cardio_05', nombre: 'Elíptica',                    grupoMuscular: 'cardio',  maquina: 'Elíptica',    tipo: 'cardio'   },
  { id: 'cardio_06', nombre: 'HIIT',                        grupoMuscular: 'cardio',  maquina: 'Ninguna',     tipo: 'cardio'   },
  { id: 'cardio_07', nombre: 'Salto a la cuerda',           grupoMuscular: 'cardio',  maquina: 'Cuerda',      tipo: 'cardio'   },
  { id: 'cardio_08', nombre: 'Caminata inclinada',          grupoMuscular: 'cardio',  maquina: 'Cinta',       tipo: 'cardio'   },
];

// Indexed by muscle group for fast lookups
export const EXERCISES_BY_GROUP = EXERCISES.reduce((acc, ex) => {
  if (!acc[ex.grupoMuscular]) acc[ex.grupoMuscular] = [];
  acc[ex.grupoMuscular].push(ex);
  return acc;
}, {});

export const EXERCISE_BY_ID = EXERCISES.reduce((acc, ex) => {
  acc[ex.id] = ex;
  return acc;
}, {});
