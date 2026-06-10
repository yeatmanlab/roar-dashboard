export const ASSIGNMENT_STATUSES = {
  CURRENT: 'current',
  PAST: 'past',
  UPCOMING: 'upcoming',
};

// @TODO: Remove Login after replacing the login page
export const NAVBAR_BLACKLIST = [
  'Login',
  'Maintenance',
  'PA',
  'PlayApp',
  'Register',
  'SignIn',
  'SRE',
  'SurveyManager',
  'SWR',
  'Translations',
] as const;
