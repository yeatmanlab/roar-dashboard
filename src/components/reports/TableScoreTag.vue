<template>
  <div
    v-if="
      (_get(colData, col.field) != undefined || _get(colData, 'optional')) &&
      col.emptyTag !== true
    "
    v-tooltip.right="`${returnScoreTooltip(colData, col.field)}`"
  >
    <PvTag
      :value="_get(colData, col.field)"
      :style="`background-color: ${_get(
        colData,
        col.tagColor,
      )}; min-width: 2rem; 
        ${
          returnScoreTooltip(colData, col.field)?.length > 0 &&
          'outline: 1px dotted #0000CD; outline-offset: 3px'
        };
        font-weight: bold;
        color: ${_get(colData, col.tagColor) === '#A4DDED' ? 'black' : 'white'};
        `"
      rounded
    />
  </div>
  <div
    v-else-if="col.emptyTag"
    v-tooltip.right="`${returnScoreTooltip(colData, col.field)}`"
  >
    <div
      class="circle"
      :style="`background-color: ${_get(colData, col.tagColor)}; color: ${
        _get(colData, col.tagColor) === '#A4DDED' ? 'black' : 'white'
      }; ${
        returnScoreTooltip(colData, col.field)?.length > 0 &&
        'outline: 1px dotted #0000CD; outline-offset: 3px'
      }`"
    />
  </div>
</template>

<script setup>
import _get from "lodash/get";
import _lowerCase from "lodash/lowerCase";
import PvTag from "primevue/tag";
import {
  tasksToDisplayPercentCorrect,
  tasksToDisplayCorrectIncorrectDifference,
  tasksToDisplayTotalCorrect,
  rawOnlyTasks,
  scoredTasks,
  includedValidityFlags,
} from "@/helpers/reports";

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
  const taskId =
    fieldPath.split(".")[0] === "scores" ? fieldPath.split(".")[1] : null;
  let toolTip = "";

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
    _toolTip += _colData.scores?.[_taskId]?.supportLevel + "\n" + "\n";
    _toolTip += getFlags(_colData, _taskId);
  }

  // If the task does not have a raw score, then display no scores
  // if score exists
  if (
    _colData.scores?.[_taskId]?.rawScore != undefined ||
    _colData.scores?.[_taskId]?.percentCorrect ||
    _colData.scores?.[_taskId]?.correctIncorrectDifference ||
    _colData.scores?.[_taskId]?.numAttempted
  ) {
    if (tasksToDisplayCorrectIncorrectDifference.includes(_taskId)) {
      _toolTip +=
        "Num Correct: " + _colData.scores?.[_taskId]?.numCorrect + "\n";
      _toolTip +=
        "Num Incorrect: " + _colData.scores?.[_taskId]?.numIncorrect + "\n";
      _toolTip +=
        "Correct - Incorrect: " +
        _colData.scores?.[_taskId]?.correctIncorrectDifference +
        "\n";
    } else if (tasksToDisplayTotalCorrect.includes(_taskId)) {
      if (_colData.scores?.[_taskId]?.numCorrect === undefined) {
        _toolTip += "Num Correct: " + 0 + "\n";
        _toolTip +=
          "Num Attempted: " + _colData.scores?.[_taskId]?.numAttempted + "\n";
      } else {
        _toolTip +=
          "Num Correct: " + _colData.scores?.[_taskId]?.numCorrect + "\n";
        _toolTip +=
          "Num Attempted: " + _colData.scores?.[_taskId]?.numAttempted + "\n";
      }
    } else if (tasksToDisplayPercentCorrect.includes(_taskId)) {
      _toolTip +=
        "Num Correct: " + _colData.scores?.[_taskId]?.numCorrect + "\n";
      _toolTip +=
        "Num Attempted: " + _colData.scores?.[_taskId]?.numAttempted + "\n";
      _toolTip +=
        "Percent Correct: " + _colData.scores?.[_taskId]?.percentCorrect + "\n";
    } else if (
      rawOnlyTasks.includes(_taskId) &&
      _colData.scores?.[_taskId]?.rawScore !== undefined
    ) {
      _toolTip += "Raw Score: " + _colData.scores?.[_taskId]?.rawScore + "\n";
    } else {
      _toolTip += "Raw Score: " + _colData.scores?.[_taskId]?.rawScore + "\n";
      _toolTip +=
        "Percentile: " + _colData.scores?.[_taskId]?.percentile + "\n";
      _toolTip +=
        "Standardized Score: " +
        _colData.scores?.[_taskId]?.standardScore +
        "\n";
    }
  }
  // If the task is in the rawOnlyTasks list, display only the raw score and that the scores are under development
  // If the task is a scored task and has a raw score, then display all scores
  return _toolTip;
}

function getFlags(colData, taskId) {
  const flags = colData.scores[taskId]?.engagementFlags;
  const flagMessages = {
    accuracyTooLow: "- Responses were inaccurate",
    notEnoughResponses: "- Assessment was incomplete",
    responseTimeTooFast: "- Responses were too fast",
  };

  // If there are flags and the assessment is not reliable, return the flags
  if (flags && !colData.scores[taskId].reliable) {
    if (includedValidityFlags[taskId]) {
      // only display flags that are included in the includedValidityFlags object
      const filteredFlags = Object.keys(flags).filter((flag) =>
        includedValidityFlags[taskId].includes(flag),
      );
      const reliabilityFlags = filteredFlags.map((flag) => {
        return flagMessages[flag] || _lowerCase(flag);
      });
      if (reliabilityFlags.length === 0) return "";
      return "Unreliable Score" + "\n" + reliabilityFlags.join("\n") + "\n\n";
    } else {
      const reliabilityFlags = Object.keys(flags).map((flag) => {
        return flagMessages[flag] || _lowerCase(flag);
      });
      if (reliabilityFlags.length > 0) {
        // Join the returned flags with a newline character, then add two newlines for spacing
        return (
          "Unreliable Score: " + "\n" + reliabilityFlags.join("\n") + "\n\n"
        );
      }
      return "";
    }
  } else {
    return "";
  }
}
</script>
