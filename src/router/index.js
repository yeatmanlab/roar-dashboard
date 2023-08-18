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
    path: "/upload-scores",
    name: "UploadScores",
    component: () => import("../pages/UploadFiles.vue"),
    meta: { pageTitle: "Upload Scores", requireAdmin: true },
  },
  {
    path: "/query",
    name: "Query",
    component: () => import("../pages/QueryPage.vue"),
    meta: { pageTitle: "Query", requireAdmin: true },
  },
  {
    path: "/score-report",
    name: "ScoreReport",
    component: () => import("../pages/ScoreReport.vue"),
    meta: { pageTitle: "Score Reports" },
  },
  // We don't support individual registration yet
  {
    path: "/register",
    name: "Register",
    component: () =>
      import("../pages/Register.vue"),
  },
  {
    path: '/mass-upload',
    name: 'MassUploader',
    component: () => import("../pages/MassUploader.vue"),
    meta: {pageTitle: "Register Students", requireAdmin: true}
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
    path: "/administrator",
    name: "Administrator",
    component: () => import(/* webpackChunkName: "Administrator" */ "../pages/Administrator.vue"),
    meta: {pageTitle: "Administrator", requireAdmin: true}
  },
  {
    path: "/create-admin",
    name: "CreateAdministration",
    component: () => import(/* webpackChunkName: "CreateAdministration" */ "../components/CreateAdministration.vue"),
    meta: {pageTitle: "Create an administration", requireAdmin: true}
  },
  { 
    path: "/create-orgs",
    name: "CreateOrgs",
    component: () => import(/* webpackChunkName: "CreateAdministration" */ "../components/CreateOrgs.vue"),
    meta: {pageTitle: "Create organizations", requireAdmin: true}
  },
  { 
    path: "/list-orgs",
    name: "ListOrgs",
    component: () => import(/* webpackChunkName: "CreateAdministration" */ "../components/ListOrgs.vue"),
    meta: {pageTitle: "List organizations", requireAdmin: true}
  },
  {
    path: "/administration/:id",
    name: "ViewAdministration",
    component: () => import(/* webpackChunkName: "CreateAdministration" */ "../pages/Administration.vue"),
    meta: {pageTitle: "View Administration", requireAdmin: true}
  },

  {
    path: "/administration/:id",
    name: "ViewAdministration",
    component: () => import(/* webpackChunkName: "CreateAdministration" */ "../pages/Administration.vue"),
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
  // Check if user is signed in. If not, go to signin
  if (!to.path.includes("__/auth/handler")
    && (!store.isAuthenticated && to.name !== "SignIn" && to.name !== "AuthClever")) {
    return { name: "SignIn" }
  }
  // Check if user is an admin. If not, prevent routing to page
  if (_get(to, 'meta.requireAdmin') && !store.isUserAdmin()) {
    return { name: "Home" }
  }
})

export default router;