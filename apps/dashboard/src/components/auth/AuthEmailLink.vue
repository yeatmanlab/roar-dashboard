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
import { storeToRefs } from 'pinia';
import PvFloatLabel from 'primevue/floatlabel';
import PvButton from 'primevue/button';
import PvInputText from 'primevue/inputtext';
import { useAuthStore } from '@/store/auth';
import { fetchDocById } from '@/helpers/query/utils';

const router = useRouter();
const authStore = useAuthStore();
const { roarfirekit, roarUid, uid } = storeToRefs(authStore);
const success = ref(false);

authStore.$subscribe(async () => {
  if (roarUid.value) {
    const userData = await fetchDocById('users', roarUid.value);
    const userClaims = await fetchDocById('userClaims', uid.value);
    authStore.userData = userData;
    authStore.userClaims = userClaims;
    success.value = true;
    router.push({ name: 'Home' });
  }
});

const formEmail = ref();
const localStorageEmail = ref();

const loginFromEmailLink = async (email) => {
  unsubscribe();
  const emailLink = window.location.href;
  await authStore
    .signInWithEmailLink({ email, emailLink })
    .catch((error) => {
      if (error.code === 'auth/invalid-action-code') {
        setTimeout(() => {
          router.replace({ name: 'SignIn' });
        }, 5000);
      } else {
        throw error;
      }
    })
    .then(async () => {
      if (uid) {
        const userData = await fetchDocById('users', uid.value);
        const userClaims = await fetchDocById('userClaims', uid.value);
        authStore.userData = userData;
        authStore.userClaims = userClaims;
        success.value = true;
        router.push({ name: 'Home' });
      }
    });
};

const unsubscribe = authStore.$subscribe(async (_, state) => {
  if (state.roarfirekit.isSignInWithEmailLink && state.roarfirekit.signInWithEmailLink) {
    if (!roarfirekit.value.isSignInWithEmailLink(window.location.href)) {
      router.replace({ name: 'Home' });
    }

    const email = window.localStorage.getItem('emailForSignIn');
    if (email) {
      await loginFromEmailLink(email);
    }
  }
});

onMounted(() => {
  localStorageEmail.value = window.localStorage.getItem('emailForSignIn');
});
</script>
