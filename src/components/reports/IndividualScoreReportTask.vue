<template>

  <div v-for="task in props.taskData" :key="task">

    <div
      v-if="rawOnlyTasks.includes(task.taskId) && isNaN(getRawScore(task.taskId))"
      class="error flex flex-column md:flex-row align-items-center m-auto p-4 w-5">
      ERROR: Unable to load score for <strong>{{ extendedTaskData.extendedTitle[task.taskId] }}</strong>; score may not exist due to incomplete assessment.
    </div>

    <div
      v-else-if="!rawOnlyTasks.includes(task.taskId) && isNaN(Math.round(task.scores?.[getPercentileScoreKey(task.taskId, grade)]))"
      class="error flex justify-content-center md:flex-row align-items-center m-auto p-4 w-5">
      ERROR: Unable to load score for {{ extendedTaskData.extendedTitle[task.taskId] }}; score may not exist due to incomplete assessment.
    </div>

    <div v-else class="flex flex-column md:flex-row align-items-center mb-4 p-4">

      <div class="flex flex-column md:flex-row align-items-center">
        <div class="flex flex-column justify-content-center align-items-center">
          <h3 class="header-task-name">{{extendedTaskData.extendedTitle[task.taskId]}}</h3>
          <PvChart v-if="rawOnlyTasks.includes(task.taskId)" type="doughnut" :data="doughnutChartData(getRawScore(task.taskId), task.taskId)" />
          <PvChart v-else type="doughnut" :data="doughnutChartData(task.scores?.[getPercentileScoreKey(task.taskId, grade)], task.taskId)" />
        </div>
        <p v-if="rawOnlyTasks.includes(task.taskId)" class="score">{{ getRawScore(task.taskId) }}</p>
        <p v-else class="score">{{ Math.round(task.scores?.[getPercentileScoreKey(task.taskId, grade)]) }}%</p>
      </div>


      <div v-if="rawOnlyTasks.includes(task.taskId)" class="score-description">{{ studentFirstName }} achieved a composite score of
        <strong>{{ getRawScore(task.taskId) }}</strong>
        on {{ extendedTaskData.extendedName[task.taskId] }}.
        {{ extendedTaskData.extendedDescription[task.taskId] }}.
      </div>

      <div v-else class="score-description">{{ studentFirstName }} scored in the
        <strong :style="{color: supportColor}">{{ getPercentileWithSuffix(Math.round(task.scores?.[getPercentileScoreKey(task.taskId, grade)])) }} percentile</strong>,
        which indicates they
        <strong :style="{color: supportColor}">{{ getSupportLevel(task.scores?.[getPercentileScoreKey(task.taskId, grade)]) }}</strong>
        on {{ extendedTaskData.extendedName[task.taskId] }}.
        {{ extendedTaskData.extendedDescription[task.taskId] }}.
      </div>

    </div>

  </div>

</template>

<script setup>
import {computed} from "vue";
import { getGrade } from "@bdelab/roar-utils";

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
});

const rawOnlyTasks = ['letter', 'multichoice']


