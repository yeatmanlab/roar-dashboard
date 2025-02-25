<template>
  <div>
    <section id="signin" class="w-full">
      <section class="px-3 flex flex-column gap-3 text-center align-items-center">
        <h1>Oops!</h1>
        <span class="font-light font-md">You do not have sufficient permission to view that page.</span>
        <PvButton label="Go Back" @click="goBack" />
      </section>
    </section>
  </div>
</template>
<script setup>
import PvButton from 'primevue/button';
import { useRouter } from 'vue-router';

const router = useRouter();

function goBack() {
  if (window.history.length > 1) {
    router.go(-1);
  } else {
    router.push({ name: 'Home' });
  }
}
</script>
