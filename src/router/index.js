import { createRouter, createWebHistory } from "vue-router";
import { findById } from "@/helpers";
import store from "@/store";
const routes = [
  {
    path: "/",
    name: "Home",
    component: () => import(/* webpackChunkName: "Home" */ "@/pages/Home"),
  },
  {
    path: "/me",
    name: "Profile",
    component: () =>
      import(/* webpackChunkName: "Profile" */ "@/pages/Profile"),
    meta: { toTop: true, smoothScroll: true, requiresAuth: true },
  },
  {
    path: "/register",
    name: "Register",
    component: () =>
      import(/* webpackChunkName: "Register" */ "@/pages/Register"),
    meta: { requiresGuest: true },
  },
  {
    path: "/signin",
    name: "SignIn",
    component: () => import(/* webpackChunkName: "SignIn" */ "@/pages/SignIn"),
    meta: { requiresGuest: true },
  },
  {
    path: "/logout",
    name: "SignOut",
    async beforeEnter(to, from) {
      await store.dispatch("auth/signOut");
      return { name: "Home" };
    },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () =>
      import(/* webpackChunkName: "NotFound" */ "@/pages/NotFound"),
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
  store.dispatch("clearItems", {
    modules: ["categories", "forums", "posts", "threads"],
  });
});

router.beforeEach(async (to, from) => {
  await store.dispatch("auth/initAuthentication");
  store.dispatch("unsubscribeAllSnapshots");
  if (to.meta.requiresAuth && !store.state.auth.authId) {
    return { name: "SignIn", query: { redirectTo: to.path } };
  }
  if (to.meta.requiresGuest && store.state.auth.authId) {
    return { name: "Home" };
  }
});

export default router;
