<template>
  <div class="w-full py-8 text-center">
    <AppSpinner style="margin-bottom: 1rem" />
    <span v-if="isClassLinkProvider">{{ $t('classLinkLanding.classLinkLoading') }}</span>
    <span v-if="isCleverProvider">{{ $t('cleverLanding.cleverLoading') }}</span>
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
import { AUTH_SSO_PROVIDERS } from '../constants/auth';

const router = useRouter();
const authStore = useAuthStore();
const { roarUid, ssoProvider } = storeToRefs(authStore);

const { startPolling } = useSSOAccountReadinessVerification(roarUid.value);

const isClassLinkProvider = computed(() => ssoProvider.value === AUTH_SSO_PROVIDERS.CLASSLINK);
const isCleverProvider = computed(() => ssoProvider.value === AUTH_SSO_PROVIDERS.CLEVER);

onBeforeMount(() => {
  if (!ssoProvider.value) {
    console.error('[SSO] No SSO provider detected. Redirecting to homepage...');
    router.push({ path: APP_ROUTES.HOME });
    return;
  }
});

onMounted(() => {
  console.log(`[SSO] User ${roarUid.value} was redirected to SSO landing page from ${ssoProvider.value}`);
  console.log('[SSO] Polling for account readiness...');

  ssoProvider.value = null;
  startPolling();
});
</script>
