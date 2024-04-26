<template>
  <div class="col-full text-center">
    <h1>{{ $t('notFound.pageNotFound') }}</h1>
    <p>{{ $t('notFound.sorry') }}</p>
    <router-link :to="{ name: 'Home' }">
      <PvButton :label="$t('notFound.label')" icon="pi pi-home" />
    </router-link>
  </div>
</template>

<script></script>

<style scoped></style>
