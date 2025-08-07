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
  SIGN_IN: '/signin',
  SSO: '/sso',
  PROGRESS_REPORT: '/administration/:administrationId/:orgType/:orgId',
  SCORE_REPORT: '/scores/:administrationId/:orgType/:orgId',
  STUDENT_REPORT: '/scores/:administrationId/:orgType/:orgId/user/:userId',
  SCORE_REPORT_STUDENT: '/scores/:administrationId/:orgType/:orgId/user/:userId/new',
  ACCOUNT_PROFILE: '/profile',
  ORGS_LIST: '/list-orgs',
  ORGS_CREATE: '/create-orgs',
  REGISTER: '/register',
  LAUNCH: '/launch/:launchId',
  CREATE_ADMINISTRATION: '/administration/create',
  EDIT_ADMINISTRATION: '/administration/:formType/:adminId',
  DUPLICATE_ADMINISTRATION: '/administration/:formType/:adminId',
  UNAUTHORIZED: '/unauthorized',
};

export const ADMINISTRATION_FORM_TYPES = {
  CREATE: 'create',
  EDIT: 'edit',
  DUPLICATE: 'duplicate',
};
