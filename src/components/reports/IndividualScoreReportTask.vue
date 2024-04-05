<template>
  <div v-for="task in computedTaskData" :key="task" class="align-self-start">
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
        isNaN(Math.round(task.scores?.composite[getPercentileScoreKey(task.taskId, grade)]))
      "
      class="error flex justify-content-center md:flex-row align-items-center m-auto p-4 w-5"
    >
      ERROR: Unable to load score for {{ taskDisplayNames[task.taskId]?.extendedTitle }}; score may not exist due to
      incomplete assessment.
    </div>

    <div v-else class="flex flex-column align-items-center mb-1 p-1 score-card">
      <div class="flex flex-column md:flex-row align-items-center">
        <div class="flex flex-column justify-content-center align-items-center mt-2">
          <div class="header-task-name">{{ taskDisplayNames[task.taskId]?.extendedTitle }}</div>
          <div class="m-2">Status: {{ getStatus(task) }}</div>
          <div class="text-xs uppercase font-thin mb-2 text-gray-400">
            <div v-if="!rawOnlyTasks.includes(task.taskId)" class="scoring-type">
              {{ grade >= 6 ? 'Standard Score' : 'Percentile Score' }}
            </div>
            <div v-else class="scoring-type">Raw Score</div>
            <div v-for="tag in task.tags" :key="tag" class="flex w-full align-items-center justify-content-center">
              <PvTag
                v-tooltip.top="tag.tooltip"
                :icon="tag.icon"
                :value="tag.value"
                :severity="tag.severity"
                class="text-sm"
              />
            </div>
          </div>
          <PvKnob
            v-if="rawOnlyTasks.includes(task.taskId)"
            :model-value="getRawScore(task.taskId)"
            :size="160"
            value-color="gray"
            range-color="gray"
          />
          <PvKnob
            v-else-if="grade >= 6"
            :model-value="Math.round(task.scores?.composite.sprStandardScore)"
            :size="180"
            :value-color="
              getSupportLevel(
                grade,
                task.scores?.composite[getPercentileScoreKey(task.taskId, grade)],
                returnRawScore(task.taskId, grade),
                task.taskId,
              ).tag_color
            "
            :min="0"
            :max="153"
          />
          <PvKnob
            v-else
            :value-template="
              getPercentileSuffix(Math.round(task.scores?.composite[getPercentileScoreKey(task.taskId, grade)]))
            "
            :model-value="Math.round(task.scores?.composite[getPercentileScoreKey(task.taskId, grade)])"
            :size="160"
            :value-color="
              getSupportLevel(
                grade,
                task.scores?.composite[getPercentileScoreKey(task.taskId, grade)],
                getRawScore(task.taskId),
                task.taskId,
              ).tag_color
            "
          />
        </div>
      </div>

      <div v-if="rawOnlyTasks.includes(task.taskId)" class="score-description px-4 py-2">
        {{ studentFirstName }} achieved a composite score of
        <strong>{{ getRawScore(task.taskId) }}</strong>
        in {{ taskDisplayNames[task.taskId]?.extendedName }}. {{ extendedDescriptions[task.taskId] }}.
      </div>
      <div v-else-if="grade >= 6" class="px-4 py-2 score-description">
        {{ studentFirstName }} scored a standard score of
        <strong>{{ Math.round(task.scores?.composite.sprStandardScore) }}</strong
        >, which indicates they
        <strong>{{
          getSupportLevelLanguage(
            grade,
            task.scores?.composite[getPercentileScoreKey(task.taskId, grade)],
            getRawScore(task.taskId),
            task.taskId,
          )
        }}</strong>
        {{ taskDisplayNames[task.taskId]?.extendedName }}. {{ extendedDescriptions[task.taskId] }}.
      </div>

      <div v-else class="px-4 py-2 score-description">
        {{ studentFirstName }} scored in the
        <strong
          >{{
            getPercentileWithSuffix(Math.round(task.scores?.composite[getPercentileScoreKey(task.taskId, grade)]))
          }}
          percentile</strong
        >, which indicates they
        <strong>{{
          getSupportLevelLanguage(
            grade,
            task.scores?.composite[getPercentileScoreKey(task.taskId, grade)],
            getRawScore(task.taskId),
            task.taskId,
          )
        }}</strong>
        {{ taskDisplayNames[task.taskId]?.extendedName }}. {{ extendedDescriptions[task.taskId] }}.
      </div>
      <div v-if="!rawOnlyTasks.includes(task.taskId)">
        <PvAccordion class="my-2 w-full" :active-index="expanded ? 0 : null">
          <PvAccordionTab header="Score Breakdown">
            <div v-for="[key, rawScore, rangeMin, rangeMax] in extractScoreNames(task.scores, task.taskId)" :key="key">
              <div class="flex justify-content-between score-table">
                <div class="mr-2">
                  <b>{{ key }}</b
                  ><span v-if="rangeMax" class="text-500"> ({{ rangeMin }}-{{ rangeMax }}):</span> <span v-else>:</span>
                </div>
                <div class="ml-2">
                  <b>{{ isNaN(rawScore) ? rawScore : Math.round(rawScore) }}</b>
                </div>
              </div>
            </div>
          </PvAccordionTab>
        </PvAccordion>
      </div>
      <div v-if="task.taskId === 'letter'">
        <PvAccordion class="my-2 w-full" :active-index="expanded ? 0 : null">
          <PvAccordionTab header="Score Breakdown">
            <div v-for="[key, rawScore, rangeMin, rangeMax] in extractScoreNames(task.scores, task.taskId)" :key="key">
              <div class="flex justify-content-between score-table">
                <div class="mr-2">
                  <b>{{ key }}</b
                  ><span v-if="rangeMax" class="text-500">({{ rangeMin }}-{{ rangeMax }}):</span> <span v-else>:</span>
                </div>
                <div class="ml-2">
                  <b>{{ isNaN(rawScore) ? rawScore : Math.round(rawScore) }}</b>
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
import _lowerCase from 'lodash/lowerCase';
import _toUpper from 'lodash/toUpper';
import { getGrade } from '@bdelab/roar-utils';
import {
  rawOnlyTasks,
  taskDisplayNames,
  extendedDescriptions,
  getSupportLevel,
  getRawScoreRange,
  getScoreKeys,
} from '@/helpers/reports';

