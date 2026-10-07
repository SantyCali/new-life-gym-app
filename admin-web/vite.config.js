import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Config independiente de la app Expo/React Native — no comparte build ni
// dependencias con esa app, corre como un proyecto Vite normal.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // El catálogo de ejercicios se toma de la app (../src/constants), para que
    // la web y el celular usen la misma lista.
    fs: { allow: ['..'] },
  },
});
