<template>
  <template v-if="!isLoadingTasksDictionary">
    <div v-for="task in computedTaskData" :key="task" class="flex flex-column align-items-end justify-content-start">
      <div class="flex flex-column align-items-center justify-content-center mb-1 p-1 score-card">
        <div class="flex flex-column md:flex-row align-items-center justify-content-center">
          <div class="flex flex-column justify-content-center align-items-center mt-2">
            <div class="header-task-name">{{ tasksDictionary[task.taskId]?.publicName ?? task.taskId }}</div>
            <div class="text-xs uppercase font-thin text-gray-400">
              {{ task[task.scoreToDisplay].name }}
            </div>
            <div class="flex gap-2 mb-2">
              <div
                v-for="tag in task.tags"
                :key="tag"
                class="flex flex-row w-full align-items-center justify-content-center"
              >
                <PvTag
                  v-tooltip.top="tag.tooltip"
                  :icon="tag.icon"
                  :value="tag.value"
                  :severity="tag.severity"
                  class="text-xs"
                />
              </div>
            </div>
            <PvKnob
              :value-template="
                task.scoreToDisplay == 'percentileScore' ? getPercentileSuffix(task.percentileScore.value) : undefined
              "
              :model-value="task[task.scoreToDisplay].value"
              :size="180"
              :range-color="gray"
              :value-color="task[task.scoreToDisplay].supportColor"
              :min="task[task.scoreToDisplay].min"
              :max="task[task.scoreToDisplay].max"
            />
          </div>
        </div>

        <div v-if="rawOnlyTasks.includes(task.taskId)" class="score-description px-4 py-2">
          <i18n-t keypath="scoreReports.rawTaskDescription" tag="span">
            <template #firstName>
              {{ studentFirstName }}
            </template>
            <template #rawScore>
              <strong>{{ task.rawScore.value }}</strong>
            </template>
            <template #taskName>
              {{ taskDisplayNames[task.taskId]?.extendedName }}
            </template>
            <template #taskDescription>
              {{ extendedDescriptions[task.taskId] }}
            </template>
          </i18n-t>
        </div>
        <div v-else-if="grade >= 6" class="px-4 py-2 score-description">
          <i18n-t keypath="scoreReports.standardTaskDescription" tag="span">
            <template #firstName>
              {{ studentFirstName }}
            </template>
            <template #standardScore>
              <strong>{{ Math.round(task.standardScore.value) }}</strong>
            </template>
            <template #supportCategory>
              <strong>{{
                getSupportLevelLanguage(grade, task?.percentileScore.value, task?.rawScore.value, task.taskId)
              }}</strong>
            </template>
            <template #taskName>
              {{ taskDisplayNames[task.taskId]?.extendedName }}
            </template>
            <template #taskDescription>
              {{ extendedDescriptions[task.taskId] }}
            </template>
          </i18n-t>
        </div>

        <div v-else class="px-4 py-2 score-description">
          <i18n-t keypath="scoreReports.percentileTaskDescription" tag="span">
            <template #firstName>
              {{ studentFirstName }}
            </template>
            <template #percentile>
              <strong>{{ getPercentileWithSuffix(Math.round(task?.percentileScore.value)) }} percentile</strong>
            </template>
            <template #supportCategory>
              <strong>{{
                getSupportLevelLanguage(grade, task.percentileScore.value, task.rawScore.value, task.taskId)
              }}</strong>
            </template>
            <template #taskName>
              {{ taskDisplayNames[task.taskId]?.extendedName }}
            </template>
            <template #taskDescription>
              {{ extendedDescriptions[task.taskId] }}
            </template>
          </i18n-t>
        </div>
        <div v-if="!rawOnlyTasks.includes(task.taskId)">
          <PvAccordion class="my-2 w-full" :active-index="expanded ? 0 : null">
            <PvAccordionTab :header="$t('scoreReports.scoreBreakdown')">
              <div v-for="[key, rawScore, rangeMin, rangeMax] in task.scoresArray" :key="key">
                <div class="flex justify-content-between score-table">
                  <div class="mr-2">
                    <b>{{ key }}</b
                    ><span v-if="rangeMax" class="text-500"> ({{ rangeMin }}-{{ rangeMax }}):</span>
                    <span v-else>:</span>
                  </div>
                  <div class="ml-2">
                    <b>{{ isNaN(rawScore) ? rawScore : Math.round(rawScore) }}</b>
                  </div>
                </div>
              </div>
            </PvAccordionTab>
          </PvAccordion>
        </div>
        <div v-if="task.taskId === 'letter' || task.taskId === 'letter-en-ca'">
          <PvAccordion class="my-2 w-full" :active-index="expanded ? 0 : null">
            <PvAccordionTab :header="$t('scoreReports.scoreBreakdown')">
              <div v-for="[key, rawScore, rangeMin, rangeMax] in task.scoresArray" :key="key">
                <div v-if="!isNaN(rawScore)" class="flex justify-content-between score-table">
                  <div class="mr-2">
                    <b>{{ key }}</b
                    ><span v-if="rangeMax" class="text-500">({{ rangeMin }}-{{ rangeMax }}):</span>
                    <span v-else>:</span>
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
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import _lowerCase from 'lodash/lowerCase';
import _startCase from 'lodash/startCase';
import _toUpper from 'lodash/toUpper';
import _get from 'lodash/get';
import { getGrade } from '@bdelab/roar-utils';
import PvAccordion from 'primevue/accordion';
import PvAccordionTab from 'primevue/accordiontab';
import PvKnob from 'primevue/knob';
import PvTag from 'primevue/tag';
import useTasksDictionaryQuery from '@/composables/queries/useTasksDictionaryQuery';
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

