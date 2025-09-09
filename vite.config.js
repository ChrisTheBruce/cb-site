import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],

  // 🔗 Path aliases for cleaner imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@worker': path.resolve(__dirname, 'worker'),
    },
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  // (kept from your current config)
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: true,
    manifest: true,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
