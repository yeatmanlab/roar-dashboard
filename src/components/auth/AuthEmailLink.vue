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
  <transition-group name="p-message" tag="div">
    <PvMessage v-for="msg of messages" :key="msg.id" :severity="msg.severity">{{ msg.content }}</PvMessage>
  </transition-group>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import PvButton from 'primevue/button';
import PvInputText from 'primevue/inputtext';
import PvMessage from 'primevue/message';
import PvFloatLabel from 'primevue/floatlabel';
import { useAuthStore } from '@/store/auth';
import { fetchDocById } from '@/helpers/query/utils';
import AppSpinner from '@/components/AppSpinner.vue';

interface Message {
  id: number;
  severity: 'warn' | 'error' | 'info' | 'success';
  content: string;
}

const router = useRouter();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const success = ref<boolean>(false);

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

const formEmail = ref<string>('');
const localStorageEmail = ref<string | null>(null);
const messages = ref<Message[]>([]);

const addMessages = (errorCode: string): void => {
  if (errorCode === 'auth/invalid-action-code') {
    messages.value = [
      {
        severity: 'warn',
        content:
          'There was an issue with the sign-in link that you clicked on. This can happen when you attempt reuse a sign-in link from a previous email. We are rerouting you to the sign-in page to request another link.',
        id: 0,
      },
    ];
  } else if (errorCode === 'timeout') {
    messages.value = [
      {
        severity: 'warn',
        content:
          'There was an issue with the email sign-in link. We apologize for the inconvenience and are rerouting you to the sign-in page to request another link.',
        id: 0,
      },
    ];
  }
};

const loginFromEmailLink = async (email: string): Promise<void> => {
  unsubscribe();
  const emailLink = window.location.href;
  await authStore
    .signInWithEmailLink({ email, emailLink })
    .catch((error: any) => {
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
      if (authStore.uid) {
        const userData = await fetchDocById('users', authStore.roarUid);
        const userClaims = await fetchDocById('userClaims', authStore.uid);
        authStore.setUserData(userData);
        authStore.setUserClaims(userClaims);
        success.value = true;
        router.push({ name: 'Home' });
      }
    });
};

const unsubscribe = authStore.$subscribe(async (mutation: any, state: any) => {
  if (state.roarfirekit?.isSignInWithEmailLink && state.roarfirekit?.signInWithEmailLink) {
    if (roarfirekit.value?.isSignInWithEmailLink && !roarfirekit.value.isSignInWithEmailLink(window.location.href)) {
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
