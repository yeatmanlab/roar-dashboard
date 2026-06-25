import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

// Unlike webpack-based assessments, Vite uses index.html → src/main.js as the SPA
// entry. There is no serve/serve.js; src/main.js is the equivalent.
export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  define:
    mode !== 'lib'
      ? {
          ROAR_API_BASE_URL: JSON.stringify(process.env.ROAR_API_BASE_URL || ''),
          'process.env.FIREBASE_AUTH_EMULATOR_HOST': JSON.stringify(process.env.FIREBASE_AUTH_EMULATOR_HOST || ''),
        }
      : {},
  build:
    mode === 'lib'
      ? {
          lib: {
            entry: path.resolve(__dirname, 'src/index.js'),
            name: 'RoarSurvey',
            fileName: (format) => `roar-survey.${format}.js`,
          },
          rollupOptions: {
            external: ['vue'],
            output: { globals: { vue: 'Vue' } },
          },
          outDir: './lib',
        }
      : {
          outDir: './dist',
        },
}));
