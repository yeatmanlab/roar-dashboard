<template>
  <section class="py-4">
    <h2 class="text-2xl font-bold">Detailed Assessment Results</h2>

    <div
      v-for="task in computedTaskData"
      :key="task.taskId"
      class="grid lg:grid-cols-2 xl:grid-cols-3 align-items-end justify-content-start"
    >
      <ScoreCard
        :public-name="tasksDictionary[task.taskId]?.publicName ?? task.taskId"
        :score-label="task[task.scoreToDisplay].name"
        :score="task[task.scoreToDisplay]"
        :tags="task.tags"
        :value-template="scoreValueTemplate(task)"
        :score-to-display="task.scoreToDisplay"
        :student-first-name="studentFirstName"
        :description="getTaskDescription(task)"
        :scores-array="getTaskScoresArray(task)"
        :expanded="expanded"
      />
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ScoreCard from './ScoreCard.vue';
import ScoreReportService from '@/services/ScoreReport.service';
import { SCORE_TYPES } from '@/constants/scores';

const props = defineProps({
  studentFirstName: {
    type: String,
    required: true,
  },
  studentGrade: {
    type: Number,
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
    type: Array,
    required: false,
    default: () => [],
  },
  expanded: {
    type: Boolean,
    required: false,
  },
});

const { t } = useI18n();

/**
 * Process task data into computed task data for display
 */
const computedTaskData = computed(() => {
  // Process current task data
  const currentTasks = ScoreReportService.processTaskScores(props.taskData, props.studentGrade, { t });
  
  // Process longitudinal data
  if (props.longitudinalData?.length) {
    return currentTasks.map(task => ({
      ...task,
      historicalScores: (props.longitudinalData?.[task.taskId] || [])
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map(run => ({
          date: new Date(run.date),
          scores: run.scores,
          assignmentId: run.assignmentId
        }))
    }));
  }
  
  return currentTasks;
});

/**
 * Get template string for percentile display
 */
const scoreValueTemplate = computed(() => {
  return (task) => {
    const percentileSuffix = ScoreReportService.getPercentileSuffixTemplate(task.percentileScore.value);
    return task.scoreToDisplay === SCORE_TYPES.PERCENTILE ? percentileSuffix : undefined;
  };
});

/**
 * Get score description for a task
 */
const getTaskDescription = computed(() => {
  return (task) => ScoreReportService.getScoreDescription(task, props.studentGrade, { t });
});

/**
 * Get scores array for a task
 */
const getTaskScoresArray = computed(() => {
  return (task) => ScoreReportService.getScoresArrayForTask(task);
});
</script>

<style scoped>
.grid {
  display: grid !important;
  margin: 0 !important;
}

@media (min-width: 1024px) {
  .grid > * {
    width: 100%;
  }
}
</style>
