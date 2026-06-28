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
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ScoreCardPrint as ScoreCard } from './ScoreCard';
import { useScoreListData } from './useScoreListData';
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
  currentAssignmentId: {
    type: String,
    required: true,
  },
  // Administrator path: backend-computed report tasks (retires client scoring).
  // The parent path leaves this null and stays on the legacy `taskData` pipeline.
  reportTasks: {
    type: Array,
    required: false,
    default: null,
  },
});

const { t } = useI18n();

const legacy = useScoreListData({
  studentGrade: props.studentGrade,
  taskData: props.taskData,
  longitudinalData: props.longitudinalData,
  taskScoringVersions: props.taskScoringVersions,
  t,
});
const backend = useReportCardData({
  reportTasks: () => props.reportTasks,
  studentGrade: props.studentGrade,
  taskScoringVersions: props.taskScoringVersions,
  t,
});

const useBackend = computed(() => Array.isArray(props.reportTasks));
const computedTaskData = computed(() =>
  useBackend.value ? backend.computedTaskData.value : legacy.computedTaskData.value,
);
const scoreValueTemplate = (task) =>
  useBackend.value ? backend.scoreValueTemplate.value(task) : legacy.scoreValueTemplate.value(task);
const getTaskDescription = (task) =>
  useBackend.value ? backend.getTaskDescription.value(task) : legacy.getTaskDescription.value(task);
const getTaskScoresArray = (task) =>
  useBackend.value ? backend.getTaskScoresArray.value(task) : legacy.getTaskScoresArray.value(task);

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
