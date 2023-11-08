<template>
  <div>ROAR-{{ _capitalize(taskId) }} Student Score Information</div>
  <RoarDataTable :columns="columns" :data="tableData" :totalRecords="totalRecords" lazy :pageLimit="pageLimit" @page="onPage($event)" />
</template>
<script setup>
import { computed, ref, onMounted } from "vue";
import _capitalize from "lodash/capitalize"
import _get from "lodash/get";
import _set from "lodash/set";
import _zip from "lodash/zip";
import _toLower from "lodash/toLower";
import { useQuery } from '@tanstack/vue-query';
import { orderByDefault, exportCsv } from '@/helpers/query/utils';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';

const props = defineProps({
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

const columns = computed(() => {
  if (props.taskData === undefined) return [];
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
          console.log('assessment obj', assessment)
          const incorrectLetters = [
            ..._get(assessment, 'scores.computed.UppercaseNames.upperIncorrect').split(','),
            ..._get(assessment, 'scores.computed.LowercaseNames.lowerIncorrect').split(',')
          ].sort((a, b) => _toLower(a) - _toLower(b)).filter(Boolean).join(', ');

          const incorrectPhonemes = _get(assessment, 'scores.computed.Phonemes.phonemeIncorrect').split(',').join(', ')

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
          console.log('assessment obj', assessment)
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