<template>
  <div>
    <PvTag
      :severity="progressData?.severity"
      :value="progressData?.value"
      :icon="progressData?.icon"
      :style="`min-width: 2rem`"
      rounded
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import _get from 'lodash/get';
const props = defineProps({
  colData: {
    type: Object,
    default: () => ({}),
    required: true,
  },
  col: {
    type: Object,
    default: () => ({}),
    required: true,
  },
});

const progressData = computed(() => {
  const taskId = props.col.field.split('.')[1];
  const assessmentForTask = props.colData.assignment?.assessments?.find((a) => a.taskId == taskId);
  if (assessmentForTask?.optional) {
    return {
      value: 'optional',
      icon: 'pi pi-question',
      severity: 'info',
    };
  } else if (assessmentForTask?.completedOn !== undefined) {
    return {
      value: 'completed',
      icon: 'pi pi-check',
      severity: 'success',
    };
  } else if (assessmentForTask?.startedOn !== undefined) {
    return {
      value: 'started',
      icon: 'pi pi-exclamation-triangle',
      severity: 'warning',
    };
  } else {
    return {
      value: 'assigned',
      icon: 'pi pi-times',
      severity: 'danger',
    };
  }
});
</script>
