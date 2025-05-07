import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { pageTitlesEN, pageTitlesUS, pageTitlesES, pageTitlesCO } from '@/translations/exports';
import { APP_ROUTES, GAME_ROUTES } from '@/constants/routes';
import { usePermissions } from '@/composables/usePermissions';
const { Permissions } = usePermissions();

function removeQueryParams(to) {
  if (Object.keys(to.query).length) return { path: to.path, query: {}, hash: to.hash };
}

function removeHash(to) {
  if (to.hash) return { path: to.path, query: to.query, hash: '' };
}

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../pages/HomeSelector.vue'),
    meta: {
      pageTitle: {
        'en-US': pageTitlesUS['home'],
        en: pageTitlesEN['home'],
        es: pageTitlesES['home'],
        'es-CO': pageTitlesCO['home'],
      },
    },
  },
  {
    path: GAME_ROUTES.SWR,
    name: 'SWR',
    component: () => import('../components/tasks/TaskSWR.vue'),
    props: { taskId: 'swr', language: 'en' },
    meta: { pageTitle: 'SWR' },
  },
  {
    path: GAME_ROUTES.SWR_ES,
    name: 'SWR-ES',
    component: () => import('../components/tasks/TaskSWR.vue'),
    props: { taskId: 'swr-es', language: 'es' },
    meta: { pageTitle: 'SWR (ES)' },
  },
  {
    path: GAME_ROUTES.PA,
    name: 'PA',
    component: () => import('../components/tasks/TaskPA.vue'),
    props: { taskId: 'pa', language: 'en' },
    meta: { pageTitle: 'PA' },
  },
  {
    path: GAME_ROUTES.PA_ES,
    name: 'PA-ES',
    component: () => import('../components/tasks/TaskPA.vue'),
    props: { taskId: 'pa-es', language: 'es' },
    meta: { pageTitle: 'PA-ES' },
  },
  {
    path: GAME_ROUTES.SRE,
    name: 'SRE',
    component: () => import('../components/tasks/TaskSRE.vue'),
    props: { taskId: 'sre', language: 'en' },
    meta: { pageTitle: 'SRE' },
  },
  {
    path: GAME_ROUTES.SRE_ES,
    name: 'SRE-ES',
    component: () => import('../components/tasks/TaskSRE.vue'),
    props: { taskId: 'sre-es', language: 'es' },
    meta: { pageTitle: 'SRE-ES' },
  },
  {
    path: GAME_ROUTES.LETTER,
    name: 'Letter',
    component: () => import('../components/tasks/TaskLetter.vue'),
    props: { taskId: 'letter', language: 'en' },
    meta: { pageTitle: 'Letter' },
  },
  {
    path: GAME_ROUTES.LETTER_ES,
    name: 'Letter-ES',
    component: () => import('../components/tasks/TaskLetter.vue'),
    props: { taskId: 'letter-es', language: 'es' },
    meta: { pageTitle: 'Letter-ES' },
  },
  {
    path: GAME_ROUTES.LETTER_EN_CA,
    name: 'Letter-EN-CA',
    component: () => import('../components/tasks/TaskLetter.vue'),
    props: { taskId: 'letter-en-ca', language: 'en-CA' },
    meta: { pageTitle: 'Letter-EN-CA' },
  },
  {
    path: GAME_ROUTES.PHONICS,
    name: 'Phonics',
    component: () => import('../components/tasks/TaskLetter.vue'),
    props: { taskId: 'phonics', language: 'en' },
    meta: { pageTitle: 'Phonics' },
  },
  {
    path: GAME_ROUTES.MULTICHOICE,
    name: 'Multichoice',
    component: () => import('../components/tasks/TaskMultichoice.vue'),
    props: { taskId: 'multichoice', language: 'en' },
    meta: { pageTitle: 'Multichoice' },
  },
  {
    path: GAME_ROUTES.MORPHOLOGY,
    name: 'Morphology',
    component: () => import('../components/tasks/TaskMultichoice.vue'),
    props: { taskId: 'morphology', language: 'en' },
    meta: { pageTitle: 'Morphology' },
  },
  {
    path: GAME_ROUTES.CVA,
    name: 'Cva',
    component: () => import('../components/tasks/TaskMultichoice.vue'),
    props: { taskId: 'cva', language: 'en' },
    meta: { pageTitle: 'CVA' },
  },
  {
    path: GAME_ROUTES.VOCAB,
    name: 'Vocab',
    component: () => import('../components/tasks/TaskVocab.vue'),
    props: { taskId: 'vocab', language: 'en' },
    meta: { pageTitle: 'Vocab' },
  },
  {
    path: GAME_ROUTES.FLUENCY_ARF,
    name: 'Fluency-ARF',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: { taskId: 'fluency-arf', language: 'en' },
    meta: { pageTitle: 'ROAM-ARF' },
  },
  {
    path: GAME_ROUTES.FLUENCY_ARF_ES,
    name: 'Fluency-ARF-ES',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: { taskId: 'fluency-arf-es', language: 'es' },
    meta: { pageTitle: 'ROAM-ARF ES' },
  },
  {
    path: GAME_ROUTES.FLUENCY_CALF,
    name: 'Fluency-CALF',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: { taskId: 'fluency-calf', language: 'en' },
    meta: { pageTitle: 'ROAM-CALF' },
  },
  {
    path: GAME_ROUTES.FLUENCY_CALF_ES,
    name: 'Fluency-CALF-ES',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: { taskId: 'fluency-calf-es', language: 'es' },
    meta: { pageTitle: 'ROAM-CALF ES' },
  },
  {
    path: GAME_ROUTES.ROAM_ALPACA,
    name: 'Fluency-Alpaca',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: { taskId: 'roam-alpaca', language: 'en' },
    meta: { pageTitle: 'ROAM-Alpaca' },
  },
  {
    path: GAME_ROUTES.ROAM_ALPACA_ES,
    name: 'Fluency-Alpaca-ES',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: { taskId: 'roam-alpaca-es', language: 'es' },
    meta: { pageTitle: 'ROAM-Alpaca ES' },
  },
  {
    path: GAME_ROUTES.CORE_TASKS,
    name: 'Core Tasks',
    component: () => import('../components/tasks/TaskLevante.vue'),
    props: true,
    // Add which specific task?
    // Code in App.vue overwrites updating it programmatically
    meta: { pageTitle: 'Core Tasks' },
  },
  {
    path: GAME_ROUTES.RAN,
    name: 'RAN',
    component: () => import('../components/tasks/TaskRan.vue'),
    props: { taskId: 'ran', language: 'en' },
    meta: { pageTitle: 'RAN' },
  },
  {
    path: GAME_ROUTES.CROWDING,
    name: 'Crowding',
    component: () => import('../components/tasks/TaskCrowding.vue'),
    props: { taskId: 'crowding', language: 'en' },
    meta: { pageTitle: 'Crowding' },
  },
  {
    path: GAME_ROUTES.ROAV_MEP,
    name: 'MEP',
    component: () => import('../components/tasks/TaskMEP.vue'),
    props: { taskId: 'roav-mep', language: 'en' },
    meta: { pageTitle: 'MEP' },
  },
  {
    path: GAME_ROUTES.ROAR_READALOUD,
    name: 'ReadAloud',
    component: () => import('../components/tasks/TaskReadAloud.vue'),
    props: { taskId: 'roar-readaloud', language: 'en' },
    meta: { pageTitle: 'ReadAloud' },
  },
  {
    path: APP_ROUTES.LAUNCH,
    component: () => import('../pages/HomeParticipant.vue'),
    props: true,
    name: 'LaunchParticipant',
    meta: {
      pageTitle: 'TaskLauncher Home',
      permission: Permissions.Tasks.LAUNCH,
    },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.SWR,
    name: 'Launch SWR',
    component: () => import('../components/tasks/TaskSWR.vue'),
    props: (route) => ({
      taskId: 'swr',
      language: 'en',
      launchId: route.params.launchId,
    }),
    meta: {
      pageTitle: 'SWR',
      permission: Permissions.Tasks.LAUNCH,
    },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.SWR_ES,
    name: 'Launch SWR-ES',
    component: () => import('../components/tasks/TaskSWR.vue'),
    props: (route) => ({
      taskId: 'swr-es',
      language: 'es',
      launchId: route.params.launchId,
    }),
    meta: { pageTitle: 'SWR (ES)', permission: Permissions.Tasks.LAUNCH },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.PA,
    name: 'Launch PA',
    component: () => import('../components/tasks/TaskPA.vue'),
    props: (route) => ({
      taskId: 'pa',
      language: 'en',
      launchId: route.params.launchId,
    }),
    meta: {
      pageTitle: 'PA',
      permission: Permissions.Tasks.LAUNCH,
    },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.PA_ES,
    name: 'Launch PA-ES',
    component: () => import('../components/tasks/TaskPA.vue'),
    props: (route) => ({
      taskId: 'pa-es',
      language: 'es',
      launchId: route.params.launchId,
    }),
    meta: { pageTitle: 'PA-ES', permission: Permissions.Tasks.LAUNCH },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.SRE,
    name: 'Launch SRE',
    component: () => import('../components/tasks/TaskSRE.vue'),
    props: (route) => ({
      taskId: 'sre',
      language: 'en',
      launchId: route.params.launchId,
    }),
    meta: { pageTitle: 'SRE', permission: Permissions.Tasks.LAUNCH },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.LETTER,
    name: 'Launch Letter',
    component: () => import('../components/tasks/TaskLetter.vue'),
    props: (route) => ({
      taskId: 'letter',
      language: 'en',
      launchId: route.params.launchId,
    }),
    meta: { pageTitle: 'Letter', permission: Permissions.Tasks.LAUNCH },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.LETTER_ES,
    name: 'Launch Letter-ES',
    component: () => import('../components/tasks/TaskLetter.vue'),
    props: (route) => ({
      taskId: 'letter-es',
      language: 'es',
      launchId: route.params.launchId,
    }),
    meta: { pageTitle: 'Letter-ES', permission: Permissions.Tasks.LAUNCH },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.LETTER_EN_CA,
    name: 'Launch Letter-EN-CA',
    component: () => import('../components/tasks/TaskLetter.vue'),
    props: (route) => ({
      taskId: 'letter-en-ca',
      language: 'en-CA',
      launchId: route.params.launchId,
    }),
    meta: { pageTitle: 'Letter-EN-CA', permission: Permissions.Tasks.LAUNCH },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.MULTICHOICE,
    name: 'Launch Multichoice',
    component: () => import('../components/tasks/TaskMultichoice.vue'),
    props: (route) => ({
      taskId: 'multichoice',
      language: 'en',
      launchId: route.params.launchId,
    }),
    meta: { pageTitle: 'Multichoice', permission: Permissions.Tasks.LAUNCH },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.MORPHOLOGY,
    name: 'Launch Morphology',
    component: () => import('../components/tasks/TaskMultichoice.vue'),
    props: (route) => ({
      taskId: 'morphology',
      language: 'en',
      launchId: route.params.launchId,
    }),
    meta: { pageTitle: 'Morphology', permission: Permissions.Tasks.LAUNCH },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.CVA,
    name: 'Launch CVA',
    component: () => import('../components/tasks/TaskMultichoice.vue'),
    props: (route) => ({
      taskId: 'cva',
      language: 'en',
      launchId: route.params.launchId,
    }),
    meta: { pageTitle: 'CVA', permission: Permissions.Tasks.LAUNCH },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.VOCAB,
    name: 'Launch Vocab',
    component: () => import('../components/tasks/TaskVocab.vue'),
    props: (route) => ({
      taskId: 'vocab',
      language: 'en',
      launchId: route.params.launchId,
    }),
    meta: { pageTitle: 'Vocab', permission: Permissions.Tasks.LAUNCH },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.FLUENCY_ARF,
    name: 'Launch Fluency-ARF',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: (route) => ({
      taskId: 'fluency-arf',
      language: 'en',
      launchId: route.params.launchId,
    }),
    meta: { pageTitle: 'ROAM-ARF', permission: Permissions.Tasks.LAUNCH },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.FLUENCY_ARF_ES,
    name: 'Launch Fluency-ARF-ES',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: (route) => ({
      taskId: 'fluency-arf-es',
      language: 'es',
      launchId: route.params.launchId,
    }),
    meta: { pageTitle: 'ROAM-ARF ES', permission: Permissions.Tasks.LAUNCH },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.FLUENCY_CALF,
    name: 'Launch Fluency-CALF',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: (route) => ({
      taskId: 'fluency-calf',
      language: 'en',
      launchId: route.params.launchId,
    }),
    meta: { pageTitle: 'ROAM-CALF', permission: Permissions.Tasks.LAUNCH },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.FLUENCY_CALF_ES,
    name: 'Launch Fluency-CALF-ES',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: (route) => ({
      taskId: 'fluency-calf-es',
      language: 'es',
      launchId: route.params.launchId,
    }),
    meta: { pageTitle: 'ROAM-CALF ES', permission: Permissions.Tasks.LAUNCH },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.ROAM_ALPACA,
    name: 'Launch Fluency-Alpaca',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: (route) => ({
      taskId: 'roam-alpaca',
      language: 'en',
      launchId: route.params.launchId,
    }),
    meta: { pageTitle: 'ROAM-Alpaca', permission: Permissions.Tasks.LAUNCH },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.ROAM_ALPACA_ES,
    name: 'Launch Fluency-Alpaca-ES',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: (route) => ({
      taskId: 'roam-alpaca-es',
      language: 'es',
      launchId: route.params.launchId,
    }),
    meta: { pageTitle: 'ROAM-Alpaca ES', permission: Permissions.Tasks.LAUNCH },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.CORE_TASKS,
    name: 'Launch Core Tasks',
    component: () => import('../components/tasks/TaskLevante.vue'),
    props: (route) => ({
      taskId: 'core-tasks',
      language: 'en',
      launchId: route.params.launchId,
    }),
    meta: { pageTitle: 'Core Tasks', permission: Permissions.Tasks.LAUNCH },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.RAN,
    name: 'Launch RAN',
    component: () => import('../components/tasks/TaskRan.vue'),
    props: (route) => ({
      taskId: 'ran',
      language: 'en',
      launchId: route.params.launchId,
    }),
    meta: {
      pageTitle: 'RAN',
      permission: Permissions.Tasks.LAUNCH,
    },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.CROWDING,
    name: 'Launch Crowding',
    component: () => import('../components/tasks/TaskCrowding.vue'),
    props: (route) => ({
      taskId: 'crowding',
      language: 'en',
      launchId: route.params.launchId,
    }),
    meta: { pageTitle: 'Crowding', permission: Permissions.Tasks.LAUNCH },
  },
  {
    path: '/launch/:launchId' + GAME_ROUTES.ROAV_MEP,
    name: 'Launch MEP',
    component: () => import('../components/tasks/TaskMEP.vue'),
    props: (route) => ({
      taskId: 'roav-mep',
      language: 'en',
      launchId: route.params.launchId,
    }),
    meta: { pageTitle: 'MEP', permission: Permissions.Tasks.LAUNCH },
  },
  {
    path: '/manage-tasks-variants',
    name: 'ManageTasksVariants',
    component: () => import('../pages/ManageTasksVariants.vue'),
    meta: {
      pageTitle: 'Manage Tasks',
      permission: Permissions.Tasks.UPDATE,
    },
  },
  {
    path: APP_ROUTES.REGISTER,
    name: 'RegisterHome',
    component: () => import('../pages/RegisterFamilyUsers.vue'),
    props: (route) => ({ code: route.query.code }),
    children: [
      {
        name: 'Register',
        path: '',
        component: () => import('../components/auth/RegisterParent.vue'),
      },
      {
        name: 'registerStudent',
        path: 'student',
        component: () => import('../components/auth/RegisterChildren.vue'),
      },
    ],
    meta: { requiresGuest: true },
  },
  {
    path: '/register-students',
    name: 'RegisterStudents',
    component: () => import('../pages/RegisterStudents.vue'),
    meta: {
      pageTitle: 'Register Students',
      permission: Permissions.Users.CREATE,
    },
  },
  {
    path: APP_ROUTES.SIGN_IN,
    name: 'SignIn',
    component: () => import('../pages/SignIn.vue'),
    meta: {
      pageTitle: {
        'en-US': pageTitlesUS['signIn'],
        en: pageTitlesEN['signIn'],
        es: pageTitlesES['signIn'],
        'es-CO': pageTitlesCO['signIn'],
      },
    },
  },
  {
    path: APP_ROUTES.SSO,
    name: 'SSO',
    beforeRouteLeave: [removeQueryParams, removeHash],
    component: () => import('../pages/SSOAuthPage.vue'),
    props: (route) => ({ code: route.query.code }), // @TODO: Isn't the code processed by the sign-in page?
    meta: { pageTitle: 'Signing you in…' },
  },
  {
    path: '/auth-clever',
    name: 'AuthClever',
    beforeRouteLeave: [removeQueryParams, removeHash],
    component: () => import('../components/auth/AuthClever.vue'),
    props: (route) => ({ code: route.query.code }),
    meta: { pageTitle: 'Clever Authentication' },
  },
  {
    path: '/auth-classlink',
    name: 'AuthClassLink',
    beforeRouteLeave: [removeQueryParams, removeHash],
    component: () => import('../components/auth/AuthClassLink.vue'),
    props: (route) => ({ code: route.query.code }),
    meta: { pageTitle: 'ClassLink Authentication' },
  },
  {
    path: '/auth-email-link',
    name: 'AuthEmailLink',
    beforeRouteLeave: [removeQueryParams, removeHash],
    component: () => import('../components/auth/AuthEmailLink.vue'),
    meta: { pageTitle: 'Email Link Authentication' },
  },
  {
    path: '/auth-email-sent',
    name: 'AuthEmailSent',
    component: () => import('../components/auth/AuthEmailSent.vue'),
    meta: { pageTitle: 'Authentication Email Sent' },
  },
  {
    path: '/administrator',
    name: 'Administrator',
    component: () => import('../pages/HomeAdministrator.vue'),
    meta: { pageTitle: 'Administrator', permission: Permissions.Administrators.UPDATE },
  },
  {
    path: '/administration/create',
    name: 'CreateAdministration',
    component: () => import('../components/CreateAdministration.vue'),
    meta: {
      pageTitle: 'Create an administration',
      permission: Permissions.Administrations.CREATE,
    },
  },
  {
    // TODO: Figure out a variable name other than mode
    path: '/administration/:mode/:adminId',
    name: 'EditAdministration',
    props: true,
    component: () => import('../components/CreateAdministration.vue'),
    meta: {
      pageTitle: 'Edit an Administration',
      permission: Permissions.Administrations.UPDATE,
    },
  },
  {
    path: '/administration/:mode/:adminId',
    name: 'DuplicateAdministration',
    props: true,
    component: () => import('../components/CreateAdministration.vue'),
    meta: {
      pageTitle: 'Duplicate an Administration',
      permission: Permissions.Administrations.CREATE,
    },
  },
  {
    path: '/create-administrator',
    name: 'CreateAdministrator',
    component: () => import('../components/CreateAdministrator.vue'),
    meta: {
      pageTitle: 'Create an administrator account',
      permission: Permissions.Administrators.CREATE,
    },
  },
  {
    path: APP_ROUTES.ORGS_CREATE,
    name: 'CreateOrgs',
    component: () => import('../components/CreateOrgs.vue'),
    meta: {
      pageTitle: 'Create an organization',
      permission: Permissions.Organizations.CREATE,
    },
  },
  {
    path: APP_ROUTES.ORGS_LIST,
    name: 'ListOrgs',
    component: () => import('../components/ListOrgs.vue'),
    meta: { pageTitle: 'List organizations', permission: Permissions.Organizations.LIST },
  },
  {
    path: '/list-users/:orgType/:orgId/:orgName',
    name: 'ListUsers',
    props: true,
    component: () => import('../components/ListUsers.vue'),
    meta: { pageTitle: 'List users', permission: Permissions.Users.LIST },
  },
  {
    path: '/administration/:administrationId/:orgType/:orgId',
    name: 'ProgressReport',
    props: true,
    component: () => import('../pages/ProgressReport.vue'),
    meta: {
      pageTitle: 'View Administration',
      permission: Permissions.Reports.Progress.READ,
    },
  },
  {
    path: APP_ROUTES.SCORE_REPORT,
    name: 'ScoreReport',
    props: true,
    component: () => import('../pages/ScoreReport.vue'),
    meta: { pageTitle: 'View Scores', permission: Permissions.Reports.Score.READ },
  },
  {
    path: APP_ROUTES.STUDENT_REPORT,
    name: 'StudentReport',
    props: true,
    component: () => import('../pages/StudentReport.vue'),
    meta: {
      pageTitle: 'Student Score Report',
      permission: Permissions.Reports.Student.READ,
    },
  },
  {
    path: APP_ROUTES.ACCOUNT_PROFILE,
    name: 'Profile',
    component: () => import('../pages/AdminProfile.vue'),
    children: [
      {
        path: '',
        name: 'ProfileInfo',
        component: () => import('../components/views/UserInfoView.vue'),
      },
      {
        path: 'password',
        name: 'ProfilePassword',
        component: () => import('../components/views/PasswordView.vue'),
        meta: { requireAdmin: true },
      },
      {
        path: 'accounts',
        name: 'ProfileAccounts',
        component: () => import('../components/views/LinkAccountsView.vue'),
        meta: { requireAdmin: true },
      },
    ],
    meta: { pageTitle: 'Profile', permission: Permissions.Profile.READ },
  },
  {
    path: '/enable-cookies',
    name: 'EnableCookies',
    component: () => import('../pages/EnableCookies.vue'),
    meta: { pageTitle: 'Enable Cookies' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../pages/NotFound.vue'),
    meta: { pageTitle: 'Whoops! 404 Page!' },
  },
  {
    path: '/unauthorized',
    name: 'Unauthorized',
    component: () => import('../pages/Unauthorized.vue'),
    meta: { pageTitle: 'Unauthorized' },
  },
  // LEVANTE
  // TODO: LEVANTE Needs to add permissions for their registerUser route.
  {
    path: '/register-users',
    name: 'Register Users',
    component: () => import('../pages/LEVANTE/RegisterUsers.vue'),
    meta: { pageTitle: 'Register Users', requireAdmin: true, project: 'LEVANTE' },
  },
  {
    path: '/survey',
    name: 'Survey',
    component: () => import('../pages/LEVANTE/UserSurvey.vue'),
    meta: { pageTitle: 'Survey', project: 'LEVANTE' },
  },
  {
    path: '/maintenance',
    name: 'Maintenance',
    component: () => import('../pages/MaintenancePage.vue'),
    meta: { pageTitle: 'Down for Maintenance' },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to) {
    const scroll = {};
    if (to.meta.toTop) scroll.top = 0;
    if (to.meta.smoothScroll) scroll.behavior = 'smooth';
    return scroll;
  },
});

