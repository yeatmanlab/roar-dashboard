/**
 * Application routes
 *
 * @TODO The below APP_ROUTES only contains a limited number of routes as it's a new addition to the application. This
 * should be extended to include all the routes of the application.
 *
 * @constant {Object} APP_ROUTES – The individual routes of the application.
 */
export const GAME_ROUTES = {
  SWR: '/game/swr',
  SWR_ES: '/game/swr-es',
  PA: '/game/pa',
  PA_ES: '/game/pa-es',
  SRE: '/game/sre',
  SRE_ES: '/game/sre-es',
  LETTER: '/game/letter',
  LETTER_ES: '/game/letter-es',
  LETTER_EN_CA: '/game/letter-en-ca',
  PHONICS: '/game/phonics',
  MULTICHOICE: '/game/multichoice',
  MORPHOLOGY: '/game/morphology',
  CVA: '/game/cva',
  VOCAB: '/game/vocab',
  FLUENCY_ARF: '/game/fluency-arf',
  FLUENCY_ARF_ES: '/game/fluency-arf-es',
  FLUENCY_CALF: '/game/fluency-calf',
  FLUENCY_CALF_ES: '/game/fluency-calf-es',
  ROAM_ALPACA: '/game/roam-alpaca',
  ROAM_ALPACA_ES: '/game/roam-alpaca-es',
  CORE_TASKS: '/game/core-tasks/:taskId',
  RAN: '/game/ran',
  CROWDING: '/game/crowding',
  ROAV_MEP: '/game/roav-mep',
  ROAR_READALOUD: '/game/roar-readaloud',
  SURVEY: '/game/roar-survey',
};

export const APP_ROUTES = {
  HOME: '/',
  ACCOUNT_PROFILE: '/profile',
  AUTH_CLASSLINK: '/auth-classlink',
  AUTH_CLEVER: '/auth-clever',
  AUTH_EMAIL_LINK: '/auth-email-link',
  AUTH_NYCPS: '/auth-nycps',
  AUTH_NYCPS_INITIATE: '/initiate-auth-nycps',
  CREATE_ADMINISTRATION: '/administration/create',
  DUPLICATE_ADMINISTRATION: '/administration/:formType/:adminId',
  EDIT_ADMINISTRATION: '/administration/:formType/:adminId',
  LAUNCH: '/launch/:launchId',
  ORGS_CREATE: '/create-orgs',
  ORGS_LIST: '/list-orgs',
  PROGRESS_REPORT: '/administration/:administrationId/:orgType/:orgId',
  REGISTER: '/register',
  SCORE_REPORT: '/scores/:administrationId/:orgType/:orgId',
  SCORE_REPORT_STUDENT: '/scores/:administrationId/:orgType/:orgId/user/:userId/new',
  SIGN_IN: '/signin',
  SIGN_IN_PARTNERS: '/signin-partners',
  SSO: '/sso',
  STUDENT_REPORT: '/scores/:administrationId/:orgType/:orgId/user/:userId',
  UNAUTHORIZED: '/unauthorized',
};

export const ADMINISTRATION_FORM_TYPES = {
  CREATE: 'create',
  EDIT: 'edit',
  DUPLICATE: 'duplicate',
};
