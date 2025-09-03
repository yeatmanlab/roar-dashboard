import { NAVBAR_BLACKLIST } from '@/constants';
import { ROLES } from '@/constants/roles';
import { APP_ROUTES } from '@/constants/routes';
import { logger } from '@/logger';
import { useAuthStore } from '@/store/auth';
import { pageTitlesCO, pageTitlesES, pageTitlesUS } from '@/translations/exports';
import { Role } from '@/types';
import {
  createRouter,
  createWebHistory,
  NavigationGuardNext,
  RouteLocationNormalized,
  RouteRecordRaw,
  RouterScrollBehavior,
} from 'vue-router';

function removeQueryParams(to: RouteLocationNormalized) {
  if (Object.keys(to.query).length) return { path: to.path, query: {}, hash: to.hash };
}

function removeHash(to: RouteLocationNormalized) {
  if (to.hash) return { path: to.path, query: to.query, hash: '' };
}

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../pages/HomeSelector.vue'),
    meta: {
      pageTitle: {
        'en-US': pageTitlesUS['home'],
        es: pageTitlesES['home'],
        'es-CO': pageTitlesCO['home'],
      },
      allowedRoles: [],
    },
  },
  {
    path: '/debug',
    name: 'Debug',
    component: () => import('../pages/Debug.vue'),
    meta: {
      pageTitle: 'Debug Information',
      allowedRoles: [],
    },
  },
  {
    path: '/game/swr',
    name: 'SWR',
    component: () => import('../components/tasks/TaskSWR.vue'),
    props: { taskId: 'swr' },
    meta: {
      pageTitle: 'SWR',
      allowedRoles: [],
    },
  },
  {
    path: '/game/pa',
    name: 'PA',
    component: () => import('../components/tasks/TaskPA.vue'),
    props: { taskId: 'pa' },
    meta: {
      pageTitle: 'PA',
      allowedRoles: [],
    },
  },
  {
    path: '/game/sre',
    name: 'SRE',
    component: () => import('../components/tasks/TaskSRE.vue'),
    props: { taskId: 'sre' },
    meta: {
      pageTitle: 'SRE',
      allowedRoles: [],
    },
  },
  {
    path: '/game/core-tasks/:taskId',
    name: 'Core Tasks',
    component: () => import('../components/tasks/TaskLevante.vue'),
    props: true,
    // Add which specific task?
    // Code in App.vue overwrites updating it programmatically
    meta: {
      pageTitle: 'Core Tasks',
      allowedRoles: [],
    },
  },
  {
    path: '/manage-tasks-variants',
    name: 'ManageTasksVariants',
    component: () => import('../pages/ManageTasksVariants.vue'),
    meta: {
      pageTitle: 'Manage Tasks',
      allowedRoles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SITE_ADMIN],
    },
  },
  {
    path: APP_ROUTES.SIGN_IN,
    name: 'SignIn',
    component: () => import('../pages/SignIn.vue'),
    meta: {
      pageTitle: {
        'en-US': pageTitlesUS['signIn'],
        es: pageTitlesES['signIn'],
        'es-CO': pageTitlesCO['signIn'],
      },
      allowedRoles: [],
    },
  },
  {
    path: '/auth-email-link',
    name: 'AuthEmailLink',
    beforeRouteLeave: [removeQueryParams, removeHash],
    component: () => import('../components/auth/AuthEmailLink.vue'),
    meta: {
      pageTitle: 'Email Link Authentication',
      allowedRoles: [],
    },
  },
  {
    path: '/auth-email-sent',
    name: 'AuthEmailSent',
    component: () => import('../components/auth/AuthEmailSent.vue'),
    meta: {
      pageTitle: 'Authentication Email Sent',
      allowedRoles: [],
    },
  },
  {
    path: '/administrator',
    name: 'Administrator',
    component: () => import('../pages/HomeAdministrator.vue'),
    meta: {
      pageTitle: 'Administrator',
      allowedRoles: [ROLES.ADMIN, ROLES.SITE_ADMIN],
    },
  },
  {
    path: '/create-assignment',
    name: 'CreateAssignment',
    component: () => import('../pages/CreateAssignment.vue'),
    meta: {
      pageTitle: 'Create Assignment',
      allowedRoles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SITE_ADMIN],
    },
  },
  {
    path: '/edit-assignment/:adminId',
    name: 'EditAssignment',
    props: true,
    component: () => import('../pages/CreateAssignment.vue'),
    meta: {
      pageTitle: 'Edit an Assignment',
      allowedRoles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SITE_ADMIN],
    },
  },
  {
    path: '/create-administrator',
    name: 'CreateAdministrator',
    component: () => import('../pages/CreateAdministrator.vue'),
    meta: {
      pageTitle: 'Create an administrator account',
      allowedRoles: [ROLES.ADMIN, ROLES.SITE_ADMIN],
    },
  },
  {
    path: '/list-groups',
    name: 'ListGroups',
    component: () => import('../pages/groups/ListGroups.vue'),
    meta: {
      pageTitle: 'Groups',
      allowedRoles: [ROLES.ADMIN, ROLES.SITE_ADMIN],
    },
  },
  {
    path: '/list-users/:orgType/:orgId/:orgName',
    name: 'ListUsers',
    props: true,
    component: () => import('../pages/users/ListUsers.vue'),
    meta: {
      pageTitle: 'List users',
      allowedRoles: [ROLES.ADMIN, ROLES.SITE_ADMIN],
    },
  },
  {
    path: '/administration/:administrationId/:orgType/:orgId',
    name: 'ProgressReport',
    props: true,
    component: () => import('../pages/ProgressReport.vue'),
    meta: {
      pageTitle: 'View Administration',
      allowedRoles: [ROLES.ADMIN, ROLES.SITE_ADMIN],
    },
  },
  {
    path: APP_ROUTES.ACCOUNT_PROFILE,
    name: 'Profile',
    component: () => import('../pages/AdminProfile.vue'),
    children: [
      {
        path: 'accounts',
        name: 'ProfileAccounts',
        component: () => import('../components/adminSettings/LinkAccountsView.vue'),
        meta: {
          allowedRoles: [ROLES.ADMIN, ROLES.SITE_ADMIN],
        },
      },
      {
        path: 'settings',
        name: 'ProfileSettings',
        component: () => import('../components/adminSettings/Settings.vue'),
        meta: {
          allowedRoles: [],
        },
      },
    ],
    meta: {
      pageTitle: 'Profile',
      allowedRoles: [],
    },
  },
  {
    path: '/enable-cookies',
    name: 'EnableCookies',
    component: () => import('../pages/EnableCookies.vue'),
    meta: {
      pageTitle: 'Enable Cookies',
      allowedRoles: [],
    },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../pages/NotFound.vue'),
    meta: {
      pageTitle: 'Whoops! 404 Page!',
      allowedRoles: [],
    },
  },
  {
    path: '/add-users',
    name: 'Add Users',
    component: () => import('../pages/users/AddUsers.vue'),
    meta: {
      pageTitle: 'Add Users',
      allowedRoles: [ROLES.ADMIN, ROLES.SITE_ADMIN],
    },
  },

  {
    path: '/link-users',
    name: 'Link Users',
    component: () => import('../pages/users/LinkUsers.vue'),
    meta: {
      pageTitle: 'Link Users',
      allowedRoles: [ROLES.ADMIN, ROLES.SITE_ADMIN],
    },
  },
  // {
  //   path: '/edit-users',
  //   name: 'Edit Users',
  //   component: () => import('../pages/users/EditUsers.vue'),
  //   meta: { allowedRoles: [],  pageTitle: 'Edit Users', requireAdmin: true, project: 'LEVANTE' },
  // },
  {
    path: '/survey',
    name: 'Survey',
    component: () => import('../pages/UserSurvey.vue'),
    meta: {
      pageTitle: 'Survey',
      allowedRoles: [],
    },
  },
  {
    path: '/maintenance',
    name: 'Maintenance',
    component: () => import('../pages/MaintenancePage.vue'),
    meta: {
      pageTitle: 'Down for Maintenance',
      allowedRoles: [],
    },
  },
];