router.beforeEach(async (to, from, next) => {
  const isLevante = import.meta.env.MODE === 'LEVANTE';
  // Don't allow routing to LEVANTE pages if not in LEVANTE instance
  if (!isLevante && to.meta?.project === 'LEVANTE') {
    next({ name: 'Home' });
    // next function can only be called once per route
    return;
  }

  const store = useAuthStore();
  const { userCan } = usePermissions();

  const allowedUnauthenticatedRoutes = [
    'SignIn',
    'Maintenance',
    'AuthClever',
    'AuthClassLink',
    'AuthEmailLink',
    'AuthEmailSent',
    'Register',
  ];

  const inMaintenanceMode = false;

  if (inMaintenanceMode && to.name !== 'Maintenance') {
    next({ name: 'Maintenance' });
    return;
  } else if (!inMaintenanceMode && to.name === 'Maintenance') {
    next({ name: 'Home' });
    return false;
  }
  // Check if user is signed in. If not, go to signin
  if (
    !to.path.includes('__/auth/handler') &&
    !store.isAuthenticated &&
    !allowedUnauthenticatedRoutes.includes(to.name)
  ) {
    next({ name: 'SignIn' });
    return;
  }

  // Prevent routing to routes that the user does not have permission to access.
  if (Object.keys(to?.meta).includes('permission') && !userCan(to.meta.permission)) {
    console.log('permissions', to.meta.permission);
    next({ name: 'Unauthorized' });
    return;
  }

  next();
  return;
});

export default router;
export { routes };