const props = defineProps({
  studentData: {
    type: Object,
    required: true,
  },
  taskData: {
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

const grade = computed(() => getGrade(props.studentData?.studentData?.grade));

// Filters for non-null scores and sorts
const computedTaskData = computed(() => {
  return props.taskData
    ?.filter((task) => task.scores != undefined)
    .sort((a, b) => {
      if (Object.keys(taskDisplayNames).includes(a.taskId) && Object.keys(taskDisplayNames).includes(b.taskId)) {
        return taskDisplayNames[a.taskId].order - taskDisplayNames[b.taskId].order;
      } else {
        return -1;
      }
    })
    .map((task) => {
      // check if reliable key exists on task -- if it does, push a tag representing the tag
      if ('reliable' in task) {
        const tags = [];
        if (task.reliable === false) {
          tags.push({
            value: 'Unreliable',
            icon: 'pi pi-times',
            severity: 'warning',
            tooltip: task.engagementFlags
              ? `The run was marked unreliable because of the following flags: \n \n ${Object.keys(task.engagementFlags)
                  .map((flag) => _lowerCase(flag))
                  .join(', ')}`
              : 'The run was marked as unreliable.',
          });
        } else {
          tags.push({
            value: 'Reliable',
            severity: 'success',
            icon: 'pi pi-check',
            tooltip: `The student's behavior did not trigger any flags and the run can be considered reliable`,
          });
        }

        // update task with tags
        task = {
          ...task,
          tags: tags,
        };
      }
      return task;
    });
});

const getStatus = (_task) => {
  return _task.optional ? 'Optional' : 'Required';
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
const extractScoreNames = (scores, taskId) => {
  let formattedScores = {};
  for (const key in scores.composite) {
    if (scores.composite[key] != undefined && !isNaN(scores.composite[key])) {
      if (formattedScoreAttributeMap[key] !== undefined) {
        const formattedScoreAttribute = formattedScoreAttributeMap[key];
        formattedScores[formattedScoreAttribute] = scores.composite[key];
      }
    }
  }

  const formattedScoresArray = Object.keys(formattedScores).map((key) => {
    let minScore, maxScore;
    if (key === 'Percentile Score') {
      minScore = 0;
      maxScore = 99;
    } else if (key === 'Standard Score') {
      minScore = 0;
      maxScore = 180;
    } else if (key === 'Raw Score') {
      const scoreRange = getRawScoreRange(taskId);
      minScore = scoreRange.min;
      maxScore = scoreRange.max;
    }
    return [key, formattedScores[key], minScore, maxScore];
  });

  if (taskId === 'pa') {
    const first = scores?.FSM?.roarScore;
    const last = scores?.LSM?.roarScore;
    const deletion = scores?.DEL?.roarScore;
    let skills = [];
    if (first < 15) skills.push('FSM');
    if (last < 15) skills.push('LSM');
    if (deletion < 15) skills.push('DEL');

    const skillsString = skills.length >= 0 ? skills.join(', ') : 'None';

    formattedScoresArray.push(['First Sound Matching (FSM)', first]);
    formattedScoresArray.push(['Last Sound Matching (LSM)', last]);
    formattedScoresArray.push(['Deletion (DEL)', deletion]);
    formattedScoresArray.push(['Skills to work on', skillsString]);
  } else if (taskId === 'letter') {
    formattedScoresArray;
    const incorrectLetters = [
      scores?.UppercaseNames?.upperIncorrect ?? ''.split(','),
      scores?.LowercaseNames?.lowerIncorrect ?? ''.split(','),
    ]
      .sort((a, b) => _toUpper(a) - _toUpper(b))
      .filter(Boolean)
      .join(', ');

    const incorrectPhonemes = scores?.Phonemes?.phonemeIncorrect ?? ''.split(',').join(', ');

    const lowerCaseScore = scores?.LowercaseNames?.subScore;
    const upperCaseScore = scores?.UppercaseNames?.subScore;
    const letterSoundsScore = scores?.Phonemes?.subScore;
    formattedScoresArray.push(['Lower Case Letters', lowerCaseScore, 0, 26]);
    formattedScoresArray.push(['Upper Case Letters', upperCaseScore, 0, 26]);
    formattedScoresArray.push(['Letter Sounds', letterSoundsScore, 0, 38]);
    formattedScoresArray.push(['Letters to work on', incorrectLetters]);
    formattedScoresArray.push(['Sounds to work on', incorrectPhonemes]);
  }

  // Ensure scores are in consistent order
  const order = { 'Raw Score': 2, 'Percentile Score': 1, 'Standard Score': 0 };
  return formattedScoresArray.sort((first, second) => {
    return order[first[0]] - order[second[0]];
  });
};

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
  const task = props.taskData.find((task) => task.taskId === taskId);
  return task.scores.composite;
};

const returnRawScore = (taskId, grade) => {
  const task = props.taskData.find((task) => task.taskId === taskId);
  const { rawScoreKey } = getScoreKeys(taskId, grade);
  return task.scores.composite[rawScoreKey];
};

function getSupportLevelLanguage(grade, percentile, rawScore, taskId) {
  const { support_level } = getSupportLevel(grade, percentile, rawScore, taskId);
  if (support_level) {
    if (support_level === 'Achieved Skill') {
      return 'have achieved the skill of';
    } else if (support_level === 'Developing Skill') {
      return 'are developing the skill of';
    } else if (support_level === 'Needs Extra Support') {
      return 'need extra support in';
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

.score-table {
  max-width: 18rem;
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
