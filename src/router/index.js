import { createRouter, createWebHistory } from "vue-router";
import { findById } from "@/helpers";
import { useAuthStore } from "@/store/auth";

const routes = [
  {
    path: "/",
    name: "Home",
    component: () => import(/* webpackChunkName: "Home" */ "../pages/Home.vue"),
  },
  // {
  //   path: "/me",
  //   name: "Profile",
  //   component: () =>
  //     import(/* webpackChunkName: "Profile" */ "../pages/Profile.vue"),
  //   meta: { toTop: true, smoothScroll: true, requiresAuth: true },
  // },
  {
    path: "/query",
    name: "Query",
    component: () => import(/* webpackChunkName: "Home" */ "../pages/QueryPage.vue"),
  },
  {
    path: "/score-report",
    name: "ScoreReport",
    component: () => import(/* webpackChunkName: "Home" */ "../pages/ScoreReport.vue"),
  },
  {
    path: "/register",
    name: "Register",
    component: () =>
      import(/* webpackChunkName: "Register" */ "../pages/SignInOrRegister.vue"),
    meta: { requiresGuest: true },
  },
  {
    path: "/signin",
    name: "SignIn",
    component: () => import(/* webpackChunkName: "SignIn" */ "../pages/SignInOrRegister.vue"),
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
    path: "/enable-cookies",
    name: "EnableCookies",
    component: () =>
      import(/* webpackChunkName: "Register" */ "../pages/EnableCookies.vue"),
    meta: { requiresGuest: true },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () =>
      import(/* webpackChunkName: "NotFound" */ "../pages/NotFound.vue"),
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
