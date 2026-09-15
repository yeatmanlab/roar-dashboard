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

      <AuthPageFooter />
    </div>
  </div>
</template>

<script setup>
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import ROARLogoShort from '@/assets/RoarLogo-Short.vue';
import AuthPageFooter from '@/components/AuthPageFooter.vue';
import AppSpinner from '@/components/AppSpinner.vue';
import SignInCard from '@/containers/SignIn/components/SignInCard/SignInCard.vue';
import SignInContainer from '@/containers/SignIn/SignIn.vue';

const authStore = useAuthStore();
const { spinner: storeSpinner } = storeToRefs(authStore);
</script>
