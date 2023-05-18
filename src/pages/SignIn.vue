<template>
  <section id="signin">
    <header>
      <h1>Sign In to ROAR</h1>
      <p>To access ROAR games, you must sign in with one of the options below.</p>
    </header>
    <section class="signin-option-container signin-option-userpass">
      <SignIn />
    </section>
    <section class="signin-option-container signin-option-providers">
      <h2>Sign In with</h2>
      <Button @click="authWithGoogle" label="Sign in with Google" class="signin-button">
        <img src="../assets/provider-google-logo.svg" height="50" alt="The ROAR Logo" class="signin-button-icon"/>
        <span>Sign in with Google</span>
      </Button>
      <Button @click="authWithClever" class="signin-button">
        <img src="../assets/provider-clever-logo.svg" height="50" alt="The ROAR Logo" class="signin-button-icon"/>
        <span>Sign in with Clever</span>
      </Button>
    </section>
  </section>

</template>

<script setup>
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
</script>

<style>
#app {
  background: var(--primary-color);
  display: flex;
  align-content: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
}

.redline,
.navbar-container {
  display: none !important;
}
</style>
