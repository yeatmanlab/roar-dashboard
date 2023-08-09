<template>
  <div id="signin-container" :style="spinner ? 'opacity: 50%' : ''">
    <section id="signin">
      <header>
        <div class="signin-logo">
          <ROARLogo />
        </div>
      </header>
      <h1>Welcome to ROAR!</h1>
      <section class="signin-options">
        <section class="signin-option-container signin-option-userpass">
          <h4 class="signin-option-title">Log in to access your dashboard</h4>
          <SignIn @submit="authWithEmail" :invalid="incorrect" />
        </section>
        <section class="signin-option-container signin-option-providers">
          <h4 class="signin-option-title">Log in with:</h4>
          <div>
          <Button @click="authWithGoogle" label="Sign in with Google" class="signin-button">
            <img src="../assets/provider-google-logo.svg" alt="The ROAR Logo" class="signin-button-icon" />
            <span>Google</span>
          </Button>
          <Button @click="authWithClever" class="signin-button">
            <img src="../assets/provider-clever-logo.svg" alt="The ROAR Logo" class="signin-button-icon" />
            <span>Clever</span>
          </Button>
          </div>
        </section>
      </section>
      <footer style="display: none"> 
        <!-- TODO: figure out a link for this -->
        <a href="#trouble">Having trouble?</a>
        <AppSpinner v-if="spinner" />
      </footer>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref, watch, toRaw } from 'vue';
import SignIn from "@/components/auth/SignIn.vue";
import ROARLogo from "@/assets/RoarLogo.vue";
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

<style></style>
