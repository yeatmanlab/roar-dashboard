<template>
  <div
    v-if="(_get(colData, col.field) !== undefined || _get(colData, 'optional')) && col.emptyTag !== true"
    v-tooltip.right="`${returnScoreTooltip(col.header, colData, col.field)}`"
  >
    <PvTag
      v-if="!col.tagOutlined && _get(colData, col.field)"
      :value="_get(colData, col.field)"
      :style="`background-color: ${_get(colData, col.tagColor)}; min-width: 2rem; ${
        returnScoreTooltip(col.header, colData, col.field).length > 0 &&
        'outline: 1px dotted #0000CD; outline-offset: 3px'
      }`"
      rounded
    />
    <div v-else-if="col.tagOutlined && _get(colData, col.tagColor)" class="circle" style="border: 1px solid black" />
  </div>
  <div v-else-if="col.emptyTag" v-tooltip.right="`${returnScoreTooltip(col.header, colData, col.field)}`">
    <div
      v-if="!col.tagOutlined"
      class="circle"
      :style="`background-color: ${_get(colData, col.tagColor)}; color: ${
        _get(colData, col.tagColor) === 'white' ? 'black' : 'white'
      }; ${
        returnScoreTooltip(col.header, colData, col.field).length > 0 &&
        'outline: 1px dotted #0000CD; outline-offset: 3px'
      }`"
    />

    <div
      v-else-if="col.tagOutlined && _get(colData, col.tagColor)"
      class="circle"
      :style="`border: 1px solid black; background-color: ${_get(colData, col.tagColor)}; color: ${
        _get(colData, col.tagColor) === 'white' ? 'black' : 'white'
      }; outline: 1px dotted #0000CD; outline-offset: 3px`"
    />
  </div>
</template>

<script setup>
import { defineProps } from 'vue';
import _get from 'lodash/get';
import _lowerCase from 'lodash/lowerCase';
import { rawOnlyTasks, scoredTasks } from '@/helpers/reports.js';

const props = defineProps({
  colData: {
    type: Object,
    default: () => ({}),
    required: false,
  },
  col: {
    type: Object,
    default: () => ({}),
    required: false,
  },
});

let returnScoreTooltip = (colHeader, colData, fieldPath) => {
  const taskId = fieldPath.split('.')[0] === 'scores' ? fieldPath.split('.')[1] : null;
  let toolTip = '';

  if (colData.scores[taskId]?.supportLevel) {
    // Handle scored tasks
    return handleToolTip(taskId, toolTip, colData);
    // Handle raw only tasks
  } else if (taskId && !scoredTasks.includes(taskId)) {
    return handleToolTip(taskId, toolTip, colData);
  }
  return toolTip;
};

function handleToolTip(_taskId, _toolTip, _colData) {
  // Get the support level and flags, if they exist
  if (_colData.scores?.[_taskId]?.supportLevel) {
    _toolTip += _colData.scores?.[_taskId]?.supportLevel + '\n' + '\n';
    _toolTip += getFlags(_colData, _taskId);
  }

  // If the task does not have a raw score, then display no scores
  if (_colData.scores?.[_taskId]?.rawScore) {
    if (rawOnlyTasks.includes(_taskId)) {
      _toolTip += 'Raw Score: ' + _colData.scores?.[_taskId]?.rawScore + '\n' + '\n';
      _toolTip += 'These scores are under development';
    } else {
      _toolTip += 'Raw Score: ' + _colData.scores?.[_taskId]?.rawScore + '\n';
      _toolTip += 'Percentile: ' + _colData.scores?.[_taskId]?.percentile + '\n';
      _toolTip += 'Standardized Score: ' + _colData.scores?.[_taskId]?.standardScore + '\n';
    }
  }
  // If the task is in the rawOnlyTasks list, display only the raw score and that the scores are under development
  // If the task is a scored task and has a raw score, then display all scores
  return _toolTip;
}

function getFlags(colData, taskId) {
  const flags = colData.scores[taskId]?.engagementFlags;
  const flagMessages = {
    accuracyTooLow: '- Responses were inaccurate',
    notEnoughResponses: '- Assessment was incomplete',
    responseTimeTooFast: '- Responses were too fast',
  };

  // If there are flags and the assessment is not reliable, return the flags
  if (flags && !colData.scores[taskId].reliable) {
    const reliabilityFlags = Object.keys(flags).map((flag) => {
      return flagMessages[flag] || _lowerCase(flag);
    });
    // Join the returned flags with a newline character, then add two newlines for spacing
    return reliabilityFlags.join('\n') + '\n\n';
  } else {
    return '';
  }
}
</script>
