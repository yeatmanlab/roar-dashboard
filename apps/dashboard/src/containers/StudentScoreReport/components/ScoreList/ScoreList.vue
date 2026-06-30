<template>
  <section class="pt-4">
    <h2 class="text-2xl font-bold">Detailed Assessment Results</h2>

    <div class="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
      <template v-for="task in computedTaskData" :key="task.taskId">
        <ScoreCard
          :public-name="tasksDictionary[task.taskId]?.nameSimple ?? task.taskId"
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
          :student-grade="studentGrade"
          :current-assignment-id="currentAssignmentId"
          :task-scoring-version="taskScoringVersions?.[task.taskId]"
        />
      </template>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ScoreCardScreen as ScoreCard } from './ScoreCard';
import { useReportCardData } from './useReportCardData';

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
  expanded: {
    type: Boolean,
    required: false,
  },
  taskScoringVersions: {
    type: Object,
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
</script>

<style scoped>
.grid {
  display: grid !important;
  margin: 0 !important;
}

@media (min-width: 1024px) {
  .grid > * {
    height: 100%;
    align-self: flex-start;
  }
}
</style>
