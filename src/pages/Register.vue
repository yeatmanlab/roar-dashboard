<template>
  <div>
    <div class="register-container mx-auto md:flex-none">
      <Register />
    </div>
  </div>
</template>

<script setup>
import Register from "@/components/auth/Register.vue";
import { useAuthStore } from "@/store/auth";
import { isMobileBrowser } from "@/helpers";

// const authStore = useAuthStore();
// const authWithGoogle = () => {
//   if(isMobileBrowser()) {
//     authStore.signInWithGoogleRedirect();
//   } else {
//     authStore.signInWithGooglePopup();
//   }
// };
</script>

<style scoped>
.register-container {
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
/* .text-btn {
  border: none;
  background-color: inherit;
  cursor: pointer;
  display: inline-block;
  font-size: 16px;
  color: #2c3e50;
} */
</style>
