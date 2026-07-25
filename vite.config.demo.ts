import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(__dirname, 'demo'),
  // The workbench ships its own CSS (demo/workbench.css) rather than Tailwind,
  // so it can't drift into the library's styling assumptions.
  plugins: [react()],
  server: { port: 5177, open: true },
  resolve: {
    alias: {
      '@nowah/orbs': resolve(__dirname, 'src/index.ts')
    }
  },
  build: {
    outDir: resolve(__dirname, 'dist-demo'),
    emptyOutDir: true,
    rollupOptions: {
      input: { main: resolve(__dirname, 'demo/index.html') }
    }
  }
});
