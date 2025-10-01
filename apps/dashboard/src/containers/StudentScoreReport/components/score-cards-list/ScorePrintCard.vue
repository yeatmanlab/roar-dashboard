<template>
  <div class="p-4 mb-4 rounded border border-gray-200 border-solid">
    <div class="flex justify-between align-items-center">
      <h2 class="m-0 text-lg font-semibold">{{ publicName }}</h2>

      <table class="mt-1 text-sm border-collapse sm:mt-0">
        <tbody>
          <!-- TODO: Add severity color indicator -->
          <tr v-for="tag in tags" :key="tag.value">
            <td class="pr-2 font-medium text-right">{{ tag.label }}:</td>
            <td>{{ tag.value }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="py-3 mt-3 border-t border-gray-200">
      <div>
        <span class="font-semibold">{{ scoreLabel }}:</span>
        <span class="font-semibold" :style="{ color: score.supportColor }">{{ score.value }}</span>
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

      <h3 class="mt-4 text-xs font-semibold uppercase">{{ $t('scoreReports.scoreBreakdown') }}</h3>
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
    </div>
  </div>
</template>

<script setup>
defineProps({
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
  expanded: {
    type: Boolean,
    required: false,
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
});
</script>
