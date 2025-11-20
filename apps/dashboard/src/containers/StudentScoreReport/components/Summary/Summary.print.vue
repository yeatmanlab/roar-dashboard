<template>
  <div class="pt-2 mt-1 text-xs border border-gray-800 border-top-2">
    <h2 class="text-lg font-bold">Assessment Overview</h2>
    <p>
      {{ $t('scoreReports.roarSummary') }}
      <i18n-t keypath="scoreReports.summary" :tag="false">
        <template #firstName>
          <span class="inline">{{ studentFirstName }}</span>
        </template>
      </i18n-t>
    </p>

    <i18n-t keypath="scoreReports.completedTasks" tag="p">
      <template #firstName>
        {{ studentFirstName }}
      </template>
    </i18n-t>
    <ul class="p-0 pl-3 columns-2">
      <li v-for="task in tasks" :key="task" class="pb-1">
        <strong>{{ task }}</strong>
      </li>
    </ul>
  </div>
</template>

<script setup>
defineProps({
  studentFirstName: {
    type: String,
    required: true,
  },
  expanded: {
    type: Boolean,
    default: false,
  },
  exportLoading: {
    type: Boolean,
    default: false,
  },
  tasks: {
    type: Array,
    required: true,
  },
});

defineEmits(['toggleExpand', 'exportPdf']);
</script>
