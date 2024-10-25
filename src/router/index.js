import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import { useSurveyStore } from '@/store/survey';
import _get from 'lodash/get';
import { pageTitlesEN, pageTitlesUS, pageTitlesES, pageTitlesCO } from '@/translations/exports';
import { isLevante } from '@/helpers';
import { APP_ROUTES } from '@/constants/routes';

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
    path: '/game/swr-de',
    name: 'SWR-DE',
    component: () => import('../components/tasks/TaskSWR.vue'),
    props: { taskId: 'swr-de', language: 'de' },
    meta: { pageTitle: 'SWR (DE)' },
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
    path: '/game/pa-de',
    name: 'PA-DE',
    component: () => import('../components/tasks/TaskPA.vue'),
    props: { taskId: 'pa-de', language: 'de' },
    meta: { pageTitle: 'PA-DE' },
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
    path: '/game/sre-de',
    name: 'SRE-DE',
    component: () => import('../components/tasks/TaskSRE.vue'),
    props: { taskId: 'sre-de', language: 'de' },
    meta: { pageTitle: 'SRE-DE' },
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
    path: '/game/fluency-alpaca',
    name: 'Fluency-Alpaca',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: { taskId: 'fluency-alpaca', language: 'en' },
    meta: { pageTitle: 'ROAM-Alpaca' },
  },
  {
    path: '/game/fluency-alpaca-es',
    name: 'Fluency-Alpaca-ES',
    component: () => import('../components/tasks/TaskRoam.vue'),
    props: { taskId: 'fluency-alpaca-es', language: 'es' },
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
    path: '/manage-tasks-variants',
    name: 'ManageTasksVariants',
    component: () => import('../pages/ManageTasksVariants.vue'),
    meta: { pageTitle: 'Manage Tasks', requireAdmin: true, requireSuperAdmin: true },
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
        component: () => import('../components/auth/RegisterStudent.vue'),
      },
    ],
    meta: { requiresGuest: true },
  },
  {
    path: '/register-students',
    name: 'RegisterStudents',
    component: () => import('../pages/RegisterStudents.vue'),
    meta: { pageTitle: 'Register Students', requireAdmin: true, requireSuperAdmin: true },
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
    meta: { pageTitle: 'Administrator', requireAdmin: true },
  },
  {
    path: '/create-administration',
    name: 'CreateAdministration',
    component: () => import('../components/CreateAdministration.vue'),
    meta: { pageTitle: 'Create an administration', requireAdmin: true, requireSuperAdmin: true },
  },
  {
    path: '/edit-administration/:adminId',
    name: 'EditAdministration',
    props: true,
    component: () => import('../components/CreateAdministration.vue'),
    meta: { pageTitle: 'Edit an Administration', requireAdmin: true, requireSuperAdmin: true },
  },
  {
    path: '/create-administrator',
    name: 'CreateAdministrator',
    component: () => import('../components/CreateAdministrator.vue'),
    meta: { pageTitle: 'Create an administrator account', requireAdmin: true },
  },
  {
    path: '/create-orgs',
    name: 'CreateOrgs',
    component: () => import('../components/CreateOrgs.vue'),
    meta: { pageTitle: 'Create an organization', requireAdmin: true, requireSuperAdmin: true },
  },
  {
    path: '/list-orgs',
    name: 'ListOrgs',
    component: () => import('../components/ListOrgs.vue'),
    meta: { pageTitle: 'List organizations', requireAdmin: true },
  },
  {
    path: '/list-users/:orgType/:orgId/:orgName',
    name: 'ListUsers',
    props: true,
    component: () => import('../components/ListUsers.vue'),
    meta: { pageTitle: 'List users', requireAdmin: true },
  },
  {
    path: '/administration/:administrationId/:orgType/:orgId',
    name: 'ProgressReport',
    props: true,
    component: () => import('../pages/ProgressReport.vue'),
    meta: { pageTitle: 'View Administration', requireAdmin: true },
  },
  {
    path: APP_ROUTES.SCORE_REPORT,
    name: 'ScoreReport',
    props: true,
    component: () => import('../pages/ScoreReport.vue'),
    meta: { pageTitle: 'View Scores', requireAdmin: true },
  },
  {
    path: APP_ROUTES.STUDENT_REPORT,
    name: 'StudentReport',
    props: true,
    component: () => import('../pages/StudentReport.vue'),
    meta: { pageTitle: 'Student Score Report', requireAdmin: true },
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
      {
        path: 'settings',
        name: 'ProfileSettings',
        component: () => import('../components/views/Settings.vue'),
      },
    ],
    meta: { pageTitle: 'Profile' },
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
  // LEVANTE
  {
    path: '/register-users',
    name: 'Register Users',
    component: () => import('../pages/LEVANTE/RegisterUsers.vue'),
    meta: { pageTitle: 'Register Users', requireAdmin: true, project: 'LEVANTE' },
  },
  {
    path: '/link-users',
    name: 'Link Users',
    component: () => import('../pages/LEVANTE/LinkUsers.vue'),
    meta: { pageTitle: 'Link Users', requireAdmin: true, project: 'LEVANTE' },
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
  // Don't allow routing to LEVANTE pages if not in LEVANTE instance
  if (!isLevante && to.meta?.project === 'LEVANTE') {
    next({ name: 'Home' });
    // next function can only be called once per route
    return;
  }

  const store = useAuthStore();

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

  // Check if the route requires admin rights and the user is an admin.
  const requiresAdmin = _get(to, 'meta.requireAdmin', false);
  const requiresSuperAdmin = _get(to, 'meta.requireSuperAdmin', false);

  // Check user roles
  const isUserAdmin = store.isUserAdmin;
  const isUserSuperAdmin = store.isUserSuperAdmin;

  // All current conditions:
  // 1. Super Admin: true, Admin: true
  // 2. Super Admin: false, Admin: true (Only exits because requiresSuperAdmin is not defined on every route)
  // 3. Super Admin: false, Admin: false (Allowed routes for all users)
  // (Also exists because requiresAdmin/requiresSuperAdmin is not defined on every route)

  if (isUserSuperAdmin) {
    next();
    return;
  } else if (isUserAdmin) {
    // LEVANTE dashboard has opened some pages to administrators before the ROAR dashboard
    // So if isLevante, then allow regular admins to access any route with requireAdmin = true.
    // and if ROAR, then prohibit regular admins from accessing any route with requireSuperAdmin = true.
    if (isLevante && requiresAdmin) {
      next();
      return;
    } else if (requiresSuperAdmin) {
      next({ name: 'Home' });
      return;
    }
    next();
    return;
  }

  // If we get here, the user is a regular user
  if (requiresSuperAdmin || requiresAdmin) {
    next({ name: 'Home' });
    return;
  }

  next();
  return;
});

export default router;
