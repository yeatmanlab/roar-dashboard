// For surveys and audio files (new bucket structure)
export const LEVANTE_BUCKET_URL =
  import.meta.env.VITE_FIREBASE_PROJECT === 'DEV'
    ? 'https://storage.googleapis.com/levante-assets-dev'
    : 'https://storage.googleapis.com/levante-assets-prod';

// For static assets like PNG files (original buckets)
export const LEVANTE_STATIC_ASSETS_URL =
  import.meta.env.VITE_FIREBASE_PROJECT === 'DEV'
    ? 'https://storage.googleapis.com/levante-dashboard-dev'
    : 'https://storage.googleapis.com/road-dashboard';

export const LEVANTE_SURVEY_RESPONSES_KEY = 'levante-survey-responses';
export const LEVANTE_BUCKET_SURVEY_AUDIO =
  import.meta.env.VITE_FIREBASE_PROJECT === 'DEV'
    ? 'https://storage.googleapis.com/storage/v1/b/levante-assets-dev/o/'
    : 'https://storage.googleapis.com/storage/v1/b/levante-assets-prod/o/';
