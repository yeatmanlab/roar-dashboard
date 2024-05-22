<template>
  <div class="loading-container">
    <AppSpinner style="margin-bottom: 1rem" />
    <span>{{ $t('cleverLanding.cleverLoading') }}</span>
  </div>
</template>
<script setup>
import { useAuthStore } from '@/store/auth.js';
import { useRouter } from 'vue-router';
import _get from 'lodash/get';
import AppSpinner from '@/components/AppSpinner.vue';
import { fetchDocById } from '@/helpers/query/utils';

const router = useRouter();
const authStore = useAuthStore();

let userDataCheckInterval;
async function checkForUserType() {
  try {
    const userData = await fetchDocById('users', authStore.uid);
    const userType = _get(userData, 'userType');
    if (userType && userType !== 'guest') {
      clearInterval(userDataCheckInterval);
      router.push({ name: 'Home' });
    }
  } catch (error) {
    if (error.code !== 'ERR_BAD_REQUEST') {
      throw error;
    }
  }
}

userDataCheckInterval = setInterval(checkForUserType, 1000);
</script>
<style>
.loading-container {
  width: 100%;
  text-align: center;
}
</style>
