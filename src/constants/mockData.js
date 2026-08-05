export const user = {
  name: 'Santi',
  lastName: 'Piedrabuena',
  level: 14,
  nextLevel: 15,
  xp: 3200,
  xpRequired: 4000,
  coins: 2480,
  streakDays: 12,
  age: 25,
  weight: 93,
  height: 190,
  sex: 'Masculino',
  goal: 'Hipertrofia',
  bodyFat: 14.5,
  avatar: null,
};

export const todayStats = {
  steps: 8420,
  stepsGoal: 10000,
  calories: 842,
  distanceKm: 6.4,
  activeMinutes: 72,
  coinsToday: 120,
};

export const stepMilestones = [
  { label: '2K', steps: 2000, xp: 1, coins: 5 },
  { label: '5K', steps: 5000, xp: 2, coins: 10 },
  { label: '7.4K', steps: 7420, xp: 3, coins: 15 },
  { label: '25K', steps: 25505, xp: 5, coins: 30, isPremium: true },
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

export const misiones = [
  {
    id: 1,
    title: 'Caminar 8000+ pasos',
    xp: 4,
    coins: 10,
    status: 'completed',
    icon: 'footsteps-outline',
    progress: 8420,
    total: 8000,
  },
  {
    id: 2,
    title: 'Completar rutina',
    xp: 4,
    coins: 15,
    status: 'completed',
    icon: 'barbell-outline',
    progress: 1,
    total: 1,
  },
  {
    id: 3,
    title: 'Beber 2L agua',
    xp: 4,
    coins: 5,
    status: 'locked',
    icon: 'water-outline',
    progress: 0,
    total: 2,
  },
  {
    id: 4,
    title: 'Dormir 7+ horas',
    xp: 4,
    coins: 10,
    status: 'pending',
    icon: 'moon-outline',
    progress: 0,
    total: 7,
  },
];

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

export const productos = [
  {
    id: 1,
    title: 'Remera Oficial',
    description: 'Remera oficial New Life. 100% algodón premium.',
    price: 500,
    category: 'Ropa',
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80',
    available: true,
  },
  {
    id: 2,
    title: 'Botella New Life',
    description: 'Botella de acero inoxidable 750ml. Sin BPA.',
    price: 350,
    category: 'Accesorios',
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80',
    available: true,
  },
  {
    id: 3,
    title: 'Toalla Oficial',
    description: 'Toalla de microfibra con logo bordado New Life.',
    price: 400,
    category: 'Accesorios',
    image: 'https://images.unsplash.com/photo-1607006344380-b6775a0824a7?w=600&q=80',
    available: true,
  },
  {
    id: 4,
    title: 'Shaker Pro',
    description: 'Vaso mezclador profesional 600ml con filtro.',
    price: 300,
    category: 'Accesorios',
    image: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=600&q=80',
    available: true,
  },
  {
    id: 5,
    title: 'Proteína Plus',
    description: 'Suplemento whey de alta calidad. 2kg, 66 porciones.',
    price: 1200,
    category: 'Suplementos',
    image: 'https://images.unsplash.com/photo-1579722820308-d74e571900a9?w=600&q=80',
    available: true,
  },
  {
    id: 6,
    title: 'Remera Fitness Plus',
    description: 'Edición limitada con tecnología dry-fit y UV protection.',
    price: 700,
    category: 'Ropa',
    image: 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600&q=80',
    available: true,
    featured: true,
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
