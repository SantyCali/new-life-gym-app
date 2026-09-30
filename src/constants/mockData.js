export const stepMilestones = [
  { label: '2K',   steps:  2000, xp:  30 },
  { label: '5K',   steps:  5000, xp:  50 },
  { label: '7.4K', steps:  7420, xp:  75 },
  { label: '25K',  steps: 25505, xp: 200, isPremium: true },
];

export const todayWorkout = {
  id: 'wk-001',
  title: 'Cardio de Alta Intensidad',
  description:
    'Una sesión de 45 minutos diseñada para quemar grasa y mejorar la resistencia.',
  duration: '46 mins',
  type: 'Cardio',
  dayNumber: 1,
  muscleGroups: ['Piernas', 'Core'],
  image:
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80',
};

export const rutinaHoy = {
  title: 'Rutina de Hoy',
  muscleGroups: 'Espalda y Bíceps',
  exercisesCount: 3,
  exercises: [
    {
      id: 1,
      name: 'Remo con barra',
      series: 4,
      reps: 10,
      weightPrev: 60,
      weightTarget: 62.5,
      rpe: '8/10',
      status: 'active',
      image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80',
    },
    {
      id: 2,
      name: 'Dominadas',
      series: 3,
      reps: 'Max',
      weightPrev: null,
      weightTarget: 62.5,
      rpe: null,
      status: 'completed',
      image: 'https://images.unsplash.com/photo-1598971639058-fab3c3109a73?w=600&q=80',
    },
    {
      id: 3,
      name: 'Curl de bíceps',
      series: 3,
      reps: 12,
      weightPrev: null,
      weightTarget: null,
      rpe: null,
      status: 'completed',
      image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&q=80',
    },
  ],
};

export const logros = [
  {
    id: 1,
    title: 'Primero Personal',
    description:
      'Sé el primero en el bar de días consecutivos.',
    progress: 12,
    total: 30,
    type: 'bronze',
    icon: 'trophy-outline',
  },
  {
    id: 2,
    title: '100% Pasos',
    description: 'Completa tu meta de pasos 30 días seguidos.',
    progress: 12,
    total: 30,
    type: 'silver',
    icon: 'footsteps-outline',
  },
  {
    id: 3,
    title: '30 Días Seguidos',
    description: 'Mantén una racha de 30 entrenamientos.',
    progress: 12,
    total: 30,
    type: 'gold',
    icon: 'flame-outline',
  },
];

export const weeklyStats = [
  { day: 'L', steps: 9200, trained: true },
  { day: 'M', steps: 7800, trained: false },
  { day: 'X', steps: 11200, trained: true },
  { day: 'J', steps: 8420, trained: true },
  { day: 'V', steps: 6100, trained: false },
  { day: 'S', steps: 12400, trained: true },
  { day: 'D', steps: 5200, trained: false },
];

export const weightHistory = [
  { date: '1 Jun', weight: 95.0 },
  { date: '8 Jun', weight: 94.5 },
  { date: '15 Jun', weight: 94.0 },
  { date: '22 Jun', weight: 93.5 },
  { date: 'Hoy', weight: 93.0 },
];
