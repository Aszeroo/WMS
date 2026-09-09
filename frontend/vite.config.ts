import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: 'localhost',
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('antd/locale')) {
            return 'antd-locale';
          }
          if (id.includes('antd')) {
            return 'antd';
          }
        }
      }
    }
  }
});
