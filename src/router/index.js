import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/store/auth";

const routes = [
  {
    path: "/",
    name: "Home",
    component: () => {
      const authStore = useAuthStore();
      const userType = authStore.userData?.userType;
      if (userType === "admin") return import("../pages/Participant.vue"); // TODO: THIS NEEDS TO BE CHANGED TO ADMIN VIEW BEFORE RELEASE.
      else if (userType === "educator") return import("../pages/Home.vue");
      else if (userType === "student") return import("../pages/Participant.vue");
      else if (userType === "caregiver") return import("../pages/Home.vue");
      else if (userType === "guest") return import("../pages/Home.vue");
      else return import("../pages/Home.vue");
    },
    meta: { pageTitle: "Dashboard" },

  },
  {
    path: "/game/:gameId",
    name: "PlayApp",
    component: () => import("../pages/PlayApp.vue"),
    meta: { pageTitle: "PlayApp" }
  },
  {
    path: "/upload-scores",
    name: "UploadScores",
    component: () => import("../pages/UploadFiles.vue"),
    meta: { pageTitle: "Upload Scores" },
  },
  {
    path: "/query",
    name: "Query",
    component: () => import("../pages/QueryPage.vue"),
    meta: { pageTitle: "Query" },
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
    meta: { requiresGuest: true },
  },
  {
    path: '/mass-upload',
    name: 'MassUploader',
    component: () => import("../pages/MassUploader.vue")
  },
  {
    path: "/signin",
    name: "SignIn",
    component: () => import("../pages/SignIn.vue"),
    meta: { requiresGuest: true, pageTitle: "Sign In" },
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
    component: () => import("../components/auth/AuthClever.vue"),
    props: route => ({ code: route.query.code }),
    meta: { pageTitle: "Clever Authentication" },

  },
  {
    path: "/enable-cookies",
    name: "EnableCookies",
    component: () =>
      import("../pages/EnableCookies.vue"),
    meta: { requiresGuest: true, pageTitle: "Enable Cookies" },
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
  if(!store.isAuthenticated && to.name !== "SignIn"){
    console.log("You're not logged in. Routing to SignIn")
    return { name: "SignIn" }
  }
})

export default router;
