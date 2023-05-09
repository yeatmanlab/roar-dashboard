<template>
  <div>
    <div class="login-container mx-auto md:flex-none">
      <SignIn :isRegistering="false" />
      <div class="contact-text">
        <span>Don't have an account? <router-link :to="{ name: 'Register' }" class="text-btn">Register</router-link></span>
      </div>
    </div>
    <p>Other ways to Login</p>
    <div class="push-top text-center button-container">
      <Button @click="authWithGoogle"
        label="Google" class="signin-button" />
      <Button @click="authWithClever"
        label="Clever" class="signin-button" />
    </div>
  </div>
</template>

<script setup>
import SignIn from "@/components/auth/SignIn.vue";
import { cleverSSOUrl } from "@/helpers/auth.js"
import { useAuthStore } from "@/store/auth";
import { isMobileBrowser } from "@/helpers";
import { ref } from 'vue';

const isRegistering = ref(false)

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

<style scoped>
.login-container {
  border-style: solid;
  border-width: 1px;
  border-radius: 5px;
  border-color: #E5E5E5;
  background-color: #FCFCFC;
  width: 26.875rem;
  padding-right: 1.5rem;
  padding-left: 1.5rem;
  margin-top: 6.5rem;
  position: relative;
}
.contact-text {
  padding-top: 2.75rem;
  padding-bottom: 2rem;
  text-align: left;
}
.button-container {
  display: flex;
  gap: 1.125rem;
  justify-content: center;
}
.signin-button {
  background-color: #E5E5E5;
  border-color: #C4C4C4;
  color: black;
  width: 8rem;
}
.signin-button:hover {
  background-color: #b7b5b5;
  border-color: black;
  color: black;
}
.text-btn {
  border: none;
  background-color: inherit;
  cursor: pointer;
  display: inline-block;
  font-size: 16px;
  color: #2c3e50;
}
</style>
