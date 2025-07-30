export const LEVANTE_BUCKET_URL =
  import.meta.env.VITE_FIREBASE_PROJECT === 'DEV'
    ? 'https://storage.googleapis.com/levante-dashboard-dev'
    : 'https://storage.googleapis.com/road-dashboard';

export const LEVANTE_SURVEY_RESPONSES_KEY = 'levante-survey-responses';

export const LEVANTE_BUCKET_SURVEY_AUDIO =
  import.meta.env.VITE_FIREBASE_PROJECT === 'DEV'
    ? 'https://storage.googleapis.com/storage/v1/b/levante-dashboard-dev/o/'
    : 'https://storage.googleapis.com/storage/v1/b/road-dashboard/o/';

// Available survey files in the bucket
export const SURVEY_FILES = {
  PARENT_FAMILY: 'parent_survey_family.json',
  PARENT_CHILD: 'parent_survey_child.json',
  CHILD: 'child_survey.json',
  TEACHER_GENERAL: 'teacher_survey_general.json',
  TEACHER_CLASSROOM: 'teacher_survey_classroom.json'
} as const;

export type SurveyFileKey = keyof typeof SURVEY_FILES;
export type SurveyFileName = typeof SURVEY_FILES[SurveyFileKey];
