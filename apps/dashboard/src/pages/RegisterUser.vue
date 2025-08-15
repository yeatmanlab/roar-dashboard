<template>
  <div>
    <div class="register-container mx-auto md:flex-none">
      <RegisterUser />
      <div class="contact-text">
        <span
          >Already have an account? <router-link :to="{ name: 'SignIn' }" class="text-btn">Sign In</router-link></span
        >
      </div>
    </div>
    <p style="text-align: center">Other ways to Login</p>
    <div class="push-top text-center button-container">
      <PvButton label="Google" class="signin-button" @click="authWithGoogle" />
      <PvButton label="Clever" class="signin-button" @click="authWithGoogle" />
    </div>
  </div>
</template>

<script setup>
import PvButton from 'primevue/button';
import RegisterUser from '@/components/auth/RegisterUser.vue';
import { useAuthStore } from '@/store/auth';
import { isMobileBrowser } from '@/helpers';

const authStore = useAuthStore();
const authWithGoogle = () => {
  if (isMobileBrowser()) {
    authStore.signInWithGoogleRedirect();
  } else {
    authStore.signInWithGooglePopup();
  }
};
</script>

<style scoped>
.register-container {
  border-style: solid;
  border-width: 1px;
  border-radius: 5px;
  border-color: #e5e5e5;
  background-color: #fcfcfc;
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
  margin-bottom: 6.5rem;
}

.signin-button {
  background-color: #e5e5e5;
  border-color: #c4c4c4;
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
