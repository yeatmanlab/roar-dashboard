<template>
  <div class="loading-blur" v-if="spinner">
    <AppSpinner />
  </div>
  <div id="signin-container">
    <section id="signin">
      <header>
        <div class="signin-logo"><img src="../assets/stanford-roar.svg" height="35" alt="The ROAR Logo" /></div>
        <h1>Sign In to ROAR</h1>
        <p>Access your dashboard using one of the options below.</p>
      </header>
      <section class="signin-option-container signin-option-userpass">
        <h3 class="signin-option-title">Use your username or email</h3>
        <SignIn @submit="authWithEmail" :invalid="incorrect" />
      </section>
      <section class="signin-option-container signin-option-providers">
        <h3 class="signin-option-title">Use a provider</h3>
        <Button @click="authWithGoogle" label="Sign in with Google" class="signin-button">
          <img src="../assets/provider-google-logo.svg" height="50" alt="The ROAR Logo" class="signin-button-icon" />
          <span>Sign in with Google</span>
        </Button>
        <Button @click="authWithClever" class="signin-button">
          <img src="../assets/provider-clever-logo.svg" height="50" alt="The ROAR Logo" class="signin-button-icon" />
          <span>Sign in with Clever</span>
        </Button>
      </section>
      <footer>
        <!-- TODO: figure out a link for this -->
        <a href="#trouble">Having trouble?</a>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref, watch, toRaw } from 'vue';
import SignIn from "@/components/auth/SignIn.vue";
import { useAuthStore } from "@/store/auth";
import { useRouter } from 'vue-router';
import { isMobileBrowser } from "@/helpers";
import AppSpinner from '../components/AppSpinner.vue';
import _get from 'lodash/get'
import { storeToRefs } from 'pinia';

const spinner = ref(false);
const incorrect = ref(false);
const authStore = useAuthStore();
const router = useRouter();

const { hasUserData } = storeToRefs(authStore);

const authWithGoogle = () => {
  if (isMobileBrowser()) {
    authStore.signInWithGoogleRedirect();
  } else {
    // authStore.signInWithGoogleRedirect();
    authStore.signInWithGooglePopup().catch(() => {
      spinner.value = false;
    });
    
    spinner.value = true;
  }
};
const authWithClever = () => {
  if (isMobileBrowser()) {
    authStore.signInWithCleverRedirect();
  } else {
    authStore.signInWithCleverRedirect();
    // authStore.signInWithCleverPopup();
    spinner.value = true;
  }
}

function validateEmail(email) {
  return ref.test('/^\S+@\S+\.\S+$/')
}

const authWithEmail = (state) => {
  // If username is supplied instead of email
  // turn it into our internal auth email
  incorrect.value = false;
  let creds = toRaw(state);
  if(!creds.email.includes("@")){
    creds.email = `${creds.email}@roar-auth.com`
  }

  authStore.logInWithEmailAndPassword(creds).then(() => {
    spinner.value = true;
  }).catch((e) => {
    incorrect.value = true;
    return;
  });
}

watch(hasUserData, (newValue, oldValue) => {
  if (newValue === true) {
    router.push({ name: "Home" })
  }
})

onMounted(() => {
  document.body.classList.add('page-signin')
  if (authStore.cleverOAuthRequested) {
    authStore.cleverOAuthRequested = false;
    authWithClever();
  }
});
</script>

<style scoped>
.loading-blur {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  background-color: rgba(0,0,0,0.5);
  padding-top: 21vh;
}
</style>
