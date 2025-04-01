/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
  readonly VITE_LEVANTE: string;
  readonly VITE_FIREBASE_PROJECT: 'DEV' | 'PROD';
  readonly VITE_AUTH_SESSION_TIMEOUT_IDLE_THRESHOLD: string;
  readonly VITE_AUTH_SESSION_TIMEOUT_COUNTDOWN_DURATION: string;
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 