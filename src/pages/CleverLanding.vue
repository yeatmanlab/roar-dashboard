<template>
  <div class="loading-container">
    <AppSpinner style="margin-bottom: 1rem" />
    <span>{{ $t('cleverLanding.cleverLoading') }}</span>
  </div>
</template>
<script setup>
import { useAuthStore } from '@/store/auth.js';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import _get from 'lodash/get';
import _union from 'lodash/union';
import AppSpinner from '@/components/AppSpinner.vue';
import { fetchDocById } from '@/helpers/query/utils';

const router = useRouter();
const authStore = useAuthStore();
const { roarUid, authFromClever } = storeToRefs(authStore);

let userDataCheckInterval;

async function checkForUserType() {
  try {
    const userData = await fetchDocById('users', roarUid.value);
    const userType = _get(userData, 'userType');
    if (userType && userType === 'student') {
      // The user document exists and is not a guest. This means that the
      // on-demand account provisioning cloud function has completed.  However,
      // we still need to wait for the user's assignments to be loaded.
      const assignments = _get(userData, 'assignments', {});
      const allAssignmentIds = _union(...Object.values(assignments));
      if (allAssignmentIds.length > 0) {
        console.log(`User ${roarUid.value} found with assignments.`, { userData, assignments });
        console.log('Routing to Home');
        clearInterval(userDataCheckInterval);
        authStore.refreshQueryKeys();
        await router.push({ name: 'Home' });
      } else {
        console.log(`User ${roarUid.value} found with userType ${userType} but no assignments. Retrying...`);
      }
    } else if (userType && userType !== 'guest') {
      console.log(`User ${roarUid.value} found with userType ${userType}.`);
      console.log('Routing to Home');
      clearInterval(userDataCheckInterval);
      authStore.refreshQueryKeys();
      await router.push({ name: 'Home' });
    } else {
      console.log(`User ${roarUid.value} found with userType ${userType}. Retrying...`);
    }
  } catch (error) {
    if (error.code !== 'ERR_BAD_REQUEST') {
      throw error;
    }
  }
}

console.log(`Arrived at CleverLanding.vue with uid: ${roarUid.value} and authFromClever: ${authFromClever.value} `);
authFromClever.value = false;
userDataCheckInterval = setInterval(checkForUserType, 1000);
</script>
<style>
.loading-container {
  width: 100%;
  text-align: center;
}
</style>
