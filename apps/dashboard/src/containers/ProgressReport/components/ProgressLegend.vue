<template>
  <div
    class="flex mx-5 flex-column align-items-center"
    :style="{
      '--color-completed': PROGRESS_COLORS.COMPLETED,
      '--color-started': PROGRESS_COLORS.STARTED,
      '--color-assigned': PROGRESS_COLORS.ASSIGNED,
    }"
  >
    <div class="flex flex-wrap gap-3 px-2 py-1 rounded justify-content-around align-items-center">
      <div class="flex flex-row items-center gap-2 text-sm font-light">
        <div class="legend-circle legend-circle--completed" />
        <div>Completed</div>
      </div>
      <div class="flex flex-row items-center gap-2 text-sm font-light">
        <div class="legend-circle legend-circle--started" />
        <div>Started</div>
      </div>
      <div class="flex flex-row items-center gap-2 text-sm font-light">
        <div class="legend-circle legend-circle--assigned" />
        <div>Assigned</div>
      </div>
    </div>
    <div class="my-1 text-xs font-light text-gray-500 uppercase">Legend</div>
  </div>
</template>

<script setup>
import { PROGRESS_COLORS } from '@/constants/completionStatus';
</script>

<style scoped>
.legend-circle {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border-radius: 9999px;
}

.legend-circle--completed {
  background-color: var(--color-completed);
}

.legend-circle--started {
  background-color: var(--color-started);
}

.legend-circle--assigned {
  background-color: var(--color-assigned);
}
</style>
