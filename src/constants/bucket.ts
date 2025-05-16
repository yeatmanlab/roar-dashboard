export const LEVANTE_BUCKET_URL = import.meta.env.VITE_FIREBASE_PROJECT === 'DEV' ? 'https://storage.googleapis.com/levante-dashboard-dev' : 'https://storage.googleapis.com/road-dashboard';
export const LEVANTE_SURVEY_RESPONSES_KEY = 'levante-survey-responses';
export const LEVANTE_BUCKET_SURVEY_AUDIO = import.meta.env.VITE_FIREBASE_PROJECT === 'DEV' ? 'https://storage.googleapis.com/storage/v1/b/levante-dashboard-dev/o/' : 'https://storage.googleapis.com/storage/v1/b/road-dashboard/o/';
