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
        :value-template="
          task.scoreToDisplay === 'percentileScore' ? getPercentileSuffix(task.percentileScore.value) : ''
        "
        :score-to-display="task.scoreToDisplay"
        :student-first-name="studentFirstName"
        :description="getScoreDescription(task)"
        :scores-array="getScoresArrayForTask(task)"
        :expanded="expanded"
      />
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import _lowerCase from 'lodash/lowerCase';
import _startCase from 'lodash/startCase';
import _toUpper from 'lodash/toUpper';
import _get from 'lodash/get';
import { getGrade } from '@bdelab/roar-utils';
import {
  rawOnlyTasks,
  taskDisplayNames,
  extendedDescriptions,
  getSupportLevel,
  getRawScoreRange,
  getScoreKeys,
} from '@/helpers/reports';
import ScoreCard from './ScoreCard.vue';

const props = defineProps({
  studentData: {
    type: Object,
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
  expanded: {
    type: Boolean,
    required: false,
  },
});

const { t } = useI18n();

const studentFirstName = computed(() => {
  return props.studentData?.name?.first || props.studentData.username || 'The student';
});

const grade = computed(() => getGrade(props.studentData?.studentData?.grade));

function getSupportLevelLanguage(grade, percentile, rawScore, taskId) {
  const { support_level } = getSupportLevel(grade, percentile, rawScore, taskId);
  return support_level === 'Achieved Skill'
    ? t('scoreReports.achievedText')
    : support_level === 'Developing Skill'
    ? t('scoreReports.developingText')
    : support_level === 'Needs Extra Support'
    ? t('scoreReports.extraSupportText')
    : '';
}

function getPercentileWithSuffix(percentile) {
  if (percentile % 10 === 1 && percentile !== 11) return percentile + 'st';
  if (percentile % 10 === 2 && percentile !== 12) return percentile + 'nd';
  if (percentile % 10 === 3 && percentile !== 13) return percentile + 'rd';
  return percentile + 'th';
}

function getPercentileSuffix(percentile) {
  if (percentile % 10 === 1 && percentile !== 11) return '{value}st';
  if (percentile % 10 === 2 && percentile !== 12) return '{value}nd';
  if (percentile % 10 === 3 && percentile !== 13) return '{value}rd';
  return '{value}th';
}

function getScoreDescription(task) {
  const taskName = taskDisplayNames[task.taskId]?.extendedName;
  const taskDescription = extendedDescriptions[task.taskId];

  if (rawOnlyTasks.includes(task.taskId)) {
    return {
      keypath: 'scoreReports.rawTaskDescription',
      slots: {
        rawScore: task.rawScore.value,
        taskName,
        taskDescription,
      },
    };
  } else if (grade.value >= 6) {
    return {
      keypath: 'scoreReports.standardTaskDescription',
      slots: {
        standardScore: Math.round(task.standardScore.value),
        supportCategory: getSupportLevelLanguage(
          grade.value,
          task?.percentileScore.value,
          task?.rawScore.value,
          task.taskId,
        ),
        taskName,
        taskDescription,
      },
    };
  } else {
    return {
      keypath: 'scoreReports.percentileTaskDescription',
      slots: {
        percentile: getPercentileWithSuffix(Math.round(task?.percentileScore.value)) + ' percentile',
        supportCategory: getSupportLevelLanguage(
          grade.value,
          task.percentileScore.value,
          task.rawScore.value,
          task.taskId,
        ),
        taskName,
        taskDescription,
      },
    };
  }
}

function getScoresArrayForTask(task) {
  if (!rawOnlyTasks.includes(task.taskId) || task.taskId === 'letter' || task.taskId === 'letter-en-ca') {
    return task.scoresArray;
  }
  return null;
}

const tasksBlacklist = ['vocab', 'cva'];

const computedTaskData = computed(() => {
  const computedTaskAcc = {};

  for (const { taskId, scores, reliable, optional, engagementFlags } of props.taskData) {
    const { percentileScoreKey, standardScoreKey, rawScoreKey } = getScoreKeys(taskId, grade.value);
    const compositeScores = scores?.composite;
    let rawScore = null;

    if (!taskId.includes('vocab') && !taskId.includes('es')) {
      rawScore = taskId.includes('letter') ? _get(compositeScores, 'totalCorrect') : _get(compositeScores, rawScoreKey);
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
          supportColor,
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
          supportColor,
        },
      };

      const tags = [];

      tags.push({
        icon: '',
        value: t(optional ? 'scoreReports.optional' : 'scoreReports.required'),
        severity: 'secondary',
        tooltip: t(optional ? 'scoreReports.optionalTagText' : 'scoreReports.requiredTagText'),
      });

      tags.push({
        value: t(reliable === false ? 'scoreReports.unreliable' : 'scoreReports.reliable'),
        icon: reliable === false ? 'pi pi-times' : 'pi pi-check',
        severity: reliable === false ? 'warning' : 'success',
        tooltip:
          reliable === false
            ? engagementFlags
              ? `${t('scoreReports.unreliableTagTextFlags')}: \n\n${Object.keys(engagementFlags)
                  .map((flag) => _lowerCase(flag))
                  .join(', ')}`
              : t('scoreReports.unreliableTagText')
            : t('scoreReports.reliableTagText'),
      });

      let scoreToDisplay = grade.value >= 6 ? 'standardScore' : 'percentileScore';
      if (rawOnlyTasks.includes(taskId)) scoreToDisplay = 'rawScore';

      computedTaskAcc[taskId] = {
        taskId,
        scoreToDisplay,
        ...scoresForTask,
        tags,
      };

      let formattedScoresArray = Object.keys(scoresForTask).map((key) => {
        const score = computedTaskAcc[taskId][key];
        return [score.name, score.value, score.min, score.max];
      });

      if (taskId === 'pa') {
        const fsm = scores?.FSM?.roarScore;
        const lsm = scores?.LSM?.roarScore;
        const del = scores?.DEL?.roarScore;
        const skills = [];
        if (fsm < 15) skills.push('FSM');
        if (lsm < 15) skills.push('LSM');
        if (del < 15) skills.push('DEL');

        formattedScoresArray.push([t('scoreReports.firstSoundMatching'), fsm]);
        formattedScoresArray.push([t('scoreReports.lastSoundMatching'), lsm]);
        formattedScoresArray.push([t('scoreReports.deletion'), del]);
        formattedScoresArray.push([t('scoreReports.skillsToWorkOn'), skills.join(', ') || 'None']);
      }

      if (taskId === 'letter' || taskId === 'letter-en-ca') {
        const incorrectLetters = [
          scores?.UppercaseNames?.upperIncorrect ?? '',
          scores?.LowercaseNames?.lowerIncorrect ?? '',
        ]
          .flat()
          .sort((a, b) => _toUpper(a).localeCompare(_toUpper(b)))
          .filter(Boolean)
          .join(', ');

        const incorrectPhonemes = (scores?.Phonemes?.phonemeIncorrect ?? []).join(', ');

        formattedScoresArray.push([t('Lower Case'), scores?.LowercaseNames?.subScore, 0, 26]);
        formattedScoresArray.push([t('Upper Case'), scores?.UppercaseNames?.subScore, 0, 26]);
        formattedScoresArray.push([t('Letter Sounds'), scores?.Phonemes?.subScore, 0, 38]);
        formattedScoresArray.push([t('Letter To Work On'), incorrectLetters]);
        formattedScoresArray.push([t('Letter Sounds To Work On'), incorrectPhonemes]);
      }

      const order = { 'Raw Score': 2, 'Percentile Score': 1, 'Standard Score': 0 };

      if (grade.value >= 6) {
        formattedScoresArray = formattedScoresArray.filter(([key]) => key !== 'Percentile Score');
      }

      const sortedScoresArray = formattedScoresArray.sort((a, b) => (order[a[0]] ?? 99) - (order[b[0]] ?? 99));

      computedTaskAcc[taskId].scoresArray = sortedScoresArray;
    }
  }

  return Object.keys(computedTaskAcc)
    .sort((a, b) => taskDisplayNames[a].order - taskDisplayNames[b].order)
    .map((taskId) => computedTaskAcc[taskId]);
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
