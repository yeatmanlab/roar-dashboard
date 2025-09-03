<template>
  <h2 class="header-text">{{ _toUpper(taskName) }} SCORE TABLE</h2>
  <RoarDataTable
    :columns="columns"
    :data="computedTableData"
    :page-limit="pageLimit"
    :allow-filtering="false"
    @export-all="exportAll"
    @export-selected="exportSelected"
  />
</template>
<script setup>
import { computed, ref, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { exportCsv } from '@/helpers/query/utils';
import _get from 'lodash/get';
import _kebabCase from 'lodash/kebabCase';
import _set from 'lodash/set';
import _toUpper from 'lodash/toUpper';
import { useAuthStore } from '@/store/auth';
import RoarDataTable from '@/components/RoarDataTable';
import {
  roamAlpacaSubskills,
  roamAlpacaSubskillHeaders,
  roamFluencySubskillHeaders,
  roamFluencyTasks,
} from '@/helpers/reports';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  administrationId: { type: String, default: '' },
  computedTableData: {
    type: Array,
    default: () => [],
  },
  taskId: { type: String, required: true },
  taskName: { type: String, required: true },
  orgType: { type: String, default: '' },
  orgId: { type: String, default: '' },
  administrationName: { type: String, default: '' },
  orgName: { type: String, default: '' },
});

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const initialized = ref(false);

const pageLimit = ref(10);

const columns = computed(() => {
  const tableColumns = [];
  if (props.computedTableData.find((assignment) => assignment.user?.username)) {
    tableColumns.push({
      field: 'user.username',
      header: 'Username',
      dataType: 'text',
      pinned: true,
      sort: true,
      filter: true,
    });
  }
  if (props.computedTableData.find((assignment) => assignment.user?.email)) {
    tableColumns.push({
      field: 'user.email',
      header: 'Email',
      dataType: 'text',
      pinned: true,
      sort: true,
      filter: true,
    });
  }
  if (props.computedTableData.find((assignment) => assignment.user?.firstName)) {
    tableColumns.push({ field: 'user.firstName', header: 'First Name', dataType: 'text', sort: true, filter: true });
  }
  if (props.computedTableData.find((assignment) => assignment.user?.lastName)) {
    tableColumns.push({ field: 'user.lastName', header: 'Last Name', dataType: 'text', sort: true, filter: true });
  }
  tableColumns.push({ field: 'user.grade', header: 'Grade', dataType: 'text', sort: true, filter: true });

  if (props.orgType === 'district') {
    tableColumns.push({
      field: 'user.schoolName',
      header: 'School',
      dataType: 'text',
      sort: true,
      filter: true,
    });
  }
  console.log('props.taskId', props.taskId);
  if (props.taskId === 'letter' || props.taskId === 'letter-en-ca') {
    console.log('exporting letter data', props.taskId);
    tableColumns.push(
      { field: `scores.${props.taskId}.lowerCaseScore`, header: 'Lower Case', dataType: 'text', sort: false },
      { field: `scores.${props.taskId}.upperCaseScore`, header: 'Upper Case', dataType: 'text', sort: false },
      { field: `scores.${props.taskId}.phonemeScore`, header: 'Letter Sounds', dataType: 'text', sort: false },
      { field: `scores.${props.taskId}.totalScore`, header: 'Total', dataType: 'text', sort: false },
      { field: `scores.${props.taskId}.incorrectLetters`, header: 'Letters To Work On', dataType: 'text', sort: false },
      { field: `scores.${props.taskId}.incorrectPhonemes`, header: 'Sounds To Work On', dataType: 'text', sort: false },
    );
  }
  if (props.taskId === 'phonics') {
    const subcategories = [
      { field: 'cvc', header: 'CVC' },
      { field: 'digraph', header: 'Digraph' },
      { field: 'initial_blend', header: 'Initial Blend' },
      { field: 'tri_blend', header: 'Triple Blend' },
      { field: 'final_blend', header: 'Final Blend' },
      { field: 'r_controlled', header: 'R-Controlled' },
      { field: 'r_cluster', header: 'R-Cluster' },
      { field: 'silent_e', header: 'Silent E' },
      { field: 'vowel_team', header: 'Vowel Team' },
    ];

    // Add columns for each subcategory
    subcategories.forEach(({ field, header }) => {
      tableColumns.push({
        field: `scores.${props.taskId}.composite.subscores.${field}.percentCorrect`,
        header: `${header} (Correct/Attempted)`,
        dataType: 'number',
        sort: true,
      });
    });

    // Add total percentage
    tableColumns.push({
      field: `scores.${props.taskId}.composite.totalPercentCorrect`,
      header: 'Total % Correct',
      dataType: 'number',
      sort: true,
    });
  }
  if (props.taskId === 'pa') {
    tableColumns.push(
      { field: 'scores.pa.firstSound', header: 'First Sound', dataType: 'text', sort: false },
      { field: 'scores.pa.lastSound', header: 'Last Sound', dataType: 'text', sort: false },
      { field: 'scores.pa.deletion', header: 'Deletion', dataType: 'text', sort: false },
      { field: 'scores.pa.total', header: 'Total', dataType: 'text', sort: false },
      { field: 'scores.pa.skills', header: 'Skills To Work On', dataType: 'text', sort: false },
    );
  }
  if (roamFluencyTasks.includes(props.taskId)) {
    tableColumns.push(
      { field: `scores.${props.taskId}.fr.rawScore`, header: 'Free Response', dataType: 'text', sort: false },
      { field: `scores.${props.taskId}.fc.rawScore`, header: 'Multiple Choice', dataType: 'text', sort: false },
    );
  }
  if (props.taskId === 'roam-alpaca') {
    const gradeEstimate = `scores.${props.taskId}.gradeEstimate`;
    tableColumns.push({
      field: `scores.${props.taskId}.composite.roarScore`,
      header: 'Raw Score',
      dataType: 'text',
      tagColor: `scores.${props.taskId}.composite.tagColor`,
      sort: false,
    });
    Object.entries(roamAlpacaSubskills).forEach(([subskillId, subskill]) => {
      tableColumns.push({
        field: `scores.${props.taskId}.${subskillId}.percentCorrect`,
        header: subskill,
        dataType: 'text',
        sort: false,
        tagColor: `scores.${props.taskId}.${subskillId}.tagColor`,
        ...(gradeEstimate && { gradeEstimate }),
      });
    });
    tableColumns.push({
      field: `scores.${props.taskId}.composite.incorrectSkills`,
      header: 'Skills To Work On',
      dataType: 'text',
      sort: false,
    });
  }
  return tableColumns;
});

