<!-- apps/dashboard/src/pages/SignIn.vue -->
<template>
  <div v-if="storeSpinner" class="loading-blur">
    <AppSpinner />
  </div>

  <div id="signin-container-blur" class="bg-gray-50">
    <div class="signin-column">
      <SignInCard class="signin-card">
        <section id="signin" class="m-0 p-0">
          <!-- Logo / header -->
          <header class="mb-0 pb-0">
            <div class="signin-logo">
              <ROARLogoShort />
            </div>
          </header>

          <!-- The actual sign-in flow lives in the container -->
          <SignInContainer />
        </section>
      </SignInCard>

      <!-- Footer (Language, Privacy, Terms) -->
      <footer class="signin-footer">
        <a href="#trouble" class="hidden">{{ $t('pageSignIn.havingTrouble') }}</a>
        <div class="w-full flex">
          <div class="flex-1">
            <LanguageSelector />
          </div>
          <div class="flex gap-2">
            <a
              :href="TERMS_OF_SERVICE_DOCUMENT_PATH"
              class="text-400 inline-block text-sm hover:text-primary pt-2"
              target="_blank"
            >
              {{ $t('pageSignIn.Privacy') }}
            </a>
            <a
              :href="TERMS_OF_SERVICE_DOCUMENT_PATH"
              class="text-400 inline-block text-sm hover:text-primary pt-2"
              target="_blank"
            >
              {{ $t('pageSignIn.Terms') }}
            </a>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { TERMS_OF_SERVICE_DOCUMENT_PATH } from '@/constants/auth';

import ROARLogoShort from '@/assets/RoarLogo-Short.vue';
import LanguageSelector from '@/components/LanguageSelector.vue';
import AppSpinner from '@/components/AppSpinner.vue';
import SignInCard from '@/containers/SignIn/components/SignInCard/SignInCard.vue';
import SignInContainer from '@/containers/SignIn/SignIn.vue';

const authStore = useAuthStore();
const { spinner: storeSpinner } = storeToRefs(authStore);

onMounted(() => {
  document.body.classList.add('page-signin');
});
onBeforeUnmount(() => {
  document.body.classList.remove('page-signin');
});
</script>
