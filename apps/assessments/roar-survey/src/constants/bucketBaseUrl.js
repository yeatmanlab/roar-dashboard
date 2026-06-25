const BUCKET_BASE_URL = 'https://storage.googleapis.com/roar-survey-app';

export const getBucketUrl = (lang = 'en') => `${BUCKET_BASE_URL}/${lang}/`;