const extendedTaskData = {
  ...props.taskData,
  extendedTitle: {
    "swr": "ROAR-Word",
    "swr-es": "ROAR-Palabra",
    "pa": "ROAR-Phoneme",
    "sre": "ROAR-Sentence",
    "vocab": "ROAR-Picture Vocabulary ",
    "multichoice": "ROAR-Multiple Choice",
    "morph": "ROAR-Morphology",
    "cva": "ROAR-Written Vocabulary",
    "letter": "ROAR-Letter",
    "comp": "ROAR-Comprehension",
    "phonics": "ROAR-Phonics",
    "syntax": "ROAR-Syntax",
    "fluency": "ROAM-Fluency",
  },
  extendedName: {
    "swr": "Single Word Recognition",
    "swr-es": "Single Word Recognition",
    "pa": "Phonological Awareness",
    "sre": "Sentence Reading Efficiency",
    "vocab": "Picture Vocabulary",
    "multichoice": "Multiple Choice Vocabulary",
    "morph": "Morphological Awareness",
    "cva": "Written Vocabulary",
    "letter": "Letter Names and Sounds",
    "comp": "Reading Comprehension",
    "phonics": "Phonics",
    "syntax": "Syntax",
    "fluency": "Math Fluency",
  },
  extendedDescription: {
    "swr": "This test measures your student’s skill in reading single words quickly and correctly",
    "swr-es": "This test measures how well a student can identify real words and made-up words. " +
        "The goal is for students to recognize words quickly and accurately, a skill called decoding. " +
        "High scores on this assessment indicate a readiness to be a skilled and fluent reader",
    "pa": "This test measures how well your student can break down a spoken word into its individual sounds and choose or create a word with the same sounds",
    "sre": "This test measures how quickly your student can silently read and understand sentences",
    "vocab": "This test measures how well your student knows words by having them match a picture to a spoken word",
    "multichoice": "Temporary description for multichoice",
    "morph": "This test measures how well your student understands how parts of words, including prefixes and suffixes, can change the meaning of a word in a sentence",
    "cva": "This test measures your students’ knowledge of words that are often used in the books they read at school",
    "letter": "This test measures how well your student knows the names of letters and which letters are used to spell each sound",
    "comp": "Temporary description for comp",
    "phonics": "This test measures phonics knowledge by testing how well your student can match the sounds of a word to the spelling",
    "syntax": "This test measures how well students understand sentences that vary from simple to complicated",
    "fluency": "Temporary description for fluency",
  },
}

const studentFirstName = computed(() => {
  if (!props.studentData.name) return props.studentData.username;
  return props.studentData.name.first;
});

const grade = computed(()=> props.studentData.studentData.grade)

let supportColor = null
let remainderColor = null

const doughnutChartData = (scoreKey, taskId) => {

  const docStyle = getComputedStyle(document.documentElement);
  let score = Math.round(scoreKey);
  let remainder = 100 - score;


  if (getSupportLevel(score) === 'are At or Above Average') {
    supportColor = docStyle.getPropertyValue('--green-500');
    remainderColor = docStyle.getPropertyValue('--green-800');
  } else if (getSupportLevel(score) === 'Need Some Support') {
    supportColor = docStyle.getPropertyValue('--yellow-500');
    remainderColor = docStyle.getPropertyValue('--yellow-800');
  } else {
    supportColor = docStyle.getPropertyValue('--red-500');
    remainderColor = docStyle.getPropertyValue('--red-800');
  }

  if (rawOnlyTasks.includes(taskId)) {
    return {
      labels: ['Raw Score'],
      datasets: [
        {
          data: [score],
          backgroundColor: [
            "dodgerblue", "lightblue",
          ],
          // hoverBackgroundColor: ['green', docStyle.getPropertyValue('--surface-d')]
        },
      ],
    };
  }

  return {
    labels: ['Percentile'],
    datasets: [
      {
        data: [score, remainder],
        backgroundColor: [
          supportColor, remainderColor,
        ],
      },
    ],
  };
};

const getPercentileScoreKey = (taskId, grade) => {
  if (taskId === 'swr' || taskId === 'swr-es') {
    if (getGrade(grade) < 6) {
      return 'wjPercentile';
    } else {
      return'sprPercentile';
    }
  }
  if (taskId === 'pa') {
    if (getGrade(grade) < 6) {
      return 'percentile';
    } else {
      return'sprPercentile';
    }
  }
  if (taskId === 'sre') {
    if (getGrade(grade) < 6) {
      return 'tosrecPercentile';
    } else {
      return 'sprPercentile';
    }
  }
}

const getRawScore = (taskId) => {
  const task = props.rawTaskData.find(task => task.taskId === taskId);
  return task.scores
};


function getSupportLevel(percentile) {
  if (percentile !== undefined) {
    if (percentile >= 50) {
      return 'are At or Above Average';
    } else if (percentile > 25 && percentile < 50) {
      return 'Need Some Support';
    } else {
      return 'Need Extra Support';
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


</script>


<style scoped>

  .score {
    position: relative;
    margin-top: -156px;
    font-size: 2.0rem;
  }

  .score-description {
    margin-top: 124px;
  }


  .header-task-name {
    text-decoration: underline;
    background: linear-gradient(to right, var(--red-100), var(--blue-200));
    border-radius: 12px;
    padding: 1.0rem;
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