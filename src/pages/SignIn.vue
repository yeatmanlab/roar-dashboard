<template>
  <div id="signin-container">
    <section id="signin">
      <header>
        <div class="signin-logo"><img src="../assets/stanford-roar.svg" height="35" alt="The ROAR Logo" /></div>
        <h1>Sign In to ROAR</h1>
        <p>Access your dashboard using one of the options below.</p>
      </header>
      <section class="signin-option-container signin-option-userpass">
        <h3 class="signin-option-title">Use your username</h3>
        <SignIn />
      </section>
      <section class="signin-option-container signin-option-providers">
        <h3 class="signin-option-title">Use a provider</h3>
        <Button @click="authWithGoogle" label="Sign in with Google" class="signin-button">
          <img src="../assets/provider-google-logo.svg" height="50" alt="The ROAR Logo" class="signin-button-icon"/>
          <span>Sign in with Google</span>
        </Button>
        <Button @click="authWithClever" class="signin-button">
          <img src="../assets/provider-clever-logo.svg" height="50" alt="The ROAR Logo" class="signin-button-icon"/>
          <span>Sign in with Clever</span>
        </Button>
      </section>
      <footer>
        <!-- TODO: figure out a link for this -->
        <a href="#trouble">Having trouble?</a>
        <AppSpinner v-if="spinner" />
      </footer>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref, watch, computed } from 'vue';
import SignIn from "@/components/auth/SignIn.vue";
import { cleverSSOUrl } from "@/helpers/auth.js"
import { useAuthStore } from "@/store/auth";
import { useRouter } from 'vue-router';
import { isMobileBrowser } from "@/helpers";
import AppSpinner from '../components/AppSpinner.vue';
import _get from 'lodash/get'
import { storeToRefs } from 'pinia';

const spinner = ref(false)
const authStore = useAuthStore();
const router = useRouter();

const { roarfirekit, hasUserData } = storeToRefs(authStore)

const authWithGoogle = () => {
  if(isMobileBrowser()) {
    authStore.signInWithGoogleRedirect();
  } else {
    authStore.signInWithGooglePopup();    
    spinner.value = true;
  }
};
const authWithClever = () => {
  window.location = cleverSSOUrl()
}
const computedData = computed(() => {
  return _get(roarfirekit, 'userData', null)
})

watch(hasUserData, (newValue, oldValue) => {
  console.log('userHasData changed, checking if it is true')
  if(newValue === true){
    console.log('it was true, routing')
    router.push({ name: "Home" })
  }
}) 

onMounted(() => {
  document.body.classList.add('page-signin')
});
</script>

<style>
</style>
