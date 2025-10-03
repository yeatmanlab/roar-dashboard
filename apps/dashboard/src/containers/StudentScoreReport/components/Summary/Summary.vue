<template>
  <section class="pt-4 lg:pr-8">
    <p>{{ $t('scoreReports.roarSummary') }}</p>

    <i18n-t keypath="scoreReports.completedTasks" tag="p" class="mt-2">
      <template #firstName>
        {{ studentFirstName }}
      </template>
    </i18n-t>

    <ul class="p-0 list-none lg:columns-2">
      <li v-for="task in tasks" :key="task" class="pb-1">
        <strong>{{ task }}</strong>
      </li>
    </ul>

    <i18n-t keypath="scoreReports.summary" tag="p">
      <template #firstName>
        {{ studentFirstName }}
      </template>
    </i18n-t>
  </section>
</template>

<script setup>
defineProps({
  studentFirstName: {
    type: String,
    required: true,
  },
  tasks: {
    type: String,
    required: true,
  },
});
</script>

<style scoped>
/* @TODO: Migrate to tailwind classes once yeatmanlab/roar-project-management/issues/321 is resolved */
ul li {
  position: relative;
}
ul li::before {
  content: '\e909'; /* Unicode for pi-check */
  font-family: 'PrimeIcons';
  font-size: 0.75rem;
  color: var(--gray-500);
  margin-right: 0.5rem;
}
</style>
