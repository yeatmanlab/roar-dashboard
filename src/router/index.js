import { storeToRefs } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/store/auth";
import _get from "lodash/get";

function removeQueryParams(to) {
  if (Object.keys(to.query).length)
    return { path: to.path, query: {}, hash: to.hash }
}

function removeHash(to) {
  if (to.hash) return { path: to.path, query: to.query, hash: '' }
}

const routes = [
  {
    path: "/",
    name: "Home",
    component: () => import("../pages/Home.vue"),
    meta: { pageTitle: "Dashboard" },
  },
  {
    path: "/clever-user",
    name: "CleverLanding",
    component: () => import("../pages/CleverLanding.vue"),
    meta: { pageTitle: "Logging You In" },
  },
  // {
  //   path: "/game/:gameId",
  //   name: "PlayApp",
  //   component: () => import("../pages/PlayApp.vue"),
  //   meta: { pageTitle: "PlayApp" }
  // },
  {
    path: "/game/swr",
    name: "SWR",
    component: () => import("../components/tasks/SWR.vue"),
    meta: { pageTitle: "SWR" }
  },
  {
    path: "/game/swr-es",
    name: "SWR-ES",
    component: () => import("../components/tasks/SWR-ES.vue"),
    meta: { pageTitle: "SWR (ES)" }
  },
  {
    path: "/game/pa",
    name: "PA",
    component: () => import("../components/tasks/PA.vue"),
    meta: { pageTitle: "PA" }
  },
  {
    path: "/game/sre",
    name: "SRE",
    component: () => import("../components/tasks/SRE.vue"),
    meta: { pageTitle: "SRE" }
  },
  {
    path: "/game/letter",
    name: "Letter",
    component: () => import("../components/tasks/Letter.vue"),
    meta: { pageTitle: "Letter" }
  },
  {
    path: "/game/multichoice",
    name: "Multichoice",
    component: () => import("../components/tasks/Multichoice.vue"),
    meta: { pageTitle: "Multichoice" }
  },
  {
    path: "/register-game",
    name: "RegisterGame",
    component: () => import("../pages/RegisterGame.vue"),
    meta: { pageTitle: "Register Game", requireAdmin: true, requireSuperAdmin: true }
  },
  {
    path: "/upload-scores",
    name: "UploadScores",
    component: () => import("../pages/UploadFiles.vue"),
    meta: { pageTitle: "Upload Scores", requireAdmin: true, requireSuperAdmin: true },
  },
  {
    path: "/query",
    name: "Query",
    component: () => import("../pages/QueryPage.vue"),
    meta: { pageTitle: "Query", requireAdmin: true, requireSuperAdmin: true },
  },
  // {
  //   path: "/score-report",
  //   name: "ScoreReport",
  //   component: () => import("../pages/ScoreReport.vue"),
  //   meta: { pageTitle: "Score Reports" },
  // },
  // We don't support individual registration yet
  {
    path: "/register",
    name: "Register",
    component: () =>
      import("../pages/Register.vue"),
  },
  {
    path: '/register-students',
    name: 'RegisterStudents',
    component: () => import("../pages/RegisterStudents.vue"),
    meta: {pageTitle: "Register Students", requireAdmin: true, requireSuperAdmin: true}
  },
  {
    path: "/signin",
    name: "SignIn",
    component: () => import("../pages/SignIn.vue"),
    meta: { pageTitle: "Sign In" },
  },
  {
    path: "/signout",
    name: "SignOut",
    async beforeEnter(to, from) {
      const store = useAuthStore();
      if(store.isAuthenticated){
        await store.signOut();
      }
      return { name: "SignIn" };
    },
    meta: { pageTitle: "Sign Out" },
  },
  {
    path: "/auth-clever",
    name: "AuthClever",
    beforeRouteLeave: [removeQueryParams, removeHash],
    component: () => import("../components/auth/AuthClever.vue"),
    props: route => ({ code: route.query.code }),
    meta: { pageTitle: "Clever Authentication" },
  },
  {
    path: "/auth-email-link",
    name: "AuthEmailLink",
    beforeRouteLeave: [removeQueryParams, removeHash],
    component: () => import("../components/auth/AuthEmailLink.vue"),
    meta: { pageTitle: "Email Link Authentication" },
  },
  {
    path: "/auth-email-sent",
    name: "AuthEmailSent",
    component: () => import("../components/auth/AuthEmailSent.vue"),
    meta: { pageTitle: "Authentication Email Sent" },
  },
  {
    path: "/administrator",
    name: "Administrator",
    component: () => import("../pages/Administrator.vue"),
    meta: {pageTitle: "Administrator", requireAdmin: true}
  },
  {
    path: "/create-administration",
    name: "CreateAdministration",
    component: () => import("../components/CreateAdministration.vue"),
    meta: {pageTitle: "Create an administration", requireAdmin: true, requireSuperAdmin: true}
  },
  {
    path: "/create-administrator",
    name: "CreateAdministrator",
    component: () => import(/* webpackChunkName: "CreateAdministration" */ "../components/CreateAdministrator.vue"),
    meta: {pageTitle: "Create an administrator account", requireAdmin: true}
  },
  { 
    path: "/create-orgs",
    name: "CreateOrgs",
    component: () => import("../components/CreateOrgs.vue"),
    meta: {pageTitle: "Create an organization", requireAdmin: true, requireSuperAdmin: true}
  },
  { 
    path: "/list-orgs",
    name: "ListOrgs",
    component: () => import("../components/ListOrgs.vue"),
    meta: {pageTitle: "List organizations", requireAdmin: true}
  },
  { 
    path: "/list-users/:orgType/:orgId/:orgName",
    name: "ListUsers",
    props: true,
    component: () => import("../components/ListUsers.vue"),
    meta: {pageTitle: "List users", requireAdmin: true}
  },
  {
    path: "/administration/:administrationId/:orgType/:orgId",
    name: "ViewAdministration",
    props: true,
    component: () => import("../pages/AdministrationProgress.vue"),
    meta: {pageTitle: "View Administration", requireAdmin: true}
  },
  {
    path: "/scores/:administrationId/:orgType/:orgId",
    name: "ScoreReport",
    props: true,
    component: () => import("../pages/ScoreReport.vue"),
    meta: {pageTitle: "View Scores", requireAdmin: true}
  },
  {
    path: "/enable-cookies",
    name: "EnableCookies",
    component: () =>
      import("../pages/EnableCookies.vue"),
    meta: { pageTitle: "Enable Cookies" },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () =>
      import("../pages/NotFound.vue"),
    meta: { pageTitle: "Whoops! 404 Page!" },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to) {
    const scroll = {};
    if (to.meta.toTop) scroll.top = 0;
    if (to.meta.smoothScroll) scroll.behavior = "smooth";
    return scroll;
  },
});

router.beforeEach(async (to, from) => {
  const store = useAuthStore();

  const allowedUnauthenticatedRoutes = [
    "SignIn",
    "AuthClever",
    "AuthEmailLink",
    "AuthEmailSent",
  ];

  // Check if user is signed in. If not, go to signin
  if (!to.path.includes("__/auth/handler")
    && (!store.isAuthenticated && !allowedUnauthenticatedRoutes.includes(to.name))) {
    return { name: "SignIn" }
  }
  // Check if user is an admin. If not, prevent routing to page
  if (_get(to, 'meta.requireAdmin') && !store.isUserAdmin()) {
    return { name: "Home" }
  }

  // Check if user is a super admin. If not, prevent routing to page
  if (_get(to, 'meta.requireSuperAdmin') && !store.isUserSuperAdmin()) {
    return { name: "Home" }
  }
})

export default router;