<template>
    <div
      v-if="(_get(colData, col.field) != undefined || _get(colData, 'optional')) && col.emptyTag !== true"
      v-tooltip.right="`${returnScoreTooltip(colData, col.field)}`"
    >
      <PvTag
        :value="_get(colData, col.field)"
        :style="`background-color: ${_get(colData, col.tagColor)}; min-width: 2rem; 
        ${returnScoreTooltip(colData, col.field)?.length > 0 && 'outline: 1px dotted #0000CD; outline-offset: 3px'};
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
  
  <script setup lang="ts">
  import { computed } from 'vue';
  import type { ComputedRef } from 'vue';
  import _get from 'lodash/get';
  import _lowerCase from 'lodash/lowerCase';
  import PvTag from 'primevue/tag';
  
  // --- Interfaces ---
  interface ScoreData {
    supportLevel?: string;
    rawScore?: number;
    percentCorrect?: number;
    correctIncorrectDifference?: number;
    numAttempted?: number;
    numCorrect?: number;
    numIncorrect?: number;
    percentile?: number;
    standardScore?: number;
    reliable?: boolean;
    engagementFlags?: Record<string, boolean>;
  }

  interface ColData {
    scores: Record<string, ScoreData>;
    optional?: boolean; 
    tagColor?: string;
    [key: string]: any; // Allow other properties
  }

  interface Col {
    field: string;
    emptyTag?: boolean;
    [key: string]: any; // Allow other properties
  }

  interface Props {
    colData: ColData;
    col: Col;
  }

  // --- Props ---
  const props = defineProps<Props>();
  
  // --- Constants (from previous context/assumed) ---
  // These would need to be defined or imported based on actual project structure
  const scoredTasks: string[] = [/* ... list of scored task IDs ... */]; 
  const tasksToDisplayCorrectIncorrectDifference: string[] = [/* ... list ... */];
  const tasksToDisplayTotalCorrect: string[] = [/* ... list ... */];
  const tasksToDisplayPercentCorrect: string[] = [/* ... list ... */];
  const rawOnlyTasks: string[] = [/* ... list ... */];
  const includedValidityFlags: Record<string, string[]> = { /* ... mapping ... */ };

  // --- Functions ---
  function returnScoreTooltip(colData: ColData, fieldPath: string): string {
    const pathParts = fieldPath.split('.');
    const taskId = pathParts[0] === 'scores' ? pathParts[1] : null;
    let toolTip: string = '';
  
    if (!taskId) return toolTip;
    
    const score = colData.scores[taskId];

    if (score?.supportLevel) {
      return handleToolTip(taskId, toolTip, colData);
    } else if (!scoredTasks.includes(taskId)) {
      // Handle raw only tasks or tasks without supportLevel
      return handleToolTip(taskId, toolTip, colData);
    }
    return toolTip;
  }
  
  function handleToolTip(taskId: string, toolTip: string, colData: ColData): string {
    let currentToolTip = toolTip;
    const score = colData.scores?.[taskId];

    if (!score) return currentToolTip;

    if (score.supportLevel) {
      currentToolTip += score.supportLevel + '\n\n';
      currentToolTip += getFlags(colData, taskId);
    }
  
    if (
      score.rawScore !== undefined ||
      score.percentCorrect !== undefined ||
      score.correctIncorrectDifference !== undefined ||
      score.numAttempted !== undefined
    ) {
      if (tasksToDisplayCorrectIncorrectDifference.includes(taskId)) {
        currentToolTip += `Num Correct: ${score.numCorrect ?? 0}\n`;
        currentToolTip += `Num Incorrect: ${score.numIncorrect ?? 0}\n`;
        currentToolTip += `Correct - Incorrect: ${score.correctIncorrectDifference ?? 'N/A'}\n`;
      } else if (tasksToDisplayTotalCorrect.includes(taskId)) {
          currentToolTip += `Num Correct: ${score.numCorrect ?? 0}\n`;
          currentToolTip += `Num Attempted: ${score.numAttempted ?? 0}\n`;
      } else if (tasksToDisplayPercentCorrect.includes(taskId)) {
        currentToolTip += `Num Correct: ${score.numCorrect ?? 0}\n`;
        currentToolTip += `Num Attempted: ${score.numAttempted ?? 0}\n`;
        currentToolTip += `Percent Correct: ${score.percentCorrect ?? 'N/A'}\n`;
      } else if (rawOnlyTasks.includes(taskId) && score.rawScore !== undefined) {
        currentToolTip += `Raw Score: ${score.rawScore}\n`;
      } else if (score.rawScore !== undefined) { // Fallback for scored tasks with raw score
        currentToolTip += `Raw Score: ${score.rawScore}\n`;
        if (score.percentile !== undefined) currentToolTip += `Percentile: ${score.percentile}\n`;
        if (score.standardScore !== undefined) currentToolTip += `Standardized Score: ${score.standardScore}\n`;
      }
    }
    return currentToolTip;
  }
  
  function getFlags(colData: ColData, taskId: string): string {
    const score = colData.scores?.[taskId];
    if (!score || !score.engagementFlags || score.reliable) return '';

    const flags = score.engagementFlags;
    const flagMessages: Record<string, string> = {
      accuracyTooLow: '- Responses were inaccurate',
      notEnoughResponses: '- Assessment was incomplete',
      responseTimeTooFast: '- Responses were too fast',
    };
  
    const relevantFlags = includedValidityFlags[taskId] 
        ? Object.keys(flags).filter(flag => includedValidityFlags[taskId].includes(flag) && flags[flag])
        : Object.keys(flags).filter(flag => flags[flag]);

    if (relevantFlags.length === 0) return '';

    const reliabilityMessages = relevantFlags.map(flag => flagMessages[flag] || _lowerCase(flag));
    return `Unreliable Score\n${reliabilityMessages.join('\n')}\n\n`;
  }
  </script>
  
  <style scoped>
  .circle {
    width: 1.5rem; /* Adjust size as needed */
    height: 1.5rem;
    border-radius: 50%;
    display: inline-block;
    vertical-align: middle;
    /* Add other styles if needed, like border */
  }
  </style>
