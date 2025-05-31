<template>
  <div class="col-full text-center">
    <h1>{{ $t('notFound.pageNotFound') }}</h1>
    <p>{{ $t('notFound.sorry') }}</p>
    <router-link :to="{ name: 'Home' }">
      <PvButton
        :label="$t('notFound.label')"
        class="bg-primary text-white p-2 border-none border-round hover:bg-red-900"
        icon="pi pi-home mr-2 text-white"
      />
    </router-link>
  </div>
</template>

<script setup>
import PvButton from 'primevue/button';
</script>
