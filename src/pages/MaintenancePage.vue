<template>
  <div id="signin-container">
    <section id="signin">
      <header>
        <div class="signin-logo">
          <PvImage v-if="isLevante" src="/LEVANTE/Levante_Logo.png" alt="LEVANTE Logo" width="200" />
        </div>
      </header>
      <section class="px-3 flex flex-column gap-3 text-center align-items-center">
        <h1>We'll be back soon!</h1>
        <span class="font-light font-md">We apologize for any inconvenience, please check back later.</span>
      </section>
    </section>
  </div>
</template>
<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import PvImage from 'primevue/image';

onMounted(() => {
  document.body.classList.add('page-signin');
});

onBeforeUnmount(() => {
  document.body.classList.remove('page-signin');
});
</script>
