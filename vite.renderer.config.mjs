import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  build: {
    modulePreload: false,
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5176',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    {
      name: 'remove-crossorigin',
      transformIndexHtml(html) {
        return html.replace(/ crossorigin(?:="[^"]*")?/g, '');
      },
    },
    {
      // Dev-only allowance so impeccable live mode can load its picker script.
      // apply: 'serve' means this never runs for `vite build`.
      name: 'impeccable-live-csp-dev-only',
      apply: 'serve',
      transformIndexHtml(html) {
        return html.replace(
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' file:",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' file: http://localhost:8400"
        );
      },
    },
  ],
});
