// For surveys and audio files (new bucket structure)
export const LEVANTE_BUCKET_URL =
  import.meta.env.VITE_FIREBASE_PROJECT === 'DEV'
    ? 'https://storage.googleapis.com/levante-assets-dev'
    : 'https://storage.googleapis.com/levante-assets-prod';

// For dashboard UI static images (PNG files) hosted in the assets bucket.
// Path convention: `gs://levante-assets-*/visual/dashboard/...`
export const LEVANTE_STATIC_ASSETS_URL =
  import.meta.env.VITE_FIREBASE_PROJECT === 'DEV'
    ? 'https://storage.googleapis.com/levante-assets-dev/visual/dashboard'
    : 'https://storage.googleapis.com/levante-assets-prod/visual/dashboard';

export const LEVANTE_SURVEY_RESPONSES_KEY = 'levante-survey-responses';
export const LEVANTE_BUCKET_SURVEY_AUDIO =
  import.meta.env.VITE_FIREBASE_PROJECT === 'DEV'
    ? 'https://storage.googleapis.com/storage/v1/b/levante-assets-dev/o/'
    : 'https://storage.googleapis.com/storage/v1/b/levante-assets-prod/o/';
