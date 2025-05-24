<template>
  <LevanteSpinner v-if="!isError" fullscreen />
  <div v-else style="margin-top: 200px">
    <i class="pi pi-exclamation-circle text-6xl text-red-500 center"></i>
    <p class="text-xl font-semibold text-center">
      There was a problem with the email sign-in link. Please try again.
    </p>
    <div class="center">
      <PvButton
        label="Back to sign in"
        @click="router.push({ name: 'SignIn' })"
      />
    </div>
  </div>
  <transition-group name="p-message" tag="div">
    <PvMessage v-for="msg of messages" :key="msg.id" :severity="msg.severity">{{ msg.content }}</PvMessage>
  </transition-group>
</template>

<script setup>
// Force git to detect changes
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import PvButton from "primevue/button";
import PvMessage from "primevue/message";
import { useAuthStore } from "@/store/auth";
import { fetchDocById } from "@/helpers/query/utils";
import LevanteSpinner from "@/components/LevanteSpinner.vue";
import { logger } from "@/logger";

const router = useRouter();
const authStore = useAuthStore();
const { roarfirekit, uid } = storeToRefs(authStore);
const success = ref(false);
const isError = ref(false);
const messages = ref([]);

const addMessages = (errorCode) => {
  messages.value.push({
    id: Date.now(),
    severity: 'error',
    content: `Error: ${errorCode}`
  });
};

// Define unsubscribe function first
const unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (
    state.roarfirekit.isSignInWithEmailLink &&
    state.roarfirekit.signInWithEmailLink
  ) {
    if (!roarfirekit.value.isSignInWithEmailLink(window.location.href)) {
      router.replace({ name: "Home" });
    }
  }
});

authStore.$subscribe(async () => {
  if (authStore.roarUid) {
    const userData = await fetchDocById('users', authStore.roarUid);
    const userClaims = await fetchDocById('userClaims', authStore.uid);
    authStore.setUserData(userData);
    authStore.setUserClaims(userClaims);
    success.value = true;
    router.push({ name: 'Home' });
  }
});

const loginFromEmailLink = async (email) => {
  unsubscribe();
  const emailLink = window.location.href;
  await authStore
    .signInWithEmailLink({ email, emailLink })
    .catch((error) => {
      if (error.code === 'auth/invalid-action-code') {
        addMessages(error.code);
        setTimeout(() => {
          router.replace({ name: 'SignIn' });
        }, 5000);
      } else {
        throw error;
      }
    })
    .then(async () => {
      if (uid.value) {
        // Not sure why we need this since user data and claims are fetched in the HomeSelector.vue but otherwise won't load homepage.
        // TODO: Remove once we figure out why the homepage doesn't load without this.
        const userData = await fetchDocById("users", uid.value);
        const userClaims = await fetchDocById("userClaims", uid.value);

        authStore.setUserData(userData);
        authStore.setUserClaims(userClaims);
        router.push({ name: "Home" });
      }
    })
    .catch((error) => {
      isError.value = true;
      console.error("error logging in:", error);
    });
};

onMounted(async () => {
  const email = window.localStorage.getItem("emailForSignIn");
  if (email) {
    try {
      await loginFromEmailLink(email);
    } catch (error) {
      console.error("error logging in:", error);
      logger.capture("Error logging in with email link", { error });
      isError.value = true;
    }
  } else {
    // No email in localStorage, so we need to show a message
    isError.value = true;
    logger.capture("No email in localStorage");
  }
});
</script>

<style scoped>
.center {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 30px;
}
</style>
