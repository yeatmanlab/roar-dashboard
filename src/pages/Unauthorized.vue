<template>
  <div>
    <section id="signin" class="w-full">
      <section class="px-3 flex flex-column gap-3 text-center align-items-center">
        <h1>Oops!</h1>
        <span class="font-light font-md">You do not have sufficient permission to view that page.</span>
        <PvButton label="<-- Back" @click="goBack" />
      </section>
    </section>
  </div>
</template>
<script setup>
import PvButton from 'primevue/button';
import ROARLogoShort from '@/assets/RoarLogo-Short.vue';
import { useRouter } from 'vue-router';

const router = useRouter();

function goBack() {
  router.go(-1);
}
</script>
