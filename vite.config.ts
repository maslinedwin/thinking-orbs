import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src'],
      rollupTypes: true
    })
  ],
  build: {
    lib: {
      // Two entries: web and React Native. They share the engine, the presets
      // and the colour ramps — only the renderer and the component shell
      // differ, so the native bundle adds very little.
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        native: resolve(__dirname, 'src/native/index.ts')
      },
      name: 'NowahOrbs',
      // The package is type:module, so the CJS bundle needs a real `.cjs`
      // extension — a `.js` file would be parsed as ESM and its
      // `exports.*` assignments would silently produce an empty require().
      fileName: (format, entry) => (format === 'es' ? `${entry}.es.js` : `${entry}.cjs`),
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react-native',
        '@shopify/react-native-skia'
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime'
        }
      }
    }
  }
});
