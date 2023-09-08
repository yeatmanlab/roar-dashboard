<template>
  <div class="loading-container">
    <AppSpinner style="margin-bottom: 1rem;" />
    <span>Loading your data from Clever...</span>
  </div>
</template>
<script setup>
import { useAuthStore } from '@/store/auth.js';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import _get from 'lodash/get';
import AppSpinner from '../components/AppSpinner.vue';

const router = useRouter();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

let userDataCheckInterval;

function checkForUserType() {
  if(roarfirekit.value.userData) {
    const userType = _get(roarfirekit.value, 'userData.userType')
    if(userType !== 'guest') {
      clearInterval(userDataCheckInterval)
      router.push({ name: "Home" })
    }
  }
}

userDataCheckInterval = setInterval(checkForUserType, 500);
</script>
<style>
.loading-container {
  width: 100%;
  text-align: center;
}
</style>