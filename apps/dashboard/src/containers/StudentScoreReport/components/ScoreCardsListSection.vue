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
        :longitudinal-data="task.historicalScores"
        :task-id="task.taskId"
        :grade="studentGrade"
      />
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { toValue } from 'vue';
import ScoreCard from './ScoreCard.vue';
import ScoreReportService from '@/services/ScoreReport.service';
import { SCORE_TYPES } from '@/constants/scores';
import { getScoreValue } from '@/helpers/reports';

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
  const longitudinalData = toValue(props.longitudinalData);
  console.log('Raw longitudinal data:', longitudinalData);
  
  if (longitudinalData && Object.keys(longitudinalData).length > 0) {
    return currentTasks.map(task => {
      const taskHistory = longitudinalData[task.taskId] || [];
      console.log('Task history for', task.taskId, ':', taskHistory);
      
      const processedHistory = taskHistory
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map(run => {
          // Make sure we're accessing the correct scores structure
          const composite = run.scores?.composite || run.scores;
          console.log('Composite scores for', task.taskId, ':', composite);
          
          // Pre-process scores using getScoreValue
          const processedScores = {
            rawScore: getScoreValue(composite, task.taskId, props.studentGrade, 'rawScore'),
            percentile: getScoreValue(composite, task.taskId, props.studentGrade, 'percentile'),
            standardScore: getScoreValue(composite, task.taskId, props.studentGrade, 'standardScore')
          };
          
          console.log('Processed scores for', task.taskId, ':', processedScores);

          // Filter out undefined scores and round the values
          const scores = Object.fromEntries(
            Object.entries(processedScores)
              .filter(([, value]) => value !== undefined)
              .map(([key, value]) => [key, Math.round(Number(value))])
          );

          return {
            date: new Date(run.date),
            scores,
            assignmentId: run.assignmentId
          };
        });
      
      console.log('Final processed history for', task.taskId, ':', processedHistory);
      
      return {
        ...task,
        historicalScores: processedHistory
      };
    });
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
