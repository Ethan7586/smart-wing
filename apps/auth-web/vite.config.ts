import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  return {
    // 生产环境仅由 hbbtzn.com/login 提供，避免与员工商城的根路径静态资源冲突。
    base: command === 'build' ? '/login/' : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3002,
      /**
       * In production Caddy reverse-proxies hbbtzn.com/api/* to the commerce
       * runtime. The dev server must do the same or every credential request
       * would hit the Vite server itself and fail.
       */
      proxy: {
        '/api': {
          target: process.env.COMMERCE_API_ORIGIN ?? 'http://localhost:3000',
          changeOrigin: false,
        },
      },
      // Keep the development server stable when a CI-like environment disables HMR.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    // `vite preview` sits behind Caddy at hbbtzn.com/login in the public test
    // environment. Keep the explicit host allowlist; do not turn on allowHosts: true.
    preview: {
      allowedHosts: ['hbbtzn.com', 'www.hbbtzn.com'],
    },
  };
});
