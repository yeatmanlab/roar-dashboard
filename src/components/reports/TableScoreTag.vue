<template>
  <div
    v-if="(_get(computedScores, col.field) !== undefined || _get(computedScores, 'optional')) && col.emptyTag !== true"
    v-tooltip.right="`${returnScoreTooltip(col.header, computedScores, col.field)}`"
  >
    <PvTag
      v-if="!col.tagOutlined"
      :severity="_get(computedScores, col.severityField)"
      :value="_get(computedScores, col.field)"
      :icon="_get(colData, col.iconField)"
      :style="`background-color: ${_get(computedScores, col.tagColor)}; min-width: 2rem; ${
        returnScoreTooltip(col.header, computedScores, col.field).length > 0 &&
        'outline: 1px dotted #0000CD; outline-offset: 3px'
      }`"
      rounded
    />
    <div
      v-else-if="col.tagOutlined && _get(computedScores, col.tagColor)"
      class="circle"
      style="border: 1px solid black"
    />
  </div>
  <div v-else-if="col.emptyTag" v-tooltip.right="`${returnScoreTooltip(col.header, computedScores, col.field)}`">
    <div
      v-if="!col.tagOutlined"
      class="circle"
      :style="`background-color: ${_get(computedScores, col.tagColor)}; color: ${
        _get(computedScores, col.tagColor) === 'white' ? 'black' : 'white'
      }; ${
        returnScoreTooltip(col.header, computedScores, col.field).length > 0 &&
        'outline: 1px dotted #0000CD; outline-offset: 3px'
      }`"
    />

    <div
      v-else-if="col.tagOutlined && _get(computedScores, col.tagColor)"
      class="circle"
      :style="`border: 1px solid black; background-color: ${_get(computedScores, col.tagColor)}; color: ${
        _get(computedScores, col.tagColor) === 'white' ? 'black' : 'white'
      }; outline: 1px dotted #0000CD; outline-offset: 3px`"
    />
  </div>
</template>

<script setup>
import { defineProps, computed } from 'vue';
import _lowerCase from 'lodash/lowerCase';
import _get from 'lodash/get';
import _round from 'lodash/round';
import { rawOnlyTasks, getSupportLevel, getScoreKeys, scoredTasks } from '@/helpers/reports.js';
import { getGrade } from '@bdelab/roar-utils';
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

let returnScoreTooltip = (colHeader, colData, fieldPath) => {
  const taskId = fieldPath.split('.')[0] === 'scores' ? fieldPath.split('.')[1] : null;
  let toolTip = '';

  const headerToTaskIdMap = {
    Phoneme: 'pa',
    Word: 'swr',
    Sentence: 'sre',
    Letter: 'letter',
    Palabra: 'swr-es',
  };

  const selectedTaskId = headerToTaskIdMap[colHeader];
  if (selectedTaskId && colData.scores?.[selectedTaskId]?.support_level) {
    // Handle scored tasks
    return handleToolTip(selectedTaskId, toolTip, colData);
    // Handle raw only tasks
  } else if (taskId && !scoredTasks.includes(taskId)) {
    return handleToolTip(taskId, toolTip, colData);
  }
  return toolTip;
};

function getIndexTask(colData, task) {
  for (let index = 0; index < colData.assignment.assessments.length; index++) {
    if (colData.assignment.assessments[index].taskId === task) {
      return index;
    }
  }
}

function handleToolTip(_taskId, _toolTip, _colData) {
  // Get the support level and flags, if they exist
  _toolTip += _colData.scores?.[_taskId]?.support_level + '\n' + '\n';
  _toolTip += getFlags(getIndexTask(_colData, _taskId), _colData);

  // If the task does not have a raw score, then display no scores
  if (!_colData.scores?.[_taskId]?.raw) {
    _toolTip += 'Awaiting scores';
  }
  // If the task is in the rawOnlyTasks list, display only the raw score and that the scores are under development
  else if (rawOnlyTasks.includes(_taskId)) {
    _toolTip += 'Raw Score: ' + _colData.scores?.[_taskId]?.raw + '\n' + '\n';
    _toolTip += 'These scores are under development';
  }
  // If the task is a scored task and has a raw score, then display all scores
  else {
    _toolTip += 'Raw Score: ' + _colData.scores?.[_taskId]?.raw + '\n';
    _toolTip += 'Percentile: ' + _colData.scores?.[_taskId]?.percentile + '\n';
    _toolTip += 'Standardized Score: ' + _colData.scores?.[_taskId]?.standard + '\n';
  }
  return _toolTip;
}

