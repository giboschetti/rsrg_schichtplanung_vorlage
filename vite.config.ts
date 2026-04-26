import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const projectDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(projectDir, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-table': ['@tanstack/react-table'],
          'vendor-state': ['zustand'],
          'vendor-export': ['xlsx', 'jspdf', 'jspdf-autotable'],
        },
      },
    },
  },
});
