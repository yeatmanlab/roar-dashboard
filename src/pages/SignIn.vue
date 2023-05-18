<template>
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
    </footer>
  </section>
</template>

<script setup>
import { onMounted } from 'vue';
import SignIn from "@/components/auth/SignIn.vue";
import { cleverSSOUrl } from "@/helpers/auth.js"
import { useAuthStore } from "@/store/auth";
import { isMobileBrowser } from "@/helpers";

const authStore = useAuthStore();
const authWithGoogle = () => {
  if(isMobileBrowser()) {
    authStore.signInWithGoogleRedirect();
  } else {
    authStore.signInWithGooglePopup();
  }
};
const authWithClever = () => {
  window.location = cleverSSOUrl()
}

onMounted(() => {
  document.body.classList.add('page-signin')
});
</script>

<style>
</style>
