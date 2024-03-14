<template>
  <div v-for="task in computedTaskData" :key="task">
    <div
      v-if="rawOnlyTasks.includes(task.taskId) && isNaN(getRawScore(task.taskId))"
      class="error flex flex-column md:flex-row align-items-center m-auto p-4 w-5"
    >
      ERROR: Unable to load score for <strong>{{ taskDisplayNames[task.taskId]?.extendedTitle }}</strong
      >; score may not exist due to incomplete assessment.
    </div>

    <div
      v-else-if="
        !rawOnlyTasks.includes(task.taskId) &&
        isNaN(Math.round(task.scores?.[getPercentileScoreKey(task.taskId, grade)]))
      "
      class="error flex justify-content-center md:flex-row align-items-center m-auto p-4 w-5"
    >
      ERROR: Unable to load score for {{ taskDisplayNames[task.taskId]?.extendedTitle }}; score may not exist due to
      incomplete assessment.
    </div>

    <div v-else class="flex flex-column align-items-center mb-1 p-1 score-card">
      <div v-if="grade < 6" class="flex flex-column md:flex-row align-items-center">
        <div class="flex flex-column justify-content-center align-items-center mt-2">
          <div class="header-task-name">{{ taskDisplayNames[task.taskId]?.extendedTitle }}</div>
          <div class="">Status: Required</div>
          <div class="text-xs uppercase font-thin mb-2 text-gray-400">
            <div v-if="!rawOnlyTasks.includes(task.taskId)" class="scoring-type">Percentile Score</div>
            <div v-else class="scoring-type">Raw Score</div>
          </div>
          <PvKnob
            v-if="rawOnlyTasks.includes(task.taskId)"
            :model-value="getRawScore(task.taskId)"
            size="160"
            value-color="gray"
            range-color="gray"
          />
          <PvKnob
            v-else
            :value-template="getPercentileSuffix(Math.round(task.scores?.[getPercentileScoreKey(task.taskId, grade)]))"
            :model-value="Math.round(task.scores?.[getPercentileScoreKey(task.taskId, grade)])"
            size="160"
            :value-color="getColorByPercentile(task.scores?.[getPercentileScoreKey(task.taskId, grade)])"
          />
        </div>
      </div>

      <div v-else class="flex flex-column md:flex-row align-items-center">
        <div class="flex flex-column justify-content-center align-items-center mt-2">
          <div class="header-task-name">{{ taskDisplayNames[task.taskId]?.extendedTitle }}</div>
          <div class="">Status: Required</div>
          <div class="text-xs uppercase font-thin mb-2 text-gray-400">
            <div v-if="!rawOnlyTasks.includes(task.taskId)" class="scoring-type">Standard Score</div>
            <div v-else class="scoring-type">Raw Score</div>
          </div>
          <PvKnob
            v-if="rawOnlyTasks.includes(task.taskId)"
            :model-value="getRawScore(task.taskId)"
            size="160"
            value-color="gray"
            range-color="gray"
          />
          <PvKnob
            v-else
            :model-value="Math.round(task.scores?.sprStandardScore)"
            size="160"
            :value-color="getColorByPercentile(task.scores?.[getPercentileScoreKey(task.taskId, grade)])"
            :min="0"
            :max="153"
          />
        </div>
      </div>

      <div v-if="rawOnlyTasks.includes(task.taskId)" class="score-description px-4 py-2">
        {{ studentFirstName }} achieved a composite score of
        <strong>{{ getRawScore(task.taskId) }}</strong>
        in {{ taskDisplayNames[task.taskId]?.extendedName }}. {{ extendedDescriptions[task.taskId] }}.
      </div>

      <div v-else-if="grade < 6" class="px-4 py-2 score-description">
        {{ studentFirstName }} scored in the
        <strong :style="{ color: supportColor }"
          >{{
            getPercentileWithSuffix(Math.round(task.scores?.[getPercentileScoreKey(task.taskId, grade)]))
          }}
          percentile</strong
        >, which indicates they
        <strong :style="{ color: supportColor }">{{
          getSupportLevel(task.scores?.[getPercentileScoreKey(task.taskId, grade)])
        }}</strong>
        in {{ taskDisplayNames[task.taskId]?.extendedName }}. {{ extendedDescriptions[task.taskId] }}.
      </div>
      <div v-else class="px-4 py-2 score-description">
        {{ studentFirstName }} scored a standard score of
        <strong>{{ Math.round(task.scores?.sprStandardScore) }}</strong>
        which indicates they
        <strong :style="{ color: supportColor }">{{
          getSupportLevel(task.scores?.[getPercentileScoreKey(task.taskId, grade)])
        }}</strong>
        in {{ taskDisplayNames[task.taskId]?.extendedName }}. {{ extendedDescriptions[task.taskId] }}.
      </div>
      <div v-if="!rawOnlyTasks.includes(task.taskId)">
        <PvAccordion class="my-2 w-full" :active-index="expanded ? 0 : null">
          <PvAccordionTab header="Score Breakdown">
            <div v-for="[key, value] in extractScoreNames(task.scores)" :key="key">
              <div class="flex flex-column align-items-center">
                <div>
                  <b>{{ key }}:</b> {{ value }}
                </div>
              </div>
            </div>
          </PvAccordionTab>
        </PvAccordion>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { getGrade } from '@bdelab/roar-utils';
