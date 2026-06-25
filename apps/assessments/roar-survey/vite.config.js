import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  build: mode === 'lib'
    ? {
        lib: {
          entry: path.resolve(__dirname, 'src/index.js'),
          name: 'RoarSurvey',
          fileName: (format) => `roar-survey.${format}.js`,
        },
        rollupOptions: {
          external: ['vue'],
          output: {
            globals: {
              vue: 'Vue',
            },
          },
        },
        outDir: './lib'
      }
    : 
    {
      outDir: './dist',
    },
}));