const exportSelected = (selectedRows) => {
  const computedExportData = selectedRows.map(({ user, scores }) => {
    let tableRow = {
      Username: _get(user, 'username'),
      First: _get(user, 'firstName'),
      Last: _get(user, 'lastName'),
      Grade: _get(user, 'grade'),
    };
    if (props.taskId === 'letter' || props.taskId === 'letter-en-ca') {
      _set(tableRow, 'Lower Case', _get(scores, `${props.taskId}.lowerCaseScore`));
      _set(tableRow, 'Upper Case', _get(scores, `${props.taskId}.upperCaseScore`));
      _set(tableRow, 'Letter Sounds', _get(scores, `${props.taskId}.phonemeScore`));
      _set(tableRow, 'Total', _get(scores, `${props.taskId}.totalScore`));
      _set(tableRow, 'Letters To Work On', _get(scores, `${props.taskId}.incorrectLetters`));
      _set(tableRow, 'Sounds To Work On', _get(scores, `${props.taskId}.incorrectPhonemes`));
    }
    if (props.taskId === 'pa') {
      _set(tableRow, 'First Sound', _get(scores, 'pa.firstSound'));
      _set(tableRow, 'Last Sound', _get(scores, 'pa.lastSound'));
      _set(tableRow, 'Deletion', _get(scores, 'pa.deletion'));
      _set(tableRow, 'Total', _get(scores, 'pa.total'));
      _set(tableRow, 'Skills To Work On', _get(scores, 'pa.skills'));
    }
    if (roamFluencyTasks.includes(props.taskId)) {
      Object.entries(roamFluencySubskillHeaders).forEach(([property, propertyHeader]) => {
        _set(tableRow, `Free Response - ${propertyHeader}`, _get(scores, `${props.taskId}.fr.${property}`));
      });

      Object.entries(roamFluencySubskillHeaders).forEach(([property, propertyHeader]) => {
        _set(tableRow, `Multiple Choice - ${propertyHeader}`, _get(scores, `${props.taskId}.fc.${property}`));
      });
    }
    if (props.taskId === 'roam-alpaca') {
      _set(tableRow, 'Raw Score', _get(scores, `${props.taskId}.composite.roarScore`));
      _set(tableRow, 'Grade Estimate', _get(scores, `${props.taskId}.composite.gradeEstimate`));
      Object.entries(roamAlpacaSubskills).forEach(([subskillId, subskill]) => {
        Object.entries(roamAlpacaSubskillHeaders).forEach(([property, propertyHeader]) => {
          _set(tableRow, `${subskill} - ${propertyHeader}`, _get(scores, `${props.taskId}.${subskillId}.${property}`));
        });
      });
      _set(tableRow, 'Skills To Work On', _get(scores, `${props.taskId}.composite.incorrectSkills`));
    }
    return tableRow;
  });
  exportCsv(computedExportData, `roar-scores-${_kebabCase(props.taskId)}-selected.csv`);
  return;
};

