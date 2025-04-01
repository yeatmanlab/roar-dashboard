/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
  readonly VITE_LEVANTE: string;
  readonly VITE_FIREBASE_PROJECT: 'DEV' | 'PROD';
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 