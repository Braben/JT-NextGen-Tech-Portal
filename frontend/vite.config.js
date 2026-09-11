import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const _warn = console.warn; console.warn = (...a) => { if (typeof a[0] === 'string' && a[0].includes('A PostCSS plugin did not pass')) return; _warn(...a); };

export default defineConfig({
  plugins: [react()],
  optimizeDeps: { include: ['dompurify'] },
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/uploads': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          editor: ['dompurify'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