import { rawOnlyTasks, taskDisplayNames, extendedDescriptions } from '@/helpers/reports';

const props = defineProps({
  studentData: {
    type: Object,
    required: true,
  },
  taskData: {
    type: Object,
    required: true,
  },
  rawTaskData: {
    type: Object,
    required: true,
  },
  expanded: {
    type: Boolean,
    required: false,
  },
});

const studentFirstName = computed(() => {
  if (!props.studentData.name) return props.studentData.username;
  return props.studentData.name.first;
});

const grade = computed(() => props.studentData?.studentData?.grade);

// Filters for non-null scores and sorts
const computedTaskData = computed(() => {
  return props.taskData
    ?.filter((task) => task.scores != undefined)
    .sort((a, b) => {
      if (Object.keys(taskDisplayNames).includes(a.taskId) && Object.keys(taskDisplayNames).includes(b.taskId)) {
        console.log(a, b);
        return taskDisplayNames[a.taskId].order - taskDisplayNames[b.taskId].order;
      } else {
        return -1;
      }
    });
});

const getStatus = (_taskId) => {
  const optionalFilter = props.taskData?.filter((task) => task.taskId === _taskId && task.optional === true);
  if (optionalFilter.length === 0) {
    return 'Required';
  } else {
    return 'Optional';
  }
};

const formattedScoreAttributeMap = {
  wjPercentile: 'Percentile Score',
  sprPercentile: 'Percentile Score',
  percentile: 'Percentile Score',
  tosrecPercentile: 'Percentile Score',
  sprStandardScore: 'Standard Score',
  standardScore: 'Standard Score',
  tosrecSS: 'Standard Score',
  roarScore: 'Raw Score',
  sreScore: 'Raw Score',
};

// Converts scores dictionary to array of human readable score names
const extractScoreNames = (scores) => {
  let formattedScores = {};
  for (const key in scores) {
    if (scores[key] != undefined && !isNaN(scores[key])) {
      if (formattedScoreAttributeMap[key] !== undefined) {
        const formattedScoreAttribute = formattedScoreAttributeMap[key];
        formattedScores[formattedScoreAttribute] = scores[key];
      }
    }
  }

  const formattedScoresArray = Object.keys(formattedScores).map((key) => {
    return [key, formattedScores[key]];
  });

  // Ensure scores are in consistent order
  console.log(formattedScoresArray);
  return formattedScoresArray.sort((first, second) => {
    return first[0].localeCompare(second[0]);
  });
};

let supportColor = null;

function getColorByPercentile(percentile) {
  if (percentile !== undefined) {
    if (percentile >= 50) {
      return 'green';
    } else if (percentile > 25 && percentile < 50) {
      return 'rgb(237, 192, 55)';
    } else {
      return 'rgb(201, 61, 130)';
    }
  }
  return;
}

const getPercentileScoreKey = (taskId, grade) => {
  if (taskId === 'swr' || taskId === 'swr-es') {
    if (getGrade(grade) < 6) {
      return 'wjPercentile';
    } else {
      return 'sprPercentile';
    }
  }
  if (taskId === 'pa') {
    if (getGrade(grade) < 6) {
      return 'percentile';
    } else {
      return 'sprPercentile';
    }
  }
  if (taskId === 'sre') {
    if (getGrade(grade) < 6) {
      return 'tosrecPercentile';
    } else {
      return 'sprPercentile';
    }
  }
};

const getRawScore = (taskId) => {
  const task = props.rawTaskData.find((task) => task.taskId === taskId);
  return task.scores;
};

function getSupportLevel(percentile) {
  if (percentile !== undefined) {
    if (percentile >= 50) {
      return 'have achieved skill';
    } else if (percentile > 25 && percentile < 50) {
      return 'are developing this skill';
    } else {
      return 'need extra support';
    }
  }
}

function getPercentileWithSuffix(percentile) {
  if (percentile % 10 === 1 && percentile !== 11) {
    return percentile + 'st';
  } else if (percentile % 10 === 2 && percentile !== 12) {
    return percentile + 'nd';
  } else if (percentile % 10 === 3 && percentile !== 13) {
    return percentile + 'rd';
  } else {
    return percentile + 'th';
  }
}

function getPercentileSuffix(percentile) {
  if (percentile % 10 === 1 && percentile !== 11) {
    return '{value}st';
  } else if (percentile % 10 === 2 && percentile !== 12) {
    return '{value}nd';
  } else if (percentile % 10 === 3 && percentile !== 13) {
    return '{value}rd';
  } else {
    return '{value}th';
  }
}
</script>

<style scoped>
.score {
  position: relative;
  font-size: 1.7rem;
}

.score-card {
  outline: 3px solid var(--primary-color);
  width: fit-content;
  border-radius: 1rem;
  min-height: 30rem;
}

.score-description {
  font-size: 1.1rem;
  margin-top: 1rem;
  max-width: 22rem;
}

.header-task-name {
  font-size: 1.4rem;
  font-weight: bold;
  border-radius: 12px;
}

.error {
  color: red;
  font-size: 1.2rem;
  border: 2px solid red;
  border-radius: 12px;
}

.score-wrapper {
  border-radius: 0.3rem;
}

@media (min-width: 768px) {
  .score {
    margin-top: 156px;
    right: 50%;
  }
}
</style>
