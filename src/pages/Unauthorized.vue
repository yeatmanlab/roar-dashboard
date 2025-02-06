<template>
  <div id="signin-container">
    <section id="signin">
      <header>
        <div class="signin-logo">
          <PvImage v-if="isLevante" src="/LEVANTE/Levante_Logo.png" alt="LEVANTE Logo" width="200" />
          <ROARLogoShort v-else />
        </div>
      </header>
      <section class="px-3 flex flex-column gap-3 text-center align-items-center">
        <h1>Oops!</h1>
        <span class="font-light font-md">You do not have sufficient permission to view that page.</span>
        <PvButton label="<-- Back" @click="goBack" />
      </section>
    </section>
  </div>
</template>
<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import PvButton from 'primevue/button';
import ROARLogoShort from '@/assets/RoarLogo-Short.vue';
import { useRouter } from 'vue-router';

const router = useRouter();

function goBack() {
  router.go(-1);
}

onMounted(() => {
  document.body.classList.add('page-signin');
});

onBeforeUnmount(() => {
  document.body.classList.remove('page-signin');
});
</script>
