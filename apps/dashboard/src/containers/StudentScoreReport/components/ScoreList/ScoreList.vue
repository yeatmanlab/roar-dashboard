<template>
  <section class="py-4">
    <h2 class="text-2xl font-bold">Detailed Assessment Results</h2>

    <div class="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
      <template v-for="task in computedTaskData" :key="task.taskId">
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
          :student-grade="studentGrade"
        />
      </template>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ScoreCardScreen as ScoreCard } from './ScoreCard';
import { useScoreListData } from './useScoreListData';

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
  expanded: {
    type: Boolean,
    required: false,
  },
});

const { t } = useI18n();

// Use the shared composable
const { computedTaskData, scoreValueTemplate, getTaskDescription, getTaskScoresArray } = useScoreListData({
  studentGrade: props.studentGrade,
  taskData: props.taskData,
  longitudinalData: props.longitudinalData,
  t,
});
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