const { t } = useI18n();

const { data: tasksDictionary, isLoading: isLoadingTasksDictionary } = useTasksDictionaryQuery();

const studentFirstName = computed(() => {
  if (props.studentData?.name && props.studentData?.name?.first) return props.studentData.name.first;
  if (props.studentData.username) return props.studentData.username;
  else return 'The student';
});

const grade = computed(() => getGrade(props.studentData?.studentData?.grade));

const tasksBlacklist = ['vocab', 'cva'];
// compute standard score, raw score, and percentile score for each of the tasks
const computedTaskData = computed(() => {
  const computedTaskAcc = {};

  for (const { taskId, scores, reliable, optional, engagementFlags } of props.taskData) {
    const { percentileScoreKey, standardScoreKey, rawScoreKey } = getScoreKeys(taskId, grade.value);
    const compositeScores = scores?.composite;
    let rawScore = null;
    if (!taskId.includes('vocab') && !taskId.includes('es')) {
      // letter's raw score is a percentage expressed as a float, so we need to multiply by 100.
      if (taskId.includes('letter')) {
        rawScore = _get(compositeScores, 'totalCorrect');
      } else {
        rawScore = _get(compositeScores, rawScoreKey);
      }
    } else {
      rawScore = compositeScores;
    }
    if (!isNaN(rawScore) && !tasksBlacklist.includes(taskId)) {
      const percentileScore = _get(compositeScores, percentileScoreKey);
      const standardScore = _get(compositeScores, standardScoreKey);
      const rawScoreRange = getRawScoreRange(taskId);
      const supportColor = getSupportLevel(grade.value, percentileScore, rawScore, taskId).tag_color;

      const scoresForTask = {
        standardScore: {
          name: _startCase(t('scoreReports.standardScore')),
          value: Math.round(standardScore),
          min: 0,
          max: 180,
          supportColor: supportColor,
        },
        rawScore: {
          name: _startCase(t('scoreReports.rawScore')),
          value: Math.round(rawScore),
          min: rawScoreRange?.min,
          max: rawScoreRange?.max,
          supportColor: 'gray',
        },
        percentileScore: {
          name: _startCase(t('scoreReports.percentileScore')),
          value: Math.round(percentileScore),
          min: 0,
          max: 99,
          supportColor: supportColor,
        },
      };

      // compute tags for reliable, optional, and add engagement flags if unreliable
      const tags = [];
      if (optional === true) {
        tags.push({
          icon: '',
          value: t('scoreReports.optional'),
          severity: 'secondary',
          tooltip: t('scoreReports.optionalTagText'),
        });
      } else {
        tags.push({
          icon: '',
          value: t('scoreReports.required'),
          severity: 'secondary',
          tooltip: t('scoreReports.requiredTagText'),
        });
      }
      if (reliable === false) {
        tags.push({
          value: t('scoreReports.unreliable'),
          icon: 'pi pi-times',
          severity: 'warning',
          tooltip: engagementFlags
            ? `${t('scoreReports.unreliableTagTextFlags')}: \n \n ${Object.keys(engagementFlags)
                .map((flag) => _lowerCase(flag))
                .join(', ')}`
            : t('scoreReports.unreliableTagText'),
        });
      } else {
        tags.push({
          value: t('scoreReports.reliable'),
          severity: 'success',
          icon: 'pi pi-check',
          tooltip: t('scoreReports.reliableTagText'),
        });
      }

      // determine which score to display in the card based on grade
      let scoreToDisplay = grade.value >= 6 ? 'standardScore' : 'percentileScore';
      if (rawOnlyTasks.includes(taskId)) {
        scoreToDisplay = 'rawScore';
      }

      computedTaskAcc[taskId] = {
        taskId: taskId,
        scoreToDisplay: scoreToDisplay,
        ...scoresForTask,
        tags: tags,
      };

      // initialize array with precomputed raw, std, percentile scores
      let formattedScoresArray = Object.keys(scoresForTask).map((key) => {
        const score = computedTaskAcc[taskId][key];
        if (score.name != undefined) {
          return [score.name, score.value, score.min, score.max];
        }
        return;
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

        formattedScoresArray.push([t('scoreReports.firstSoundMatching'), first]);
        formattedScoresArray.push([t('scoreReports.lastSoundMatching'), last]);
        formattedScoresArray.push([t('scoreReports.deletion'), deletion]);
        formattedScoresArray.push([t('scoreReports.skillsToWorkOn'), skillsString]);
      } else if (taskId === 'letter' || taskId === 'letter-en-ca') {
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
        formattedScoresArray.push([t('lowerCase'), lowerCaseScore, 0, 26]);
        formattedScoresArray.push([t('upperCase'), upperCaseScore, 0, 26]);
        formattedScoresArray.push([t('letterSounds'), letterSoundsScore, 0, 38]);
        formattedScoresArray.push([t('letterToWorkOn'), incorrectLetters]);
        formattedScoresArray.push([t('letterSoundsToWorkOn'), incorrectPhonemes]);
      }

      // Ensure scores are in consistent order
      const order = { 'Raw Score': 2, 'Percentile Score': 1, 'Standard Score': 0 };
      // remove percentile score from datatable for grades at and over sixth
      if (grade.value >= 6) {
        formattedScoresArray = formattedScoresArray.filter(([key]) => key !== 'Percentile Score');
      }

      const sortedScoresArray = formattedScoresArray.sort((first, second) => {
        return order[first[0]] - order[second[0]];
      });

      computedTaskAcc[taskId].scoresArray = sortedScoresArray;
    }
  }

  // sort tasks by order of appearance in the taskDisplayNames object
  return Object.keys(computedTaskAcc)
    .sort((a, b) => taskDisplayNames[a].order - taskDisplayNames[b].order)
    .map((taskId) => computedTaskAcc[taskId]);
});

function getSupportLevelLanguage(grade, percentile, rawScore, taskId) {
  const { support_level } = getSupportLevel(grade, percentile, rawScore, taskId);
  if (support_level) {
    if (support_level === 'Achieved Skill') {
      return t('scoreReports.achievedText');
    } else if (support_level === 'Developing Skill') {
      return t('scoreReports.developingText');
    } else if (support_level === 'Needs Extra Support') {
      return t('scoreReports.extraSupportText');
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
