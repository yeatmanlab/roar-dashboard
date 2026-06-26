import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { existsSync, readFileSync } from 'fs';

const BUILD_MODES = new Set(['lib', 'staging', 'production']);

// Returns the dev server config (HTTPS + /v1 proxy). Only called in development
// mode — build modes skip this so readFileSync is never called in CI where the
// local TLS certs don't exist.
function getServerConfig(mode) {
  if (BUILD_MODES.has(mode)) return undefined;

  const keyPath = path.resolve(__dirname, '../../../certs/roar-local.key');
  const certPath = path.resolve(__dirname, '../../../certs/roar-local.crt');

  return {
    // Mirrors the webpack-dev-server https config used by other assessments.
    https:
      existsSync(keyPath) && existsSync(certPath)
        ? { key: readFileSync(keyPath), cert: readFileSync(certPath) }
        : undefined,
    // Proxy /v1 to the local backend — mirrors the Firebase Hosting rewrite so
    // the browser sees a same-origin request.
    proxy: {
      '/v1': {
        target: process.env.BACKEND_URL ?? 'https://localhost:4000',
        secure: false,
        changeOrigin: true,
      },
    },
  };
}

// Unlike webpack-based assessments, Vite uses index.html → src/main.js as the SPA
// entry. There is no serve/serve.js; src/main.js is the equivalent.
export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  define:
    mode !== 'lib'
      ? {
          // Default to '/v1' so dev builds use relative URLs proxied by Vite.
          // Set ROAR_API_BASE_URL for production — full URL including /v1.
          ROAR_API_BASE_URL: JSON.stringify(process.env.ROAR_API_BASE_URL || '/v1'),
          'process.env.FIREBASE_AUTH_EMULATOR_HOST': JSON.stringify(process.env.FIREBASE_AUTH_EMULATOR_HOST || ''),
        }
      : {},
  server: getServerConfig(mode),
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