const scrollBehavior: RouterScrollBehavior = (to, from, savedPosition) => {
  if (savedPosition) {
    return savedPosition;
  } else if (to.hash) {
    return {
      el: to.hash,
      behavior: 'smooth',
    };
  } else {
    return { left: 0, top: 0 };
  }
};

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior,
});

router.beforeEach(async (to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) => {
  const authStore = useAuthStore();
  const allowedUnauthenticatedRoutes = ['AuthEmailLink', 'AuthEmailSent', 'Debug', 'Maintenance', 'SignIn'];
  const inMaintenanceMode = false;

  if (NAVBAR_BLACKLIST.includes(to.name)) {
    authStore.setShowSideBar(false);
  }

  if (inMaintenanceMode && to.name !== 'Maintenance') {
    return next({ name: 'Maintenance' });
  } else if (!inMaintenanceMode && to.name === 'Maintenance') {
    return next({ name: 'Home' });
  }

  // Check if user is signed in. If not, go to signin
  if (
    !to.path.includes('__/auth/handler') &&
    !authStore.isAuthenticated &&
    !allowedUnauthenticatedRoutes.includes(to.name)
  ) {
    return next({ name: 'SignIn' });
  }

  // @TODO
  // If we're gonna keep this solution,
  // we need to think about setting up a max num of tries and an error handler.
  if (!authStore.userData && !allowedUnauthenticatedRoutes.includes(to.name)) {
    await new Promise<void>((resolve) => {
      const checkUserData = () => {
        if (authStore.userData) return resolve();
        setTimeout(checkUserData, 50);
      };

      checkUserData();
    });
  }

  const allowedRoles = to.meta.allowedRoles;
  const userRoles = authStore.userData?.roles?.map((role: Role) => role.role) || [ROLES.PARTICIPANT];
  const isUserAllowed = allowedRoles.some((allowedRole: string) => userRoles.includes(allowedRole));

  if (allowedRoles.length && !isUserAllowed) {
    return next({ name: 'Home' });
  }

  return next();
});

// PostHog pageview tracking
router.afterEach((to, from) => {
  logger.capture('pageview', { to, from });
});

export default router;
