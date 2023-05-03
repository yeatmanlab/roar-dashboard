<template>
  <div>
    <div>
      <div class="login-container mx-auto">
        <Transition name="login" mode="out-in">
          <div v-if="!isRegistering">
            <SignIn :isRegistering="false" />
            <div class="contact-text">
              <span v-if="!isRegistering">Don't have an account? <button class="text-btn" @click="isRegistering = !isRegistering">Register</button></span>
            </div>
          </div>
          <div v-else>
            <SignIn :isRegistering="true" />
            <div class="contact-text">
              <span>Already have an account? <button class="text-btn" @click="isRegistering = false">Log In</button></span>
            </div>
          </div>
        </Transition>
      </div>
      <Transition name="external-auth" mode="out-in">
        <div v-if="!isRegistering">
          <p>Other ways to Login</p>
          <div class="push-top text-center button-container">
            <Button @click="authWithGoogle"
              label="Google" class="signin-button" />
            <Button @click="authWithGoogle"
              label="Clever" class="signin-button" />
          </div>
        </div>
        <div v-else>
          <p>Other ways to Register</p>
          <div class="push-top text-center button-container">
            <Button @click="authWithGoogle"
              label="Google" class="signin-button" />
            <Button @click="authWithGoogle"
              label="Clever" class="signin-button" />
          </div>
        </div>
      </Transition>
      <!-- <p>Other ways to {{ isRegistering ? 'Register' : 'Login' }}</p>
      <div class="push-top text-center button-container">
        <Button @click="authWithGoogle"
          label="Google" class="signin-button" />
        <Button @click="authWithGoogle"
          label="Clever" class="signin-button" />
      </div> -->
    </div>
  </div>
</template>

<script setup>
import SignIn from "@/components/auth/SignIn.vue";
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
.login-enter-active,
.login-leave-active {
  transition: all 0.5s ease-out;
}
.login-enter-from {
  opacity: 0;
  transform: translateX(300px);
}

.login-leave-to {
  opacity: 0;
  transform: translateX(-300px);
}


.external-auth-enter-active,
.external-auth-leave-active {
  transition: all 0.5s ease-out;
}
.external-auth-enter-from {
  opacity: 0;
  transform: translateY(30px);
}

.external-auth-leave-to {
  opacity: 0;
  transform: translateY(30px);
}
</style>
