import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { pageTitlesEN, pageTitlesUS, pageTitlesES, pageTitlesCO } from '@/translations/exports';
import { APP_ROUTES } from '@/constants/routes';
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
    path: '/game/swr',
    name: 'SWR',
    component: () => import('../components/tasks/TaskSWR.vue'),
    props: { taskId: 'swr', language: 'en' },
    meta: { pageTitle: 'SWR' },
  },
  {
    path: '/game/swr-es',
    name: 'SWR-ES',
    component: () => import('../components/tasks/TaskSWR.vue'),
    props: { taskId: 'swr-es', language: 'es' },
    meta: { pageTitle: 'SWR (ES)' },
  },
  {
    path: '/game/pa',
    name: 'PA',
    component: () => import('../components/tasks/TaskPA.vue'),
    props: { taskId: 'pa', language: 'en' },
    meta: { pageTitle: 'PA' },
  },
  {
    path: '/game/pa-es',
    name: 'PA-ES',
    component: () => import('../components/tasks/TaskPA.vue'),
    props: { taskId: 'pa-es', language: 'es' },
    meta: { pageTitle: 'PA-ES' },
  },
  {
    path: '/game/sre',
    name: 'SRE',
    component: () => import('../components/tasks/TaskSRE.vue'),
    props: { taskId: 'sre', language: 'en' },
    meta: { pageTitle: 'SRE' },
  },
  {
    path: '/game/sre-es',
    name: 'SRE-ES',
    component: () => import('../components/tasks/TaskSRE.vue'),
    props: { taskId: 'sre-es', language: 'es' },
    meta: { pageTitle: 'SRE-ES' },
  },
  {
    path: '/game/letter',
    name: 'Letter',
    component: () => import('../components/tasks/TaskLetter.vue'),
    props: { taskId: 'letter', language: 'en' },
    meta: { pageTitle: 'Letter' },
  },
  {
    path: '/game/letter-es',
    name: 'Letter-ES',
    component: () => import('../components/tasks/TaskLetter.vue'),
    props: { taskId: 'letter-es', language: 'es' },
    meta: { pageTitle: 'Letter-ES' },
  },
  {
    path: '/game/letter-en-ca',
    name: 'Letter-EN-CA',
    component: () => import('../components/tasks/TaskLetter.vue'),
    props: { taskId: 'letter-en-ca', language: 'en-CA' },
    meta: { pageTitle: 'Letter-EN-CA' },
  },
  {
    path: '/game/phonics',
    name: 'Phonics',
    component: () => import('../components/tasks/TaskLetter.vue'),
    props: { taskId: 'phonics', language: 'en' },
    meta: { pageTitle: 'Phonics' },
  },
  {
    path: '/game/multichoice',
    name: 'Multichoice',
    component: () => import('../components/tasks/TaskMultichoice.vue'),
    props: { taskId: 'multichoice', language: 'en' },
    meta: { pageTitle: 'Multichoice' },
  },
  {
    path: '/game/morphology',
    name: 'Morphology',
    component: () => import('../components/tasks/TaskMultichoice.vue'),
    props: { taskId: 'morphology', language: 'en' },
    meta: { pageTitle: 'Morphology' },
  },
  {
    path: '/game/cva',
    name: 'Cva',
    component: () => import('../components/tasks/TaskMultichoice.vue'),
    props: { taskId: 'cva', language: 'en' },
    meta: { pageTitle: 'CVA' },
  },
  {
    path: '/game/vocab',
    name: 'Vocab',
    component: () => import('../components/tasks/TaskVocab.vue'),
    props: { taskId: 'vocab', language: 'en' },
    meta: { pageTitle: 'Vocab' },
  },
  {
    path: '/game/fluency-arf',
    name: 'Fluency-ARF',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: { taskId: 'fluency-arf', language: 'en' },
    meta: { pageTitle: 'ROAM-ARF' },
  },
  {
    path: '/game/fluency-arf-es',
    name: 'Fluency-ARF-ES',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: { taskId: 'fluency-arf-es', language: 'es' },
    meta: { pageTitle: 'ROAM-ARF ES' },
  },
  {
    path: '/game/fluency-calf',
    name: 'Fluency-CALF',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: { taskId: 'fluency-calf', language: 'en' },
    meta: { pageTitle: 'ROAM-CALF' },
  },
  {
    path: '/game/fluency-calf-es',
    name: 'Fluency-CALF-ES',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: { taskId: 'fluency-calf-es', language: 'es' },
    meta: { pageTitle: 'ROAM-CALF ES' },
  },
  {
    path: '/game/roam-alpaca',
    name: 'Fluency-Alpaca',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: { taskId: 'roam-alpaca', language: 'en' },
    meta: { pageTitle: 'ROAM-Alpaca' },
  },
  {
    path: '/game/roam-alpaca-es',
    name: 'Fluency-Alpaca-ES',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: { taskId: 'roam-alpaca-es', language: 'es' },
    meta: { pageTitle: 'ROAM-Alpaca ES' },
  },
  {
    path: '/game/core-tasks/:taskId',
    name: 'Core Tasks',
    component: () => import('../components/tasks/TaskLevante.vue'),
    props: true,
    // Add which specific task?
    // Code in App.vue overwrites updating it programmatically
    meta: { pageTitle: 'Core Tasks' },
  },
  {
    path: '/game/ran',
    name: 'RAN',
    component: () => import('../components/tasks/TaskRan.vue'),
    props: { taskId: 'ran', language: 'en' },
    meta: { pageTitle: 'RAN' },
  },
  {
    path: '/game/crowding',
    name: 'Crowding',
    component: () => import('../components/tasks/TaskCrowding.vue'),
    props: { taskId: 'crowding', language: 'en' },
    meta: { pageTitle: 'Crowding' },
  },
  {
    path: '/game/roav-mep',
    name: 'MEP',
    component: () => import('../components/tasks/TaskMEP.vue'),
    props: { taskId: 'roav-mep', language: 'en' },
    meta: { pageTitle: 'MEP' },
  },
  {
    path: '/launch/:participantId',
    name: 'LaunchHome',
    component: () => import('../pages/LaunchedHomeParticipant.vue'),
    props: true,
    meta: { pageTitle: 'TaskLauncher Home' },
  },
  {
    path: '/launch/:launchId/game/swr',
    name: 'Launch SWR',
    component: () => import('../components/tasks/TaskSWR.vue'),
    props: true,
    meta: { pageTitle: 'SWR' },
  },
  {
    path: '/launch/:launchId/game/pa',
    name: 'Launch PA',
    component: () => import('../components/tasks/TaskPA.vue'),
    props: true,
    meta: { pageTitle: 'PA' },
  },
  {
    path: '/launch/:launchId/game/sre',
    name: 'Launch SRE',
    component: () => import('../components/tasks/TaskSRE.vue'),
    props: true,
    meta: { pageTitle: 'SRE' },
  },
  {
    path: '/launch/:launchId/game/letter',
    name: 'Launch Letter',
    component: () => import('../components/tasks/TaskLetter.vue'),
    props: true,
    meta: { pageTitle: 'Letter' },
  },
  {
    path: '/launch/:participantId/game/cva',
    name: 'Launch Cva',
    component: () => import('../components/tasks/TaskMultichoice.vue'),
    props: { taskId: 'cva', language: 'en' },
    meta: { pageTitle: 'CVA' },
  },
  {
    path: '/launch/:participantId/game/vocab',
    name: 'Launch Vocab',
    component: () => import('../components/tasks/TaskVocab.vue'),
    props: { taskId: 'vocab', language: 'en' },
    meta: { pageTitle: 'Vocab' },
  },
  {
    path: '/launch/:participantId/game/fluency-arf',
    name: 'Launch Fluency-ARF',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: { taskId: 'fluency-arf', language: 'en' },
    meta: { pageTitle: 'ROAM-ARF' },
  },
  {
    path: '/launch/:participantId/game/fluency-arf-es',
    name: 'Launch Fluency-ARF-ES',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: { taskId: 'fluency-arf-es', language: 'es' },
    meta: { pageTitle: 'ROAM-ARF ES' },
  },
  {
    path: '/launch/:participantId/game/fluency-calf',
    name: 'Launch Fluency-CALF',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: { taskId: 'fluency-calf', language: 'en' },
    meta: { pageTitle: 'ROAM-CALF' },
  },
  {
    path: '/launch/:participantId/game/roam-alpaca',
    name: 'Launch Fluency-Alpaca',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: { taskId: 'roam-alpaca', language: 'en' },
    meta: { pageTitle: 'ROAM-Alpaca' },
  },
  {
    path: '/launch/:participantId/game/roam-alpaca-es',
    name: 'Launch Fluency-Alpaca-ES',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: { taskId: 'roam-alpaca-es', language: 'es' },
    meta: { pageTitle: 'ROAM-Alpaca ES' },
  },
  {
    path: '/launch/:participantId/game/core-tasks/:taskId',
    name: 'Launch Core Tasks',
    component: () => import('../components/tasks/TaskLevante.vue'),
    props: true,
    // Add which specific task?
    // Code in App.vue overwrites updating it programmatically
    meta: { pageTitle: 'Core Tasks' },
  },
  {
    path: '/launch/:participantId/game/ran',
    name: 'RAN',
    component: () => import('../components/tasks/TaskRan.vue'),
    props: { taskId: 'ran', language: 'en' },
    meta: { pageTitle: 'RAN' },
  },
  {
    path: '/launch/:participantId/game/crowding',
    name: 'Crowding',
    component: () => import('../components/tasks/TaskCrowding.vue'),
    props: { taskId: 'crowding', language: 'en' },
    meta: { pageTitle: 'Crowding' },
  },
  {
    path: '/launch/:participantId/game/roav-mep',
    name: 'MEP',
    component: () => import('../components/tasks/TaskMEP.vue'),
    props: { taskId: 'roav-mep', language: 'en' },
    meta: { pageTitle: 'MEP' },
  },
  {
    path: '/manage-tasks-variants',
    name: 'ManageTasksVariants',
    component: () => import('../pages/ManageTasksVariants.vue'),
    meta: {
      pageTitle: 'Manage Tasks',
      permission: Permissions.Tasks.MANAGE,
    },
  },
  {
    path: '/register',
    name: 'Register',
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
    path: '/create-administration',
    name: 'CreateAdministration',
    component: () => import('../components/CreateAdministration.vue'),
    meta: {
      pageTitle: 'Create an administration',
      permission: Permissions.Administrations.CREATE,
    },
  },
  {
    path: '/edit-administration/:adminId',
    name: 'EditAdministration',
    props: true,
    component: () => import('../components/CreateAdministration.vue'),
    meta: {
      pageTitle: 'Edit an Administration',
      permission: Permissions.Administrations.UPDATE,
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
    path: '/create-orgs',
    name: 'CreateOrgs',
    component: () => import('../components/CreateOrgs.vue'),
    meta: {
      pageTitle: 'Create an organization',
      permission: Permissions.Organizations.CREATE,
    },
  },
  {
    path: '/list-orgs',
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
    'SSO', //@TODO: Remove before merging
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

  const routePermission = to?.meta?.permission ?? null;
  if (routePermission) {
    const hasPermission = userCan(routePermission);
    if (hasPermission) {
      next();
      return;
    } else {
      next({ name: 'Unauthorized' });
      return;
    }
  }

  next();
  return;
});

export default router;
export { routes };
