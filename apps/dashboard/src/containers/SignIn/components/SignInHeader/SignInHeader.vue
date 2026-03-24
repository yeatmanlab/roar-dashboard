<template>
  <div class="flex flex-row align-content-center justify-content-center gap-1 w-full m-0 p-0">
    <div class="justify-content-center align-content-center">
      <h1 class="text-color text-center">{{ titleText }}</h1>
      <p class="text-center">{{ subtitleText }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  multipleProviders: { type: Boolean, default: false },
  emailLinkSent: { type: Boolean, default: false },
  showPasswordField: { type: Boolean, default: false },
});

const titleText = computed(() => {
  if (props.multipleProviders) return t('pageSignIn.ChooseYourProvider');
  if (props.emailLinkSent) return t('pageSignIn.checkInbox');
  if (props.showPasswordField) return t('pageSignIn.EnterYourPassword');
  return t('pageSignIn.welcome');
});

const subtitleText = computed(() => {
  if (props.multipleProviders) return t('pageSignIn.ChooseYourProviderDescription');
  if (props.emailLinkSent) return t('pageSignIn.checkInboxDescription');
  if (props.showPasswordField) return t('pageSignIn.almostTime');
  return t('pageSignIn.login');
});
</script>
