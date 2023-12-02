<template>
  <div v-if="scoresDataQuery?.length ?? 0 > 0">
    <h2 class="header-text">ROAR-{{ _toUpper(taskId) }} STUDENT SCORE INFORMATION</h2>
    <RoarDataTable
      :columns="columns"
      :data="tableData"
      :totalRecords="scoresCount"
      lazy
      :pageLimit="pageLimit"
      @page="onPage($event)"
      @sort="onSort($event)"
      :loading="isLoadingScores || isFetchingScores"
      @export-all="exportAll"
      @export-selected="exportSelected"
    />
  </div>
</template>
<script setup>
import { computed, ref, onMounted } from "vue";
import _get from "lodash/get";
import _set from "lodash/set";
import _isEmpty from "lodash/isEmpty";
import _toUpper from "lodash/toUpper";
import { useQuery } from '@tanstack/vue-query';
import { orderByDefault, fetchDocById, exportCsv } from '@/helpers/query/utils';
import { assignmentPageFetcher, assignmentCounter, assignmentFetchAll } from "@/helpers/query/assignments";
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';

const props = defineProps({
  taskId: { required: true },
  administrationId: { required: true, default: "" },
  orgType: { required: true, default: "" },
  orgId: { required: true, default: "" },
})
const emit = defineEmits(['page']);

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const initialized = ref(false);

const orderBy = ref(orderByDefault);
const pageLimit = ref(10);
const page = ref(0);

const onPage = (event) => {
  page.value = event.page;
  pageLimit.value = event.rows;
}

const onSort = (event) => {
  const _orderBy = (event.multiSortMeta ?? []).map((item) => ({
    field: { fieldPath: item.field },
    direction: item.order === 1 ? "ASCENDING" : "DESCENDING",
  }));
  orderBy.value = !_isEmpty(_orderBy) ? _orderBy : orderByDefault;
}

