<template>
  <div id="signin-container">
    <section id="signin">
      <header>
        <div class="signin-logo">
          <PvImage v-if="isLevante" src="/LEVANTE/Levante_Logo.png" alt="LEVANTE Logo" width="200" />
          <ROARLogoShort v-else />
        </div>
      </header>
      <section class="px-3 flex flex-column gap-3 text-center">
        <h1>ROAR is currently down for maintenance!</h1>
        <span>We apologize for any inconvenience, please check back later!</span>
      </section>
    </section>
  </div>
</template>
<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import ROARLogoShort from '@/assets/RoarLogo-Short.vue';
onMounted(() => {
  document.body.classList.add('page-signin');
});
onBeforeUnmount(() => {
  document.body.classList.remove('page-signin');
});
</script>
