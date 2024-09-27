<template>
  <div class="w-full py-8 text-center">
    <AppSpinner style="margin-bottom: 1rem" />
    <span v-if="!authFromClassLink.value">{{ $t('classLinkLanding.classLinkLoading') }}</span>
    <span v-if="authFromClever.value">{{ $t('cleverLanding.cleverLoading') }}</span>
  </div>
</template>
<script setup>
import { computed, onBeforeMount, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import useSSOAccountReadinessVerification from '@/composables/useSSOAccountReadinessVerification';
import AppSpinner from '@/components/AppSpinner.vue';
import { APP_ROUTES } from '@/constants/routes';

const router = useRouter();
const authStore = useAuthStore();
const { roarUid, authFromSSO, authFromClassLink, authFromClever } = storeToRefs(authStore);

const { startPolling } = useSSOAccountReadinessVerification(roarUid.value);

// @TODO: Refactor to a single SSO source property stored in the auth store.
const ssoSource = computed(() => {
  if (authFromClassLink.value) return 'ClassLink';
  if (authFromClever.value) return 'Clever';
  return 'Unknown';
});

onBeforeMount(() => {
  if (!authFromSSO.value || !authFromClassLink.value || !authFromClever.value) {
    console.error('No SSO source detected. Redirecting to homepage...');
    router.push({ path: APP_ROUTES.HOME });
    return;
  }
});

onMounted(() => {
  console.log(`User ${roarUid.value} was redirected to SSO auth landing page from ${ssoSource.value}`);
  console.log('Polling for account readiness...');

  authFromSSO.value = false;
  authFromClassLink.value = false;
  authFromClever.value = false;

  startPolling();
});
</script>
