<template>
  <LevanteSpinner v-if="!isError" fullscreen />
  <div v-else style="margin-top: 200px">
    <i class="pi pi-exclamation-circle text-6xl text-red-500 center"></i>
    <p class="text-xl font-semibold text-center">There was a problem with the email sign-in link. Please try again.</p>
    <div class="center">
      <PvButton label="Back to sign in" @click="router.push({ name: 'SignIn' })" />
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import PvButton from 'primevue/button';
import { useAuthStore } from '@/store/auth';
import { fetchDocById } from '@/helpers/query/utils';
import LevanteSpinner from '@/components/LevanteSpinner.vue';
import { logger } from '@/logger';

const router = useRouter();
const authStore = useAuthStore();
const { roarfirekit, uid } = storeToRefs(authStore);
const isError = ref(false);

const loginFromEmailLink = async (email) => {
  unsubscribe();
  const emailLink = window.location.href;
  await authStore
    .signInWithEmailLink({ email, emailLink })
    .then(async () => {
      if (uid) {
        // Not sure why we need this since user data and claims are fetched in the HomeSelector.vue but otherwise won't load homepage.
        // TODO: Remove once we figure out why the homepage doesn't load without this.
        const userData = await fetchDocById('users', uid.value);
        const userClaims = await fetchDocById('userClaims', uid.value);

        authStore.setUserData(userData);
        authStore.setUserClaims(userClaims);
        router.push({ name: 'Home' });
      }
    })
    .catch((error) => {
      isError.value = true;
      console.error('error logging in:', error);
    });
};

// The user is on the email link authentication page (AuthEmailLink.vue), but:
// The necessary email is missing from local storage (so the primary sign-in logic via loginFromEmailLink cannot proceed).
// AND roarfirekit indicates it's expecting an email link sign-in process to be underway.
// AND the current page's URL is not a valid email sign-in link (e.g., the token in the URL is missing, invalid, or expired, or the user navigated to the path without a token).
const unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.isSignInWithEmailLink && state.roarfirekit.signInWithEmailLink) {
    if (!roarfirekit.value.isSignInWithEmailLink(window.location.href)) {
      router.replace({ name: 'Home' });
    }
  }
});

onMounted(async () => {
  const email = window.localStorage.getItem('emailForSignIn');
  if (email) {
    try {
      await loginFromEmailLink(email);
    } catch (error) {
      console.error('error logging in:', error);
      logger.capture('Error logging in with email link', { error });
      isError.value = true;
    }
  } else {
    // No email in localStorage, so we need to show a message
    isError.value = true;
    logger.capture('No email in localStorage');
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
