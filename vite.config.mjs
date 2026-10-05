import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Rutas relativas: la misma build funciona en la raíz (sala-de-espera-bice.vercel.app)
  // y bajo /sala/ del portafolio central (rewrite de Vercel).
  base: './',
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.js'] },
});
