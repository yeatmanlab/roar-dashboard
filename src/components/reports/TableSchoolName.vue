<template>
  <div>
    {{ schoolName }}
  </div>
</template>

<script setup>
import { defineProps, computed } from 'vue';
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

const schoolName = computed(() => {
  const currentSchools = _get(props.colData.user, 'schools.current');
  if (currentSchools) {
    const schoolId = currentSchools[0];
    return props.col?.schoolsMap[schoolId] ?? '';
  }
  return '';
});
</script>