const exportAll = async () => {
  const computedExportData = props.computedTableData.map(({ user, scores }) => {
    let tableRow = {
      Username: _get(user, 'username'),
      First: _get(user, 'firstName'),
      Last: _get(user, 'lastName'),
      Grade: _get(user, 'grade'),
    };
    if (props.taskId === 'letter' || props.taskId === 'letter-en-ca') {
      _set(tableRow, 'Lower Case', _get(scores, `${props.taskId}.lowerCaseScore`));
      _set(tableRow, 'Upper Case', _get(scores, `${props.taskId}.upperCaseScore`));
      _set(tableRow, 'Letter Sounds', _get(scores, `${props.taskId}.phonemeScore`));
      _set(tableRow, 'Total', _get(scores, `${props.taskId}.totalScore`));
      _set(tableRow, 'Letters To Work On', _get(scores, `${props.taskId}.incorrectLetters`));
      _set(tableRow, 'Sounds To Work On', _get(scores, `${props.taskId}.incorrectPhonemes`));
    } else if (props.taskId === 'phonics') {
      const subcategories = [
        'cvc',
        'digraph',
        'initial_blend',
        'tri_blend',
        'final_blend',
        'r_controlled',
        'r_cluster',
        'silent_e',
        'vowel_team',
      ];
      subcategories.forEach((category) => {
        const displayName = t(`scoreReports.phonics.${category}`);
        const subscore = _get(scores, `${props.taskId}.composite.subscores.${category}`);
        _set(tableRow, displayName, subscore ? `${subscore.correct}/${subscore.attempted}` : '0/0');
      });
      _set(tableRow, 'Skills To Work On', _get(scores, `${props.taskId}.skillsToWorkOn`));
    } else if (props.taskId === 'pa') {
      _set(tableRow, 'First Sound', _get(scores, 'pa.firstSound'));
      _set(tableRow, 'Last Sound', _get(scores, 'pa.lastSound'));
      _set(tableRow, 'Deletion', _get(scores, 'pa.deletion'));
      _set(tableRow, 'Total', _get(scores, 'pa.total'));
      _set(tableRow, 'Skills To Work On', _get(scores, 'pa.skills'));
    } else if (roamFluencyTasks.includes(props.taskId)) {
      Object.entries(roamFluencySubskillHeaders).forEach(([property, propertyHeader]) => {
        _set(tableRow, `Free Response - ${propertyHeader}`, _get(scores, `${props.taskId}.fr.${property}`));
      });

      Object.entries(roamFluencySubskillHeaders).forEach(([property, propertyHeader]) => {
        _set(tableRow, `Multiple Choice - ${propertyHeader}`, _get(scores, `${props.taskId}.fc.${property}`));
      });
    } else if (props.taskId === 'roam-alpaca') {
      _set(tableRow, 'Raw Score', _get(scores, `${props.taskId}.composite.roarScore`));
      _set(tableRow, 'Grade Estimate', _get(scores, `${props.taskId}.composite.gradeEstimate`));
      Object.entries(roamAlpacaSubskills).forEach(([subskillId, subskill]) => {
        Object.entries(roamAlpacaSubskillHeaders).forEach(([property, propertyHeader]) => {
          _set(tableRow, `${subskill} - ${propertyHeader}`, _get(scores, `${props.taskId}.${subskillId}.${property}`));
        });
      });
      _set(tableRow, 'Skills To Work On', _get(scores, `${props.taskId}.composite.incorrectSkills`));
    }
    return tableRow;
  });
  exportCsv(
    computedExportData,
    `roar-scores-${_kebabCase(props.taskId)}-${_kebabCase(props.administrationName)}-${_kebabCase(props.orgName)}.csv`,
  );
  return;
};

let unsubscribe;
const refresh = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig?.()) refresh();
});

onMounted(async () => {
  if (roarfirekit.value.restConfig?.()) refresh();
});
</script>
<style>
.header-text {
  font-size: 1.5rem;
  font-weight: bold;
  text-align: center;
}
</style>
