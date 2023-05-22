import { createRouter, createWebHistory } from "vue-router";
import { findById } from "@/helpers";
import { useAuthStore } from "@/store/auth";

const routes = [
  {
    path: "/",
    name: "Home",
    component: () => import("../pages/Home.vue"),
  },
  {
    path: "/upload-scores",
    name: "UploadScores",
    component: () => import("../pages/UploadFiles.vue"),
  },
  {
    path: "/query",
    name: "Query",
    component: () => import("../pages/QueryPage.vue"),
  },
  {
    path: "/score-report",
    name: "ScoreReport",
    component: () => import("../pages/ScoreReport.vue"),
  },
  {
    path: "/register",
    name: "Register",
    component: () =>
      import("../pages/SignInOrRegister.vue"),
    meta: { requiresGuest: true },
  },
  {
    path: "/signin",
    name: "SignIn",
    component: () => import("../pages/SignInOrRegister.vue"),
    meta: { requiresGuest: true },
  },
  {
    path: "/logout",
    name: "SignOut",
    async beforeEnter(to, from) {
      const store = useAuthStore();
      await store.signOut();
      return { name: "SignIn" };
    },
  },
  {
    path: "/participant",
    name: "Participant",
    component: () => import(/* webpackChunkName: "Participant" */ "../pages/Participant.vue"),
  },
  {
    path: "/administrator",
    name: "Administrator",
    component: () => import(/* webpackChunkName: "Administrator" */ "../pages/Administrator.vue"),
  },
  {
    path: "/enable-cookies",
    name: "EnableCookies",
    component: () =>
      import("../pages/EnableCookies.vue"),
    meta: { requiresGuest: true },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () =>
      import("../pages/NotFound.vue"),
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

router.afterEach(() => {
  // const store = useAuthStore();
  // store.dispatch("clearItems", {
  //   modules: ["categories", "forums", "posts", "threads"],
  // });
});

router.beforeEach(async (to, from) => {
  const store = useAuthStore();
  // await store.dispatch("auth/initAuthentication");
  // store.dispatch("unsubscribeAllSnapshots");
  if (to.meta.requiresAuth && !store.isAuthenticated) {
    return { name: "SignIn", query: { redirectTo: to.path } };
  }
  if (to.meta.requiresGuest && store.isAuthenticated) {
    return { name: "Home" };
  }
});

export default router;
