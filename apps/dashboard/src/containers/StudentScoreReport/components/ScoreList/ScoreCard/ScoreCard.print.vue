<template>
  <div class="p-3 mb-4 text-sm rounded border border-gray-200 border-solid break-inside-avoid">
    <div class="flex justify-between align-items-center">
      <h2 class="m-0 text-lg font-semibold">{{ publicName }}</h2>
      <div class="flex gap-2 text-sm border-collapse">
        <PvTag
          v-for="tag in tags"
          :key="tag.value"
          v-tooltip.top="tag.tooltip"
          :icon="tag.icon"
          :value="tag.value"
          :severity="tag.severity"
          class="text-xs"
        />
      </div>
    </div>

    <div class="pt-3 mt-3 border-t border-gray-200 text-xs">
      <div class="flex gap-2 align-items-center">
        <span class="text-base font-semibold whitespace-nowrap" :style="{ color: score.supportColor }">
          {{ scoreLabel }}: {{ getFromScoreValueTemplate(score.value) }}
        </span>
        <div class="progress-chart flex-1">
          <canvas v-if="showCanvas" ref="canvasRef" class="w-full h-full"></canvas>
          <img
            v-else
            :src="chartImgSrc"
            class="w-full progress-chart-img"
            style="object-fit: fill"
            alt="Score progress chart"
          />
        </div>
      </div>
      <i18n-t :keypath="description.keypath" tag="p" class="mb-0">
        <template #firstName>{{ studentFirstName }}</template>
        <template v-for="(_, slotName) in description.slots" #[slotName] :key="slotName">
          <template v-if="slotName === 'taskDescription'">
            {{ description.slots[slotName] }}
          </template>
          <strong v-else>{{ description.slots[slotName] }}</strong>
        </template>
      </i18n-t>

      <h3 class="mt-3 text-xs font-semibold uppercase">{{ $t('scoreReports.scoreBreakdown') }}</h3>
      <table class="w-full border-collapse">
        <thead>
          <tr>
            <th class="px-2 py-1 font-semibold text-left border border-gray-300 border-solid">Metric</th>
            <th class="px-2 py-1 font-semibold text-left border border-gray-300 border-solid">Score</th>
            <th class="px-2 py-1 font-semibold text-left border border-gray-300 border-solid">Range</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="[key, rawScore, rangeMin, rangeMax] in scoresArray" :key="key">
            <template v-if="!isNaN(rawScore)">
              <td class="px-2 py-1 border border-gray-300 border-solid">{{ key }}</td>

              <td class="px-2 py-1 font-bold border border-gray-300 border-solid">
                {{ isNaN(rawScore) ? rawScore : Math.round(rawScore) }}
              </td>

              <td class="px-2 py-1 border border-gray-300 border-solid">{{ rangeMin }}-{{ rangeMax }}</td>
            </template>
          </tr>
        </tbody>
      </table>

      <template v-if="FEATURE_FLAGS.ENABLE_LONGITUDINAL_REPORTS">
        <h3 class="mt-4 text-xs font-semibold uppercase">{{ $t('scoreReports.progressOverTime') }}</h3>
        <LongitudinalChart
          :longitudinal-data="longitudinalData"
          :task-id="taskId"
          :student-grade="studentGrade"
          :current-assignment-id="currentAssignmentId"
        />
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import Chart from 'chart.js/auto';
import { LongitudinalChartPrint as LongitudinalChart } from './LongitudinalChart';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import {
  setIndividualScoreReportPrintChartData,
  setIndividualScoreReportPrintChartOptions,
} from '@/containers/StudentScoreReport/helpers/charts';
import PvTag from 'primevue/tag';

const props = defineProps({
  publicName: {
    type: String,
    required: true,
  },
  scoreLabel: {
    type: String,
    required: true,
  },
  score: {
    type: Object,
    required: true,
    validator: (value) => {
      return (
        typeof value === 'object' &&
        value !== null &&
        ('value' in value || 'supportColor' in value || 'min' in value || 'max' in value || 'subscores' in value)
      );
    },
  },
  tags: {
    type: Array,
    required: true,
  },
  valueTemplate: {
    type: String,
    required: false,
    default: undefined,
  },
  scoreToDisplay: {
    type: String,
    required: true,
  },
  studentFirstName: {
    type: String,
    required: true,
  },
  studentGrade: {
    type: String,
    required: true,
  },
  description: {
    type: Object,
    required: true,
  },
  scoresArray: {
    type: Array,
    required: true,
  },
  longitudinalData: {
    type: Array,
    required: false,
    default: () => [],
  },
  taskId: {
    type: String,
    required: true,
  },
  currentAssignmentId: {
    type: String,
    required: true,
  },
});

/**
 * Returns the formatted score value based on the value template.
 *
 * In the web view, this is handled automatically by the PrimeVue knob component but requires manual handling in the
 * print view.
 *
 * @param {number} scoreValue – The score value to be formatted
 * @returns {string} The formatted score value
 */
const getFromScoreValueTemplate = (scoreValue) => {
  if (props.valueTemplate) {
    return props.valueTemplate.replace('{value}', scoreValue);
  }

  return scoreValue;
};

// Chart rendering for print
const canvasRef = ref(null);
let chartInstance = null;
const showCanvas = ref(true);
const chartImgSrc = ref('');

async function renderThenSnapshot() {
  // Render the chart
  const ctx = canvasRef.value?.getContext('2d');
  if (!ctx) return;
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  // Call helper functions with current prop values
  const data = setIndividualScoreReportPrintChartData(props.score, props.scoreLabel);
  const options = setIndividualScoreReportPrintChartOptions(props.score.min, props.score.max);

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data,
    options,
  });

  // Ensure it has painted at least once before snapshotting
  await nextTick();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  // Snapshot to data URL and swap to <img>
  const url = chartInstance.toBase64Image('image/png', 1); // full quality
  chartImgSrc.value = url;
  showCanvas.value = false;

  // Cleanup
  chartInstance.destroy();
  chartInstance = null;
}

onMounted(renderThenSnapshot);
onBeforeUnmount(() => {
  chartInstance?.destroy();
  chartInstance = null;
});
</script>

<style scoped>
.progress-chart {
  height: 1.25rem;
}

.progress-chart-img {
  height: 2rem;
}
</style>
