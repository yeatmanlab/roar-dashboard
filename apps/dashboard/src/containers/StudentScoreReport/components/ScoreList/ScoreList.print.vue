<template>
  <div class="text-sm break-inside-avoid">
    <h2 class="text-lg font-bold">Detailed Assessment Results</h2>

    <ul class="p-0 m-0">
      <li v-for="task in computedTaskData" :key="task.taskId" class="list-none">
        <ScoreCard
          :public-name="tasksDictionary[task.taskId]?.publicName ?? task.taskId"
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
import { useScoreListData } from './useScoreListData';
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
  taskData: {
    type: Object,
    required: true,
  },
  tasksDictionary: {
    type: Object,
    required: true,
  },
  longitudinalData: {
    type: Object,
    required: false,
    default: () => ({}),
  },
  taskScoringVersions: {
    type: Object,
    required: true,
  },
});

const { t } = useI18n();

/**
 * Process task data into computed task data for display
 */
const { computedTaskData, scoreValueTemplate, getTaskDescription, getTaskScoresArray } = useScoreListData({
  studentGrade: props.studentGrade,
  taskData: props.taskData,
  longitudinalData: props.longitudinalData,
  taskScoringVersions: props.taskScoringVersions,
  t,
});

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
 * @returns {string} Original score label
 */
const getScoreLabel = (taskName) => {
  return taskName === 'Percent Correct' ? 'Correct' : taskName;
};
</script>
