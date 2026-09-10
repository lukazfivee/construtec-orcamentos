import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '.vite/build',
    emptyOutDir: false,
    ssr: 'src/preload.ts',
    rollupOptions: {
      output: {
        entryFileNames: 'preload.js',
        format: 'cjs',
      },
    },
  },
});
