<template>
  <div v-for="task in computedTaskData" :key="task">
    <div
      v-if="rawOnlyTasks.includes(task.taskId) && isNaN(getRawScore(task.taskId))"
      class="error flex flex-column md:flex-row align-items-center m-auto p-4 w-5"
    >
      ERROR: Unable to load score for <strong>{{ extendedTaskData.extendedTitle[task.taskId] }}</strong
      >; score may not exist due to incomplete assessment.
    </div>

    <div
      v-else-if="
        !rawOnlyTasks.includes(task.taskId) &&
        isNaN(Math.round(task.scores?.[getPercentileScoreKey(task.taskId, grade)]))
      "
      class="error flex justify-content-center md:flex-row align-items-center m-auto p-4 w-5"
    >
      ERROR: Unable to load score for {{ extendedTaskData.extendedTitle[task.taskId] }}; score may not exist due to
      incomplete assessment.
    </div>

    <div v-else class="flex flex-column align-items-center mb-1 p-1 score-card">
      <div class="flex flex-column md:flex-row align-items-center">
        <div class="flex flex-column justify-content-center align-items-center mt-2">
          <div class="header-task-name">{{ extendedTaskData.extendedTitle[task.taskId] }}</div>
          <div class="text-xs uppercase font-thin mb-2 text-gray-400">
            <div v-if="!rawOnlyTasks.includes(task.taskId)" class="scoring-type">Percentile Score</div>
            <div v-else class="scoring-type">Raw Score</div>
          </div>
          <!-- <PvChart v-if="rawOnlyTasks.includes(task.taskId)" type="doughnut" :data="doughnutChartData(getRawScore(task.taskId), task.taskId)" /> 
          <PvChart v-else type="doughnut" :data="doughnutChartData(task.scores?.[getPercentileScoreKey(task.taskId, grade)], task.taskId)" />  -->
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
        <!-- <p v-if="rawOnlyTasks.includes(task.taskId)" class="score">{{ getRawScore(task.taskId) }}</p> -->
        <!-- <p v-else class="score">{{ Math.round(task.scores?.[getPercentileScoreKey(task.taskId, grade)]) }}%</p> -->
      </div>

      <div v-if="rawOnlyTasks.includes(task.taskId)" class="score-description px-4 py-2">
        {{ studentFirstName }} achieved a composite score of
        <strong>{{ getRawScore(task.taskId) }}</strong>
        in {{ extendedTaskData.extendedName[task.taskId] }}. {{ extendedTaskData.extendedDescription[task.taskId] }}.
      </div>

      <div v-else class="px-4 py-2 score-description">
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
        in {{ extendedTaskData.extendedName[task.taskId] }}. {{ extendedTaskData.extendedDescription[task.taskId] }}.
      </div>
      <div v-if="!rawOnlyTasks.includes(task.taskId)">
        <!-- <PvDivider /> -->
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
import { rawOnlyTasks, taskDisplayNames } from '@/helpers/reports';

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

const extendedTaskData = {
  ...props.taskData,
  extendedTitle: {
    swr: 'ROAR-Word',
    'swr-es': 'ROAR-Palabra',
    pa: 'ROAR-Phoneme',
    sre: 'ROAR-Sentence',
    vocab: 'ROAR-Picture Vocabulary ',
    multichoice: 'ROAR-Multiple Choice',
    morph: 'ROAR-Morphology',
    cva: 'ROAR-Written Vocabulary',
    letter: 'ROAR-Letter',
    comp: 'ROAR-Comprehension',
    phonics: 'ROAR-Phonics',
    syntax: 'ROAR-Syntax',
    fluency: 'ROAM-Fluency',
  },
  extendedName: {
    swr: 'Single Word Recognition',
    'swr-es': 'Single Word Recognition',
    pa: 'Phonological Awareness',
    sre: 'Sentence Reading Efficiency',
    vocab: 'Picture Vocabulary',
    multichoice: 'Multiple Choice Vocabulary',
    morph: 'Morphological Awareness',
    cva: 'Written Vocabulary',
    letter: 'Letter Names and Sounds',
    comp: 'Reading Comprehension',
    phonics: 'Phonics',
    syntax: 'Syntax',
    fluency: 'Math Fluency',
  },
  extendedDescription: {
    swr: 'This test measures your student’s skill in reading single words quickly and correctly',
    'swr-es':
      'This test measures how well a student can identify real words and made-up words. ' +
      'The goal is for students to recognize words quickly and accurately, a skill called decoding. ' +
      'High scores on this assessment indicate a readiness to be a skilled and fluent reader',
    pa: 'This test measures how well your student can break down a spoken word into its individual sounds and choose or create a word with the same sounds',
    sre: 'This test measures how quickly your student can silently read and understand sentences',
    vocab: 'This test measures how well your student knows words by having them match a picture to a spoken word',
    multichoice: 'Temporary description for multichoice',
    morph:
      'This test measures how well your student understands how parts of words, including prefixes and suffixes, can change the meaning of a word in a sentence',
    cva: 'This test measures your students’ knowledge of words that are often used in the books they read at school',
    letter:
      'This test measures how well your student knows the names of letters and which letters are used to spell each sound',
    comp: 'Temporary description for comp',
    phonics:
      'This test measures phonics knowledge by testing how well your student can match the sounds of a word to the spelling',
    syntax: 'This test measures how well students understand sentences that vary from simple to complicated',
    fluency: 'Temporary description for fluency',
  },
};

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
  return formattedScoresArray.sort((first, second) => {
    return first[0].localeCompare(second[0]);
  });
};

let supportColor = null;
// let remainderColor = null

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

// const doughnutChartData = (scoreKey, taskId) => {

//   const docStyle = getComputedStyle(document.documentElement);
//   let score = Math.round(scoreKey);
//   let remainder = 100 - score;

//   if (getSupportLevel(score) === 'are At or Above Average') {
//     supportColor = docStyle.getPropertyValue('--green-500');
//     remainderColor = docStyle.getPropertyValue('--green-800');
//   } else if (getSupportLevel(score) === 'Need Some Support') {
//     supportColor = docStyle.getPropertyValue('--yellow-500');
//     remainderColor = docStyle.getPropertyValue('--yellow-800');
//   } else {
//     supportColor = docStyle.getPropertyValue('--red-500');
//     remainderColor = docStyle.getPropertyValue('--red-800');
//   }

//   if (rawOnlyTasks.includes(taskId)) {
//     return {
//       labels: ['Raw Score'],
//       datasets: [
//         {
//           data: [score],
//           backgroundColor: [
//             "dodgerblue", "lightblue",
//           ],
//           // hoverBackgroundColor: ['green', docStyle.getPropertyValue('--surface-d')]
//         },
//       ],
//     };
//   }

//   return {
//     labels: ['Percentile'],
//     datasets: [
//       {
//         data: [score, remainder],
//         backgroundColor: [
//           supportColor, remainderColor,
//         ],
//       },
//     ],
//   };
// };

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
  font-size: 1.5rem;
}

.score-card {
  outline: 3px solid var(--primary-color);
  width: fit-content;
  border-radius: 1rem;
  min-height: 30rem;
}

.score-description {
  font-size: 1rem;
  margin-top: 1rem;
  max-width: 22rem;
}

.header-task-name {
  font-size: 1.3rem;
  font-weight: bold;
  border-radius: 12px;
}

.error {
  color: red;
  font-size: 1rem;
  border: 2px solid red;
  border-radius: 12px;
}

@media (min-width: 768px) {
  .score {
    margin-top: 156px;
    right: 50%;
  }
}
</style>
