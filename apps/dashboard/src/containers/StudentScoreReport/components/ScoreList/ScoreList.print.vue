<template>
  <div class="text-sm break-inside-avoid">
    <h2 class="text-lg font-bold">Detailed Assessment Results</h2>

    <ul class="p-0 m-0">
      <li v-for="task in computedTaskData" :key="task.taskId" class="list-none">
        <ScoreCard
          :public-name="tasksDictionary[task.taskId]?.nameSimple ?? task.taskId"
          :score-label="getScoreLabel(task[task.scoreToDisplay].name)"
          :score="task[task.scoreToDisplay]"
          :tags="task.tags"
          :value-template="scoreValueTemplate(task)"
          :score-to-display="task.scoreToDisplay"
          :student-first-name="studentFirstName"
          :description="getTaskDescription(task)"
          :scores-array="getTaskScoresArray(task)"
          :longitudinal-data="task.historicalScores"
          :task-id="task.taskId"
          :student-grade="studentGrade"
          :current-assignment-id="currentAssignmentId"
          :task-scoring-version="taskScoringVersions?.[task.taskId]"
        />
      </li>
    </ul>
    <div class="text-xs">
      <h2 class="text-lg font-bold">{{ $t('scoreReports.nextStepsTabHeader') }}</h2>
      <i18n-t keypath="scoreReports.nextSteps" tag="p" class="mt-0">
        <template #link> : {{ getScoreReportNextStepsDocumentPath() }} </template>
      </i18n-t>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ScoreCardPrint as ScoreCard } from './ScoreCard';
import { useReportCardData } from './useReportCardData';
import { SCORE_REPORT_NEXT_STEPS_DOCUMENT_PATH } from '@/constants/scores';

const props = defineProps({
  studentFirstName: {
    type: String,
    required: true,
  },
  studentGrade: {
    type: String,
    required: true,
  },
  tasksDictionary: {
    type: Object,
    required: true,
  },
  taskScoringVersions: {
    type: Object,
    required: true,
  },
  currentAssignmentId: {
    type: String,
    required: true,
  },
  // Backend-computed report tasks for both the administrator and parent paths; the card
  // data comes from the backend (client scoring retired).
  reportTasks: {
    type: Array,
    required: false,
    default: null,
  },
});

const { t } = useI18n();

const backend = useReportCardData({
  reportTasks: () => props.reportTasks,
  studentGrade: props.studentGrade,
  taskScoringVersions: props.taskScoringVersions,
  t,
});

const { computedTaskData } = backend;
const scoreValueTemplate = (task) => backend.scoreValueTemplate.value(task);
const getTaskDescription = (task) => backend.getTaskDescription.value(task);
const getTaskScoresArray = (task) => backend.getTaskScoresArray.value(task);

/**
 * Returns the URL of the next steps document
 *
 * @returns {string} The URL of the next steps document based on the current origin
 */
function getScoreReportNextStepsDocumentPath() {
  return `${document.location.origin}${SCORE_REPORT_NEXT_STEPS_DOCUMENT_PATH}`;
}

/**
 * Returns shortened score label
 *
 * @returns {string} Returns abbreviated score label
 */
const getScoreLabel = (taskName) => {
  return taskName === 'Percent Correct' ? 'Correct' : taskName;
};
</script>
