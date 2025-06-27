<template>
  <div class="loading-container">
    <AppSpinner style="margin-bottom: 1rem" />
    <span>{{ $t('classLinkLanding.classLinkLoading') }}</span>
  </div>
</template>
<script setup>
import { useAuthStore } from '@/store/auth.js';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import _get from 'lodash/get';
import _union from 'lodash/union';
import _isEmpty from 'lodash/isEmpty';
import AppSpinner from '@/components/AppSpinner.vue';
import { fetchDocById } from '@/helpers/query/utils';
import { createAuthBreadcrumb } from '@/helpers/logBreadcrumbs';

const router = useRouter();
const authStore = useAuthStore();
const { uid, roarUid, authFromClassLink } = storeToRefs(authStore);

let userDataCheckInterval;

async function checkForUserType() {
  try {
    const userData = await fetchDocById('users', roarUid.value);
    const userType = _get(userData, 'userType');
    const logAuthBreadcrumb = createAuthBreadcrumb({ roarUid: roarUid.value, userType, provider: 'ClassLink' });
    if (userType && userType === 'student') {
      // The user document exists and is not a guest. This means that the
      // on-demand account provisioning cloud function has completed.  However,
      // we still need to wait for the user's assignments to be loaded.
      const assignments = _get(userData, 'assignments', {});
      const allAssignmentIds = _union(...Object.values(assignments));
      if (allAssignmentIds.length > 0) {
        logAuthBreadcrumb({
          message: 'User is found with assignments, routing to home',
          details: { userData, assignments },
        });
        clearInterval(userDataCheckInterval);
        authStore.refreshQueryKeys();
        router.push({ name: 'Home' });
      } else {
        logAuthBreadcrumb({
          message: 'User is found but no assignments. Retrying...',
          level: 'warning',
        });
      }
    } else if (userType && userType !== 'guest') {
      const userClaims = await fetchDocById('userClaims', uid.value);
      const adminOrgs = _get(userClaims, 'claims.adminOrgs', {});
      logAuthBreadcrumb({
        message: 'User is found with adminOrgs',
        details: { adminOrgs },
      });
      if (!_isEmpty(adminOrgs)) {
        clearInterval(userDataCheckInterval);
        authStore.refreshQueryKeys();
        router.push({ name: 'Home' });
      } else {
        logAuthBreadcrumb({
          message: 'User is found but with no adminOrgs, retrying...',
          level: 'warning',
        });
      }
    } else {
      logAuthBreadcrumb({
        message: 'User is found with invalid userType, retrying...',
        level: 'warning',
      });
    }
  } catch (error) {
    if (error.code !== 'ERR_BAD_REQUEST') {
      throw error;
    }
  }
}

authFromClassLink.value = false;
userDataCheckInterval = setInterval(checkForUserType, 500);
</script>
<style>
.loading-container {
  width: 100%;
  text-align: center;
}
</style>
