<template>
  <AppSpinner v-if="localStorageEmail" />
  <div v-else class="field col">
    <PvFloatLabel>
      <PvInputText id="email" v-model="formEmail" />
      <label for="email">Email</label>
    </PvFloatLabel>
    <div class="col-12 mb-3">
      <PvButton label="Finish signing in" @click="loginFromEmailLink(formEmail)" />
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import PvFloatLabel from 'primevue/floatlabel';
import PvButton from 'primevue/button';
import PvInputText from 'primevue/inputtext';
import { useAuthStore } from '@/store/auth';
import { getAuthService } from '@/services/AuthService';

const router = useRouter();
const authStore = useAuthStore();

const formEmail = ref();
const localStorageEmail = ref();

let unsubscribe = () => {};

const routeHome = () => {
  unsubscribe();
  router.push({ name: 'Home' });
};

const loginFromEmailLink = async (email) => {
  const emailLink = window.location.href;
  await authStore.signInWithEmailLink({ email, emailLink }).catch((error) => {
    if (error.code === 'auth/invalid-action-code') {
      unsubscribe();
      setTimeout(() => {
        router.replace({ name: 'SignIn' });
      }, 5000);
    } else {
      unsubscribe();
      throw error;
    }
  });
};

unsubscribe = authStore.$subscribe((_, state) => {
  if (state.accessToken) routeHome();
});

onMounted(async () => {
  localStorageEmail.value = window.localStorage.getItem('emailForSignIn');

  if (authStore.isAuthReady) {
    routeHome();
    return;
  }

  if (!getAuthService().isSignInWithEmailLink(window.location.href)) {
    unsubscribe();
    router.replace({ name: 'Home' });
    return;
  }

  if (localStorageEmail.value) await loginFromEmailLink(localStorageEmail.value);
});
</script>