// User Claims
const { isLoading: isLoadingClaims, isFetching: isFetchingClaims, data: userClaims } =
  useQuery({
    queryKey: ['userClaims'],
    queryFn: () => fetchDocById('userClaims', roarfirekit.value.roarUid),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
const claimsLoaded = computed(() => !isLoadingClaims.value);
let { isLoading: isLoadingScores, isFetching: isFetchingScores, data: scoresDataQuery } =
  useQuery({
    queryKey: ['scores', props.administrationId, props.orgId, pageLimit, page],
    queryFn: () => assignmentPageFetcher(props.administrationId, props.orgType, props.orgId, pageLimit, page, true),
    keepPreviousData: true,
    enabled: (initialized && claimsLoaded),
    staleTime: 5 * 60 * 1000, // 5 mins
  })
// Scores count query
const { isLoading: isLoadingCount, data: scoresCount } =
  useQuery({
    queryKey: ['assignments', props.administrationId, props.orgId],
    queryFn: () => assignmentCounter(props.administrationId, props.orgType, props.orgId),
    keepPreviousData: true,
    enabled: (initialized && claimsLoaded),
    staleTime: 5 * 60 * 1000,
  })

const columns = computed(() => {
  if (scoresDataQuery.value === undefined) return [];
  const tableColumns = [
    { field: "user.username", header: "Username", dataType: "text", pinned: true },
    { field: "user.name.first", header: "First Name", dataType: "text" },
    { field: "user.name.last", header: "Last Name", dataType: "text" },
    { field: "user.studentData.grade", header: "Grade", dataType: "text" },
  ];
  if(props.taskId === 'letter') {
    tableColumns.push(
      { field: "scores.letter.lowerCaseScore", header: "Lower Case", dataType: "text" },
      { field: "scores.letter.upperCaseScore", header: "Upper Case", dataType: "text" },
      { field: "scores.letter.phonemeScore", header: "Letter Sounds", dataType: "text" },
      { field: "scores.letter.totalScore", header: "Total", dataType: "text" },
      { field: "scores.letter.incorrectLetters", header: "Letters to Work On", dataType: "text" },
      { field: "scores.letter.incorrectPhonemes", header: "Sounds to Work On", dataType: "text"},
    )
  }
  if(props.taskId === 'pa') {
    tableColumns.push(
      { field: "scores.pa.firstSound", header: "First Sound", dataType: "text" },
      { field: "scores.pa.lastSound", header: "Last Sound", dataType: "text" },
      { field: "scores.pa.deletion", header: "Deletion", dataType: "text" },
      { field: "scores.pa.total", header: "Total", dataType: "text" },
      { field: "scores.pa.skills", header: "Skills to work on", dataType: "text"}
    )
  }
  return tableColumns
})

const tableData = computed(() => {
  if (scoresDataQuery.value === undefined) return [];
  return scoresDataQuery.value.map(({ user, assignment }) => {
    const scores = {};
    for (const assessment of (assignment?.assessments || [])) {
      if(assessment.taskId === 'letter') {
        if(_get(assessment, 'scores')){
          const incorrectLetters = [
            ...(_get(assessment, 'scores.computed.UppercaseNames.upperIncorrect') ?? '').split(','),
            ...(_get(assessment, 'scores.computed.LowercaseNames.lowerIncorrect') ?? '').split(',')
          ].sort((a, b) => _toUpper(a) - _toUpper(b)).filter(Boolean).join(', ');

          const incorrectPhonemes = (_get(assessment, 'scores.computed.Phonemes.phonemeIncorrect') ?? '').split(',').join(', ')

          _set(scores, 'letter', {
            upperCaseScore: _get(assessment, 'scores.computed.LowercaseNames.subScore'),
            lowerCaseScore: _get(assessment, 'scores.computed.UppercaseNames.subScore'),
            phonemeScore: _get(assessment, 'scores.computed.Phonemes.subScore'),
            totalScore: _get(assessment, 'scores.computed.composite'),
            incorrectLetters: incorrectLetters,
            incorrectPhonemes: incorrectPhonemes,
          })
        }
      }
      if(assessment.taskId === 'pa') {
        if(_get(assessment, 'scores')) {
          const first = _get(assessment, 'scores.computed.FSM.roarScore');
          const last = _get(assessment, 'scores.computed.LSM.roarScore');
          const deletion = _get(assessment, 'scores.computed.DEL.roarScore');
          let skills = []
          if(first < 15) skills.push('First Sound Matching')
          if(last < 15) skills.push('Last sound matching')
          if(deletion < 15) skills.push('Deletion')
          _set(scores, 'pa', {
            firstSound: first,
            lastSound: last,
            deletion: deletion,
            total: _get(assessment, 'scores.computed.composite.roarScore'),
            skills: skills.join(', ')
          })
        }
      }
    }
    return {
      user,
      assignment,
      scores
    }
  })
})

const exportSelected = (selectedRows) => {
  const computedExportData = selectedRows.map(({ user, assignment, scores }) => {
    let tableRow = {
      Username: _get(user, 'username'),
      First: _get(user, 'name.first'),
      Last: _get(user, 'name.last'),
      Grade: _get(user, 'studentData.grade'),
    }
    if(props.taskId === 'letter'){
      _set(tableRow, 'Upper Case', _get(scores, 'letter.upperCaseScore'))
      _set(tableRow, 'Lower Case', _get(scores, 'letter.lowerCaseScore'))
      _set(tableRow, 'Letter Sounds', _get(scores, 'letter.phonemeScore'))
      _set(tableRow, 'Total', _get(scores, 'letter.totalScore'))
      _set(tableRow, 'Letters to Work On', _get(scores, 'letter.incorrectLetters'))
      _set(tableRow, 'Sounds to Work On', _get(scores, 'letter.incorrectPhonemes'))
    }
    if(props.taskId === 'pa') {
      _set(tableRow, 'First Sound', _get(scores, 'pa.firstSound'))
      _set(tableRow, 'Last Sound', _get(scores, 'pa.lastSound'))
      _set(tableRow, 'Deletion', _get(scores, 'pa.deletion'))
      _set(tableRow, 'Total', _get(scores, 'pa.total'))
      _set(tableRow, 'Skills to Work On', _get(scores, 'pa.skills'))
    }
    return tableRow;
  })
  exportCsv(computedExportData, 'roar-scores.csv');
  return;
}

const exportAll = async () => {
  const exportData = await assignmentFetchAll(props.administrationId, props.orgType, props.orgId, true)
  const computedExportData = exportData.map(({ user, assignment }) => {
    let tableRow = {
      Username: _get(user, 'username'),
      First: _get(user, 'name.first'),
      Last: _get(user, 'name.last'),
      Grade: _get(user, 'studentData.grade'),
    }
    for (const assessment of (assignment?.assessments || [])) {
      if(assessment.taskId === 'letter') {
        if(_get(assessment, 'scores')){
          const incorrectLetters = [
            ...(_get(assessment, 'scores.computed.UppercaseNames.upperIncorrect') ?? '').split(','),
            ...(_get(assessment, 'scores.computed.LowercaseNames.lowerIncorrect') ?? '').split(',')
          ].sort((a, b) => _toUpper(a) - _toUpper(b)).filter(Boolean).join(', ');

          const incorrectPhonemes = (_get(assessment, 'scores.computed.Phonemes.phonemeIncorrect') ?? '').split(',').join(', ')

          _set(tableRow, 'Lower Case', _get(assessment, 'scores.computed.LowercaseNames.subScore'))
          _set(tableRow, 'Upper Case', _get(assessment, 'scores.computed.UppercaseNames.subScore'))
          _set(tableRow, 'Letter Sounds', _get(assessment, 'scores.computed.Phonemes.subScore'))
          _set(tableRow, 'Total', _get(assessment, 'scores.computed.composite'))
          _set(tableRow, 'Letters to Work On', incorrectLetters)
          _set(tableRow, 'Sounds to Work On', incorrectPhonemes)
        }
      }
      if(assessment.taskId === 'pa') {
        if(_get(assessment, 'scores')) {
          const first = _get(assessment, 'scores.computed.FSM.roarScore');
          const last = _get(assessment, 'scores.computed.LSM.roarScore');
          const deletion = _get(assessment, 'scores.computed.DEL.roarScore');
          let skills = []
          if(first < 15) skills.push('First Sound Matching')
          if(last < 15) skills.push('Last sound matching')
          if(deletion < 15) skills.push('Deletion')
          _set(tableRow, 'First Sound', first)
          _set(tableRow, 'Last Sound', last)
          _set(tableRow, 'Deletion', deletion)
          _set(tableRow, 'Total', _get(assessment, 'scores.computed.composite.roarScore'))
          _set(tableRow, 'Skills to Work on', skills.join(', '))
        }
      }
    }
    return tableRow
  })
  exportCsv(computedExportData, 'roar-scores.csv');
  return;
}

let unsubscribe;
const refresh = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) refresh();
});

onMounted(async () => {
  if (roarfirekit.value.restConfig) refresh();
})
</script>
<style>
.header-text {
  font-size: 2rem;
  text-align: center;
}
</style>