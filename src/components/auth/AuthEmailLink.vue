<template>
  <AppSpinner v-if="localStorageEmail" />
  <div v-else class="field col">
    <span class="p-float-label">
      <InputText id="email" v-model="formEmail" />
      <label for="email">Email</label>
    </span>
    <div class="col-12 mb-3">
      <Button label="Finish signing in" @click="loginFromEmailLink(formEmail)" />
    </div>
  </div>
  <transition-group name="p-message" tag="div">
    <Message v-for="msg of messages" :key="msg.id" :severity="msg.severity">{{ msg.content }}</Message>
  </transition-group>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useAuthStore } from '@/store/auth'
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router'

const router = useRouter();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const success = ref(false);

authStore.$subscribe((mutation, state) => {
  if (state.roarfirekit.userData) {
    success.value = true;
    router.push({ name: "Home" });
  }
});

const formEmail = ref();
const localStorageEmail = ref();
const messages = ref([]);

const addMessages = (errorCode) => {
  if (errorCode === "auth/invalid-action-code") {
    messages.value = [
      {
        severity: 'warn',
        content: 'There was an issue with the sign-in link that you clicked on. This can happen when you attempt reuse a sign-in link from a previous email. We are rerouting you to the sign-in page to request another link.',
        id: 0,
      }
    ];
  } else if (errorCode === "timeout") {
    messages.value = [
      {
        severity: 'warn',
        content: 'There was an issue with the email sign-in link. We apologize for the inconvenience and are rerouting you to the sign-in page to request another link.',
        id: 0,
      }
    ];
  }
};

const loginFromEmailLink = async (email) => {
  unsubscribe();
  const emailLink = window.location.href;
  await authStore.signInWithEmailLink({ email, emailLink }).catch((error) => {
    if (error.code === "auth/invalid-action-code") {
      addMessages(error.code);
      setTimeout(() => {
        router.replace({ name: "SignIn" });
      }, 5000);
    } else {
      throw error;
    }
  });
}

const unsubscribe = authStore.$subscribe(async (mutation, state) => {
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
  setTimeout(() => {
    if (!success.value) {
      addMessages("timeout");
      setTimeout(() => {
        if (!success.value) {
          router.replace({ name: "SignIn" });
        }
      }, 5000);
    }
  }, 8000)
})
</script>