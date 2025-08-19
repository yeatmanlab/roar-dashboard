<template>
  <div
    v-if="(_get(colData, col.field) != undefined || _get(colData, 'optional')) && col.emptyTag !== true"
    v-tooltip.right="`${returnScoreTooltip(colData, col.field)}`"
  >
    <PvTag
      :value="_get(colData, col.field)"
      :style="`background-color: ${_get(colData, col.tagColor, '#74797f')}; min-width: 2rem; 
      ${
        returnScoreTooltip(colData, col.field)?.length > 0 &&
        'outline: 1px dotted #0000CD; outline-offset: 3px; margin: 7px'
      };
      font-weight: bold;
      color: ${_get(colData, col.tagColor) === '#A4DDED' ? 'black' : 'white'};
      `"
      rounded
    />
  </div>
  <div v-else-if="col.emptyTag" v-tooltip.right="`${returnScoreTooltip(colData, col.field)}`">
    <div
      class="circle"
      :style="`background-color: ${_get(colData, col.tagColor)}; color: ${
        _get(colData, col.tagColor) === '#A4DDED' ? 'black' : 'white'
      }; ${returnScoreTooltip(colData, col.field)?.length > 0 && 'outline: 1px dotted #0000CD; outline-offset: 3px'}`"
    />
  </div>
</template>

<script setup>
import _get from 'lodash/get';
import _lowerCase from 'lodash/lowerCase';
import PvTag from 'primevue/tag';
import {
  tasksToDisplayPercentCorrect,
  tasksToDisplayCorrectIncorrectDifference,
  tasksToDisplayTotalCorrect,
  tasksToDisplayThetaScore,
  rawOnlyTasks,
  scoredTasks,
  subskillTasks,
} from '@/helpers/reports.js';
import { taskDisplayNames } from '@/helpers/reports';
import { includedValidityFlags } from '@/helpers/reports';

defineProps({
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

let returnScoreTooltip = (colData, fieldPath) => {
  const pathSegments = fieldPath.split('.');
  const taskId = pathSegments[0] === 'scores' ? pathSegments[1] : null;
  // Subskill fieldPaths are formatted as scores.taskId.subskillId[property]
  const subskillId = pathSegments.length > 3 ? pathSegments[2] : null;
  let toolTip = '';

  if (subskillTasks.includes(taskId) && subskillId) {
    if (taskId === 'roam-alpaca' && subskillId === 'composite' && pathSegments[3] === 'incorrectSkills') {
      return toolTip;
    }
    return handleSubskillToolTip(taskId, subskillId, toolTip, colData);
  } else if (colData.scores[taskId]?.supportLevel || (taskId && !scoredTasks.includes(taskId))) {
    // Handle raw only tasks or scored tasks
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
  // if score exists
  if (
    _colData.scores?.[_taskId]?.rawScore != undefined ||
    _colData.scores?.[_taskId]?.percentCorrect ||
    _colData.scores?.[_taskId]?.correctIncorrectDifference ||
    _colData.scores?.[_taskId]?.numAttempted ||
    _colData.scores?.[_taskId]?.thetaEstimate ||
    _colData.scores?.[_taskId]?.numCorrect ||
    _colData.scores?.[_taskId]?.numIncorrect
  ) {
    if (tasksToDisplayCorrectIncorrectDifference.includes(_taskId)) {
      _toolTip += 'Num Correct: ' + _colData.scores?.[_taskId]?.numCorrect + '\n';
      _toolTip += 'Num Incorrect: ' + _colData.scores?.[_taskId]?.numIncorrect + '\n';
      _toolTip += 'Correct - Incorrect: ' + _colData.scores?.[_taskId]?.correctIncorrectDifference + '\n';
    } else if (tasksToDisplayTotalCorrect.includes(_taskId)) {
      if (_colData.scores?.[_taskId]?.numCorrect === undefined) {
        _toolTip += 'Num Correct: ' + 0 + '\n';
        _toolTip += 'Num Attempted: ' + _colData.scores?.[_taskId]?.numAttempted + '\n';
      } else {
        _toolTip += 'Num Correct: ' + _colData.scores?.[_taskId]?.numCorrect + '\n';
        _toolTip += 'Num Attempted: ' + _colData.scores?.[_taskId]?.numAttempted + '\n';
      }
    } else if (tasksToDisplayPercentCorrect.includes(_taskId)) {
      _toolTip += 'Num Correct: ' + _colData.scores?.[_taskId]?.numCorrect + '\n';
      _toolTip += 'Num Attempted: ' + _colData.scores?.[_taskId]?.numAttempted + '\n';
      _toolTip += 'Percent Correct: ' + _colData.scores?.[_taskId]?.percentCorrect + '\n';
    } else if (tasksToDisplayThetaScore.includes(_taskId)) {
      if (_colData.scores?.[_taskId]?.numCorrect === undefined) {
        _toolTip += 'Num Correct: ' + 0 + '\n';
        _toolTip += 'Num Incorrect: ' + _colData.scores?.[_taskId]?.numIncorrect + '\n';
      } else {
        _toolTip += 'Num Correct: ' + _colData.scores?.[_taskId]?.numCorrect + '\n';
        _toolTip += 'Num Incorrect: ' + _colData.scores?.[_taskId]?.numIncorrect + '\n';
      }
      if (_colData.scores?.[_taskId]?.thetaEstimate && _colData.scores?.[_taskId]?.thetaEstimate !== '') {
        _toolTip += 'Grade Estimate: ' + _colData.scores?.[_taskId]?.thetaEstimate + '\n';
      }
    } else if (rawOnlyTasks.includes(_taskId) && _colData.scores?.[_taskId]?.rawScore !== undefined) {
      _toolTip += 'Raw Score: ' + _colData.scores?.[_taskId]?.rawScore + '\n';
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

function handleSubskillToolTip(_taskId, _subskillId, _toolTip, _colData) {
  const subskillInfo = _colData.scores?.[_taskId]?.[_subskillId];
  const fluencyTasks = ['fluency-arf', 'fluency-calf', 'fluency-arf-es', 'fluency-calf-es'];
  if (_taskId === 'roam-alpaca') {
    if (subskillInfo?.supportCategory) {
      _toolTip += subskillInfo?.supportCategory + '\n' + '\n';
      _toolTip += getFlags(_colData, _taskId);
    }
    _toolTip += 'Num Correct: ' + subskillInfo?.rawScore + '\n';
    _toolTip += 'Num Attempted: ' + subskillInfo?.totalNumAttempted + '\n';
    if (subskillInfo?.gradeEstimate) {
      _toolTip += 'Grade Estimate: ' + subskillInfo?.gradeEstimate + '\n';
    }
  } else if (fluencyTasks.includes(_taskId)) {
    _toolTip += 'Raw Score: ' + subskillInfo?.rawScore + '\n';
    _toolTip += 'Num Correct: ' + subskillInfo?.totalCorrect + '\n';
    _toolTip += 'Num Incorrect: ' + subskillInfo?.totalIncorrect + '\n';
    _toolTip += 'Num Attempted: ' + subskillInfo?.totalNumAttempted + '\n';
  }

  return _toolTip;
}

function getFlags(colData, taskId) {
  const flags = colData.scores[taskId]?.engagementFlags;
  const flagMessages = {
    accuracyTooLow: 'Responses were inaccurate',
    notEnoughResponses: `Incomplete. This student may retake ${
      taskDisplayNames[taskId]?.extendedTitle || 'the assessment'
    }`,
    responseTimeTooFast: 'Responses were too fast',
    incomplete: `Incomplete. This student may retake ${taskDisplayNames[taskId]?.extendedTitle || 'the assessment'}`,
  };

  // If there are flags and the assessment is not reliable, return the flags
  if (flags && !colData.scores[taskId].reliable) {
    if (includedValidityFlags[taskId]) {
      // only display flags that are included in the includedValidityFlags object
      const filteredFlags = Object.keys(flags).filter((flag) => includedValidityFlags[taskId].includes(flag));
      const reliabilityFlags = filteredFlags.map((flag) => {
        return flagMessages[flag] || _lowerCase(flag);
      });
      if (reliabilityFlags.length === 0) return '';
      return 'Unreliable Score' + '\n' + ' - ' + reliabilityFlags.join('\n - ') + '\n\n';
    } else {
      const reliabilityFlags = Object.keys(flags).map((flag) => {
        return flagMessages[flag] || _lowerCase(flag);
      });
      if (reliabilityFlags.length > 0) {
        // Join the returned flags with a newline character, then add two newlines for spacing
        return 'Unreliable Score: ' + '\n' + reliabilityFlags.join('\n') + '\n\n';
      }
      return '';
    }
  } else {
    return '';
  }
}
</script>
