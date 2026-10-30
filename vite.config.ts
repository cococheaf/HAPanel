import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:4310', ws: true } },
  },
  build: {
    outDir: mode === 'demo' ? 'dist/demo' : 'dist/web',
    rollupOptions: {
      input: (mode === 'demo'
        ? { demo: resolve('demo.html') }
        : { editor: resolve('index.html'), display: resolve('display.html') }) as Record<
        string,
        string
      >,
    },
  },
}));
