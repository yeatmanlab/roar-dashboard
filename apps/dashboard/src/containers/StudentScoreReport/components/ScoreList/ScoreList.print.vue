<template>
  <div class="text-sm break-inside-avoid">
    <h2 class="mt-6 text-xl font-bold">Detailed Assessment Results</h2>

    <ul class="p-0 m-0">
      <li v-for="task in computedTaskData" :key="task.taskId" class="list-none">
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
          :longitudinal-data="task.historicalScores"
          :task-id="task.taskId"
          :student-grade="studentGrade"
        />
      </li>
    </ul>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ScoreCardPrint as ScoreCard } from './ScoreCard';
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
});

const { t } = useI18n();

/**
 * Process task data into computed task data for display
 */
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
