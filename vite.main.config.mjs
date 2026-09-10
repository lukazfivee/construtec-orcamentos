import { defineConfig } from 'vite';

export default defineConfig({
  ssr: {
    noExternal: true,
    external: ['electron'],
  },
  build: {
    outDir: '.vite/build',
    emptyOutDir: false,
    ssr: 'src/main.ts',
    rollupOptions: {
      output: {
        entryFileNames: 'main.js',
        format: 'cjs',
      },
    },
  },
});