function getFlags(index, colData) {
  const flags = colData.assignment.assessments[index].engagementFlags;
  const flagMessages = {
    accuracyTooLow: '- Responses were inaccurate',
    notEnoughResponses: '- Assessment was incomplete',
    responseTimeTooFast: '- Responses were too fast',
  };

  // If there are flags and the assessment is not reliable, return the flags
  if (flags && !colData.assignment.assessments[index].reliable) {
    const reliabilityFlags = Object.keys(flags).map((flag) => {
      return flagMessages[flag] || _lowerCase(flag);
    });
    // Join the returned flags with a newline character, then add two newlines for spacing
    return reliabilityFlags.join('\n') + '\n\n';
  } else {
    return '';
  }
}

function getScoreKeysByRow(row, grade) {
  const taskId = row.taskId;
  return getScoreKeys(taskId, grade);
}
const getPercentileScores = ({
  grade,
  assessment,
  percentileScoreKey,
  percentileScoreDisplayKey,
  rawScoreKey,
  taskId,
  optional,
}) => {
  let percentile = _get(assessment, `scores.computed.composite.${percentileScoreKey}`);
  let percentileString = _get(assessment, `scores.computed.composite.${percentileScoreDisplayKey}`);
  let raw = _get(assessment, `scores.computed.composite.${rawScoreKey}`);
  const { support_level, tag_color } = getSupportLevel(grade, percentile, raw, taskId, optional);
  if (percentile) percentile = _round(percentile);
  if (percentileString && !isNaN(_round(percentileString))) percentileString = _round(percentileString);

  return {
    support_level,
    tag_color,
    percentile,
    percentileString,
  };
};

// this function light out color if assessment is not reliable
function colorSelection(assessment, rawScore, support_level, tag_color) {
  if (assessment.reliable !== undefined && !assessment.reliable && assessment.engagementFlags !== undefined) {
    if (support_level === 'Optional') {
      return '#a1d8e3';
    } else if (support_level === 'Needs Extra Support') {
      return '#d6b8c7';
    } else if (support_level === 'Developing Skill') {
      return '#e8dbb5';
    } else if (support_level === 'Achieved Skill') {
      return '#c0d9bd';
    } else if (rawOnlyTasks.includes(assessment.taskId) && rawScore) {
      return 'white';
    }
  }
  return tag_color;
}

const computedScores = computed(() => {
  const grade = getGrade(_get(props.colData.user, 'studentData.grade'));
  const scores = {};
  for (const assessment of props.colData.assignment?.assessments ?? []) {
    const { percentileScoreKey, rawScoreKey, percentileScoreDisplayKey, standardScoreDisplayKey } = getScoreKeysByRow(
      assessment,
      grade,
    );
    const { percentileString, support_level, tag_color } = getPercentileScores({
      grade,
      assessment,
      percentileScoreKey,
      percentileScoreDisplayKey,
      rawScoreKey,
      taskId: assessment.taskId,
      optional: assessment.optional,
    });
    const standardScore = _get(assessment, `scores.computed.composite.${standardScoreDisplayKey}`);
    const rawScore = rawOnlyTasks.includes(assessment.taskId)
      ? _get(assessment, 'scores.computed.composite')
      : _get(assessment, `scores.computed.composite.${rawScoreKey}`);
    const color = colorSelection(assessment, rawScore, support_level, tag_color);
    scores[assessment.taskId] = {
      percentile: percentileString,
      standard: standardScore,
      raw: rawScore,
      support_level,
      color: color,
      optional: assessment.optional,
    };
  }
  return { ...props.colData, scores: scores };
});
</script>

<style>
.circle {
  border-color: white;
  display: inline-block;
  border-radius: 50%;
  border-width: 5px;
  height: 25px;
  width: 25px;
  vertical-align: middle;
  margin-right: 10px;
  margin-left: 10px;
  margin-top: 5px;
  margin-bottom: 5px;
}
</style>
