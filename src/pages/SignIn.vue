<template>
  <div class="loading-blur" v-if="spinner">
    <AppSpinner />
  </div>
  <div id="signin-container">
    <section id="signin">
      <header>
        <div class="signin-logo">
          <ROARLogoShort />
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
      </footer>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref, watch, toRaw } from 'vue';
import SignIn from "@/components/auth/SignIn.vue";
import ROARLogoShort from "@/assets/RoarLogo-Short.vue";
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

const { hasUserData, roarfirekit } = storeToRefs(authStore);

const authWithGoogle = () => {
  if (isMobileBrowser()) {
    authStore.signInWithGoogleRedirect();
  } else {
    // authStore.signInWithGoogleRedirect();
    console.log('[signIn] calling authStore function')
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

  console.log('logging in with', creds)
  spinner.value = true;
  authStore.logInWithEmailAndPassword(creds).then(() => {
    console.log('[signIn] in logInWithEmailPassword .then() block')
  }).catch((e) => {
    spinner.value = false;
    incorrect.value = true;
    return;
  });
}

watch(hasUserData, (newValue, oldValue) => {
  if (newValue === true) {
    router.push({ name: "Home" })
  }
})
watch(roarfirekit, (newValue, oldValue) => {
  // console.log('[!!!!!][signin] roarfirekit watcher triggered on signin')
  // console.log('[^ above] new value is', newValue)
  console.log('[RFK WATCHER] new val detected:', newValue)
  console.log('[^] from:', oldValue)
  console.log('getting value', { ...toRaw(newValue) })
  console.log('User data inside of watcher', { ..._get(toRaw(roarfirekit), 'userData') })
  // console.log('userData?', _get(toRaw(newValue), 'userData'))
  // if(_get(toRaw(newValue), 'userData')){
    // console.log('[^^] Userdata detected in new value:', _get(toRaw(newValue), 'userData'))
    // router.push({ name: "Home" })
  // }
}, { deep: true })

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
