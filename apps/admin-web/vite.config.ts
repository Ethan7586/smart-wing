import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      /**
       * In production Caddy reverse-proxies smart.hbbtzn.com/api/* to the commerce
       * runtime. The dev server must do the same or every authenticated request
       * would hit the Vite server itself and fail.
       */
      proxy: {
        '/api': {
          target: process.env.COMMERCE_API_ORIGIN ?? 'http://localhost:3000',
          changeOrigin: false,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
