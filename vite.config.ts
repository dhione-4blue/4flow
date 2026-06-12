import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuração do Vite — build do frontend 4Flow
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          charts: ['recharts'],
        },
      },
    },
  },
});
