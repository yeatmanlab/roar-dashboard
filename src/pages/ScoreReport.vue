<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :actions="sidebarActions" />
    </aside>
    <section class="main-body">
      <PvPanel :header="`Administration Score Report: ${administrationInfo?.name ?? ''}`">
        <template #icons>
          <button class="p-panel-header-icon p-link mr-2" @click="refresh">
            <span :class="spinIcon"></span>
          </button>
        </template>

        <h2 v-if="orgInfo" class="report-title">{{ _toUpper(orgInfo.name) }} SCORE REPORT</h2>

        <!-- Header blurbs about tasks -->
        <h2>IN THIS REPORT...</h2>
        <span>You will receive a breakdown of your classroom's ROAR scores across each of the domains tested. </span>
        <div class="task-overview-container">
          <div v-if="allTasks.includes('letter')" class="task-blurb">
            <span class="task-header">ROAR-Letter Sound Matching (ROAR-Letter)</span> assesses knowledge of letter names
            and sounds.
          </div>
          <div v-if="allTasks.includes('pa')" class="task-blurb">
            <span class="task-header">ROAR-Phonological Awareness (ROAR-Phoneme)</span>
            measures the ability to hear and manipulate the individual sounds within words (sound matching and elision).
            This skill is crucial for building further reading skills, such as decoding.
          </div>
          <div v-if="allTasks.includes('swr') || allTasks.includes('swr-es')" class="task-blurb">
            <span class="task-header">ROAR-Single Word Recognition (ROAR-Word)</span> assesses decoding skills at the
            word level.
          </div>
          <div v-if="allTasks.includes('sre')" class="task-blurb">
            <span class="task-header">ROAR-Sentence Reading Efficiency (ROAR-Sentence)</span> assesses reading fluency
            at the sentence level.
          </div>
        </div>
        <div>
          <h1> Scores at Glance</h1>

          <DistributionChart
:initialized="initialized" :administration-id="administrationId" :org-type="orgType"
            :org-id="orgId" task-id="intro" graph-type="distOverview" />
        </div>

        <!-- Loading data spinner -->
        <div v-if="refreshing" class="loading-container">
          <AppSpinner style="margin-bottom: 1rem" />
          <span>Loading Administration Data</span>
        </div>

        <!-- Main table -->
        <div v-else-if="scoresDataQuery?.length ?? 0 > 0">
          <div class="toggle-container">
            <span>View</span>
            <PvDropdown
v-model="viewMode" :options="viewOptions" option-label="label" option-value="value"
              class="ml-2" />
          </div>
          <RoarDataTable
:data="tableData" :columns="columns" :total-records="scoresCount" lazy :page-limit="pageLimit"
            :loading="isLoadingScores || isFetchingScores" @page="onPage($event)" @sort="onSort($event)"
            @export-all="exportAll" @export-selected="exportSelected" />
        </div>

        <div class="legend-container">
          <div class="legend-entry">
            <div class="circle" :style="`background-color: ${supportLevelColors.below};`" />
            <div>
              <div>Needs extra support</div>
              <div>(Below 25th percentile)</div>
            </div>
          </div>
          <div class="legend-entry">
            <div class="circle" :style="`background-color: ${supportLevelColors.some};`" />
            <div>
              <div>Needs some support</div>
              <div>(Below 50th percentile)</div>
            </div>
          </div>
          <div class="legend-entry">
            <div class="circle" :style="`background-color: ${supportLevelColors.above};`" />
            <div>
              <div>At or above average</div>
              <div>(At or above 50th percentile)</div>
            </div>
          </div>
        </div>
        <div class="legend-description">
          Students are classified into three support groups based on nationally-normed percentiles. Blank spaces
          indicate that the assessment was not completed.
        </div>
        <!-- Subscores tables -->
        <SubscoreTable
v-if="allTasks.includes('letter')" task-id="letter" :task-name="taskDisplayNames['letter'].name"
          :administration-id="administrationId" :org-type="orgType" :org-id="orgId"
          :administration-name="administrationInfo.name ?? undefined" :org-name="orgInfo.name ?? undefined" />
        <SubscoreTable
v-if="allTasks.includes('pa')" task-id="pa" :task-name="taskDisplayNames['pa'].name"
          :administration-id="administrationId" :org-type="orgType" :org-id="orgId"
          :administration-name="administrationInfo.name ?? undefined" :org-name="orgInfo.name ?? undefined" />
        <!-- Task Breakdown TabView (TODO: try accordian as well) -->
        <PvTabView>
          <PvTabPanel v-for="task in allTasks" :key="task" :header="taskDisplayNames[task].name">
            <ReportSWR
v-if="task === 'swr'" :initialized="initialized" :administration-id="administrationId"
              :org-type="orgType" :org-id="orgId" />
            <ReportPA
v-if="task === 'pa'" :initialized="initialized" :administration-id="administrationId"
              :org-type="orgType" :org-id="orgId" />
            <ReportSRE
v-if="task === 'sre'" :initialized="initialized" :administration-id="administrationId"
              :org-type="orgType" :org-id="orgId" />
            <ReportLetter
v-if="task === 'letter'" :initialized="initialized" :administration-id="administrationId"
              :org-type="orgType" :org-id="orgId" />
            <ReportCVA
v-if="task === 'cva'" :initialized="initialized" :administration-id="administrationId"
              :org-type="orgType" :org-id="orgId" />
            <ReportMorph
v-if="task === 'morph'" :initialized="initialized" :administration-id="administrationId"
              :org-type="orgType" :org-id="orgId" />
          </PvTabPanel>
        </PvTabView>
        <div>
          <h2 class="extra-info-title">HOW ROAR SCORES INFORM PLANNING TO PROVIDE SUPPORT</h2>
          <p>
            Each foundational reading skill is a building block of the subsequent skill. Phonological awareness supports
            the development of word-level decoding skills. Word-level decoding supports sentence-reading fluency.
            Sentence-reading fluency supports reading comprehension. For students who need support in reading
            comprehension, their ROAR results can be used to inform the provision of support.
          </p>
          <ol>
            <li>
              Students who need support in all categories should begin with support in phonological awareness as the
              base of all other reading skills.
            </li>
            <li>
              Students who have phonological awareness skills but need support in single-word recognition would likely
              benefit from targeted instruction in decoding skills to improve accuracy.
            </li>
            <li>
              Students who have phonological awareness and word-decoding skills but need support in sentence-reading
              would likely benefit from sustained practice in reading for accuracy and fluency. These students
              demonstrate they can read at the word-level, but they do not appear to read quickly and accurately across
              the length of a sentence.
            </li>
          </ol>
          <!-- Reintroduce when we have somewhere for this link to go. -->
          <!-- <a href="google.com">Click here</a> for more guidance on steps you can take in planning to support your students. -->
        </div>
        <div>
          <h2 class="extra-info-title">NEXT STEPS</h2>
          <!-- Reintroduce when we have somewhere for this link to go. -->
          <!-- <p>This score report has provided a snapshot of your school's reading performance at the time of administration. By providing classifications for students based on national norms for scoring, you are able to see which students can benefit from varying levels of support. To read more about what to do to support your students, <a href="google.com">read here.</a></p> -->
          <p>
            This score report has provided a snapshot of your school's reading performance at the time of
            administration. By providing classifications for students based on national norms for scoring, you are able
            to see which students can benefit from varying levels of support.
          </p>
        </div>
      </PvPanel>
    </section>
  </main>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import _toUpper from 'lodash/toUpper';
import _round from 'lodash/round';
import _get from 'lodash/get';
import _map from 'lodash/map';
import _kebabCase from 'lodash/kebabCase';
import _find from 'lodash/find';
import _isEmpty from 'lodash/isEmpty';
import { useAuthStore } from '@/store/auth';
import { useQuery } from '@tanstack/vue-query';
import AdministratorSidebar from '@/components/AdministratorSidebar.vue';
import { getSidebarActions } from '@/router/sidebarActions';
import { getGrade } from '@bdelab/roar-utils';
import { orderByDefault, fetchDocById, exportCsv } from '../helpers/query/utils';
import { assignmentPageFetcher, assignmentCounter, assignmentFetchAll } from '@/helpers/query/assignments';
import { orgFetcher } from '@/helpers/query/orgs';
import { pluralizeFirestoreCollection } from '@/helpers';
import { taskDisplayNames, supportLevelColors, getSupportLevel } from '@/helpers/reports.js';
import SubscoreTable from '@/components/reports/SubscoreTable.vue';
import ReportSWR from '@/components/reports/tasks/ReportSWR.vue';
import ReportSRE from '@/components/reports/tasks/ReportSRE.vue';
import ReportPA from '@/components/reports/tasks/ReportPA.vue';
import ReportLetter from '@/components/reports/tasks/ReportLetter.vue';
import ReportCVA from '@/components/reports/tasks/ReportCVA.vue';
import ReportMorph from '@/components/reports/tasks/ReportMorph.vue';
import DistributionChart from '@/components/reports/DistributionChart.vue';

const authStore = useAuthStore();

const { roarfirekit } = storeToRefs(authStore);

const sidebarActions = ref(getSidebarActions(authStore.isUserSuperAdmin, true));

const props = defineProps({
  administrationId: {
    type: String,
    required: true,
  },
  orgType: {
    type: String,
    required: true,
  },
  orgId: {
    type: String,
    required: true,
  },
});

const initialized = ref(false);

// Queries for page
const orderBy = ref(orderByDefault);
const pageLimit = ref(10);
const page = ref(0);
// User Claims
const { isLoading: isLoadingClaims, data: userClaims } = useQuery({
  queryKey: ['userClaims', authStore.uid, authStore.userQueryKeyIndex],
  queryFn: () => fetchDocById('userClaims', authStore.uid),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});
const claimsLoaded = computed(() => !isLoadingClaims.value);
const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));
const adminOrgs = computed(() => userClaims.value?.claims?.minimalAdminOrgs);

const { data: administrationInfo } = useQuery({
  queryKey: ['administrationInfo', props.administrationId],
  queryFn: () => fetchDocById('administrations', props.administrationId, ['name']),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const { data: orgInfo } = useQuery({
  queryKey: ['orgInfo', props.orgId],
  queryFn: () => fetchDocById(pluralizeFirestoreCollection(props.orgType), props.orgId, ['name']),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Grab schools if this is a district score report
const { data: schoolsInfo } = useQuery({
  queryKey: ['schools', ref(props.orgId)],
  queryFn: () => orgFetcher('schools', ref(props.orgId), isSuperAdmin, adminOrgs),
  keepPreviousData: true,
  enabled: props.orgType === 'district' && initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const scoresQueryEnabled = computed(() => initialized.value && claimsLoaded.value);

// Scores Query
const {
  isLoading: isLoadingScores,
  isFetching: isFetchingScores,
  data: scoresDataQuery,
} = useQuery({
  queryKey: ['scores', props.administrationId, props.orgId, pageLimit, page],
  queryFn: () => assignmentPageFetcher(props.administrationId, props.orgType, props.orgId, pageLimit, page, true),
  keepPreviousData: true,
  enabled: scoresQueryEnabled,
  staleTime: 5 * 60 * 1000, // 5 mins
});

// Scores count query
const { data: scoresCount } = useQuery({
  queryKey: ['assignments', props.administrationId, props.orgId],
  queryFn: () => assignmentCounter(props.administrationId, props.orgType, props.orgId),
  keepPreviousData: true,
  enabled: scoresQueryEnabled,
  staleTime: 5 * 60 * 1000,
});

const onPage = (event) => {
  page.value = event.page;
  pageLimit.value = event.rows;
};

const onSort = (event) => {
  const _orderBy = (event.multiSortMeta ?? []).map((item) => ({
    field: { fieldPath: item.field },
    direction: item.order === 1 ? 'ASCENDING' : 'DESCENDING',
  }));
  orderBy.value = !_isEmpty(_orderBy) ? _orderBy : orderByDefault;
};

const viewMode = ref('color');

const viewOptions = ref([
  { label: 'Support Level', value: 'color' },
  { label: 'Percentile', value: 'percentile' },
  { label: 'Standard Score', value: 'standard' },
  { label: 'Raw Score', value: 'raw' },
]);

const rawOnlyTasks = ['letter'];

const getPercentileScores = ({ assessment, percentileScoreKey, percentileScoreDisplayKey }) => {
  let percentile = _get(assessment, `scores.computed.composite.${percentileScoreKey}`);
  let percentileString = _get(assessment, `scores.computed.composite.${percentileScoreDisplayKey}`);
  if (percentile) percentile = _round(percentile);
  if (percentileString && !isNaN(_round(percentileString))) percentileString = _round(percentileString);

  return {
    percentile,
    percentileString,
  };
};

const exportSelected = (selectedRows) => {
  const computedExportData = _map(selectedRows, ({ user, assignment }) => {
    let tableRow = {
      Username: _get(user, 'username'),
      First: _get(user, 'name.first'),
      Last: _get(user, 'name.last'),
      Grade: _get(user, 'studentData.grade'),
    };
    if (authStore.isUserSuperAdmin) {
      tableRow['PID'] = _get(user, 'assessmentPid');
    }
    if (props.orgType === 'district') {
      const currentSchools = _get(user, 'schools.current');
      if (currentSchools.length) {
        const schoolId = currentSchools[0];
        tableRow['School'] = _get(
          _find(schoolsInfo.value, (school) => school.id === schoolId),
          'name',
        );
      }
    }
    for (const assessment of assignment.assessments) {
      const taskId = assessment.taskId;
      const { percentileScoreKey, rawScoreKey, percentileScoreDisplayKey, standardScoreDisplayKey } = getScoreKeys(
        assessment,
        getGrade(_get(user, 'studentData.grade')),
      );
      const { percentile, percentileString } = getPercentileScores({
        assessment,
        percentileScoreKey,
        percentileScoreDisplayKey,
      });
      tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Percentile`] = percentileString;
      tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Standard`] = _get(
        assessment,
        `scores.computed.composite.${standardScoreDisplayKey}`,
      );
      tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Raw`] = rawOnlyTasks.includes(assessment.taskId)
        ? _get(assessment, 'scores.computed.composite')
        : _get(assessment, `scores.computed.composite.${rawScoreKey}`);
      const { support_level } = getSupportLevel(percentile);
      tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Support Level`] = support_level;
    }
    return tableRow;
  });
  exportCsv(computedExportData, 'roar-scores-selected.csv');
  return;
};

const exportAll = async () => {
  const exportData = await assignmentFetchAll(props.administrationId, props.orgType, props.orgId, true);
  const computedExportData = _map(exportData, ({ user, assignment }) => {
    let tableRow = {
      Username: _get(user, 'username'),
      First: _get(user, 'name.first'),
      Last: _get(user, 'name.last'),
      Grade: _get(user, 'studentData.grade'),
    };
    if (authStore.isUserSuperAdmin) {
      tableRow['PID'] = _get(user, 'assessmentPid');
    }
    if (props.orgType === 'district') {
      const currentSchools = _get(user, 'schools.current');
      if (currentSchools.length) {
        const schoolId = currentSchools[0];
        tableRow['School'] = _get(
          _find(schoolsInfo.value, (school) => school.id === schoolId),
          'name',
        );
      }
    }
    for (const assessment of assignment.assessments) {
      const taskId = assessment.taskId;
      const { percentileScoreKey, rawScoreKey, percentileScoreDisplayKey, standardScoreDisplayKey } = getScoreKeys(
        assessment,
        getGrade(_get(user, 'studentData.grade')),
      );
      const { percentile, percentileString } = getPercentileScores({
        assessment,
        percentileScoreKey,
        percentileScoreDisplayKey,
      });
      tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Percentile`] = percentileString;
      tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Standard`] = _get(
        assessment,
        `scores.computed.composite.${standardScoreDisplayKey}`,
      );
      tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Raw`] = rawOnlyTasks.includes(assessment.taskId)
        ? _get(assessment, 'scores.computed.composite')
        : _get(assessment, `scores.computed.composite.${rawScoreKey}`);
      const { support_level } = getSupportLevel(percentile);
      tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Support Level`] = support_level;
    }
    return tableRow;
  });
  exportCsv(
    computedExportData,
    `roar-scores-${_kebabCase(administrationInfo.value.name)}-${_kebabCase(orgInfo.value.name)}.csv`,
  );
  return;
};

function getScoreKeys(row, grade) {
  const taskId = row.taskId;
  let percentileScoreKey = undefined;
  let percentileScoreDisplayKey = undefined;
  let standardScoreKey = undefined;
  let standardScoreDisplayKey = undefined;
  let rawScoreKey = undefined;
  if (taskId === 'swr' || taskId === 'swr-es') {
    if (grade < 6) {
      percentileScoreKey = 'wjPercentile';
      percentileScoreDisplayKey = 'wjPercentile';
      standardScoreKey = 'standardScore';
      standardScoreDisplayKey = 'standardScore';
    } else {
      percentileScoreKey = 'sprPercentile';
      percentileScoreDisplayKey = 'sprPercentile';
      standardScoreKey = 'sprStandardScore';
      standardScoreDisplayKey = 'sprStandardScore';
    }
    rawScoreKey = 'roarScore';
  }
  if (taskId === 'pa') {
    if (grade < 6) {
      percentileScoreKey = 'percentile';
      percentileScoreDisplayKey = 'percentile';
      standardScoreKey = 'standardScore';
      standardScoreDisplayKey = 'standardScore';
    } else {
      // These are string values intended for display
      //   they include '>' when the ceiling is hit
      // Replace them with non '-String' versions for
      //   comparison.
      percentileScoreKey = 'sprPercentile';
      percentileScoreDisplayKey = 'sprPercentileString';
      standardScoreKey = 'sprStandardScore';
      standardScoreDisplayKey = 'sprStandardScoreString';
    }
    rawScoreKey = 'roarScore';
  }
  if (taskId === 'sre') {
    if (grade < 6) {
      percentileScoreKey = 'tosrecPercentile';
      percentileScoreDisplayKey = 'tosrecPercentile';
      standardScoreKey = 'tosrecSS';
      standardScoreDisplayKey = 'tosrecSS';
    } else {
      percentileScoreKey = 'sprPercentile';
      percentileScoreDisplayKey = 'sprPercentile';
      standardScoreKey = 'sprStandardScore';
      standardScoreDisplayKey = 'sprStandardScore';
    }
    rawScoreKey = 'sreScore';
  }
  return {
    percentileScoreKey,
    percentileScoreDisplayKey,
    standardScoreKey,
    standardScoreDisplayKey,
    rawScoreKey,
  };
}

const refreshing = ref(false);
const spinIcon = computed(() => {
  if (refreshing.value) return 'pi pi-spin pi-spinner';
  return 'pi pi-refresh';
});

const allTasks = computed(() => {
  if (tableData.value.length > 0) {
    return tableData.value[0].assignment.assessments.map((assessment) => assessment.taskId);
  } else return [];
});

const columns = computed(() => {
  if (scoresDataQuery.value === undefined) return [];
  const tableColumns = [
    { field: 'user.username', header: 'Username', dataType: 'text', pinned: true },
    { field: 'user.name.first', header: 'First Name', dataType: 'text' },
    { field: 'user.name.last', header: 'Last Name', dataType: 'text' },
    { field: 'user.studentData.grade', header: 'Grade', dataType: 'text' },
  ];

  if (props.orgType === 'district') {
    tableColumns.push({ field: 'user.schoolName', header: 'School', dataType: 'text' });
  }

  if (authStore.isUserSuperAdmin) {
    tableColumns.push({ field: 'user.assessmentPid', header: 'PID', dataType: 'text' });
  }

  if (tableData.value.length > 0) {
    const sortedTasks = allTasks.value.toSorted((p1, p2) => {
      if (Object.keys(taskDisplayNames).includes(p1) && Object.keys(taskDisplayNames).includes(p2)) {
        return taskDisplayNames[p1].order - taskDisplayNames[p2].order;
      } else {
        return -1;
      }
    });
    for (const taskId of sortedTasks) {
      let colField;
      if (viewMode.value === 'percentile') colField = `scores.${taskId}.percentile`;
      if (viewMode.value === 'standard') colField = `scores.${taskId}.standard`;
      if (viewMode.value === 'raw') colField = `scores.${taskId}.raw`;
      tableColumns.push({
        field: colField,
        header: taskDisplayNames[taskId]?.name ?? taskId,
        dataType: 'text',
        tag: viewMode.value !== 'color' && !rawOnlyTasks.includes(taskId),
        emptyTag: viewMode.value === 'color' || (rawOnlyTasks.includes(taskId) && viewMode.value !== 'raw'),
        tagColor: `scores.${taskId}.color`,
        tagOutlined: rawOnlyTasks.includes(taskId) && viewMode.value !== 'raw',
      });
    }
  }
  return tableColumns;
});

const tableData = computed(() => {
  if (scoresDataQuery.value === undefined) return [];
  return scoresDataQuery.value.map(({ user, assignment }) => {
    const scores = {};
    const grade = getGrade(_get(user, 'studentData.grade'));
    for (const assessment of assignment?.assessments || []) {
      const { percentileScoreKey, rawScoreKey, percentileScoreDisplayKey, standardScoreDisplayKey } = getScoreKeys(
        assessment,
        grade,
      );
      const { percentile, percentileString } = getPercentileScores({
        assessment,
        percentileScoreKey,
        percentileScoreDisplayKey,
      });
      const standardScore = _get(assessment, `scores.computed.composite.${standardScoreDisplayKey}`);
      const rawScore = rawOnlyTasks.includes(assessment.taskId)
        ? _get(assessment, 'scores.computed.composite')
        : _get(assessment, `scores.computed.composite.${rawScoreKey}`);
      const { support_level, tag_color } = getSupportLevel(percentile);
      scores[assessment.taskId] = {
        percentile: percentileString,
        standard: standardScore,
        raw: rawScore,
        support_level,
        color: rawOnlyTasks.includes(assessment.taskId) && rawScore ? 'white' : tag_color,
      };
    }
    // If this is a district score report, grab school information
    if (props.orgType === 'district') {
      // Grab user's school list
      const currentSchools = _get(user, 'schools.current');
      if (currentSchools.length) {
        const schoolId = currentSchools[0];
        const schoolName = _get(
          _find(schoolsInfo.value, (school) => school.id === schoolId),
          'name',
        );
        return {
          user: {
            ...user,
            schoolName,
          },
          assignment,
          scores,
          routeParams: {
            administrationId: props.administrationId,
            userId: _get(user, 'userId'),
          },
        };
      }
    }
    return {
      user,
      assignment,
      scores,
    };
  });
});

let unsubscribe;
const refresh = () => {
  refreshing.value = true;
  if (unsubscribe) unsubscribe();

  refreshing.value = false;
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) refresh();
});

onMounted(async () => {
  if (roarfirekit.value.restConfig) refresh();
});
</script>

<style>
.report-title {
  font-size: 3.5rem;
  margin-top: 0;
}

.task-header {
  font-weight: bold;
}

.task-overview-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 0.5rem;
}

.loading-container {
  text-align: center;
}

.toggle-container {
  display: flex;
  align-items: center;
  justify-content: end;
  width: 100%;
}

.legend-container {
  display: flex;
  flex-direction: row;
  gap: 3vw;
  justify-content: center;
  margin-top: 3rem;
}

.legend-entry {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.legend-description {
  text-align: center;
  margin-top: 1rem;
  margin-bottom: 3rem;
}

.circle {
  border-color: white;
  display: inline-block;
  border-radius: 50%;
  border-width: 5px;
  height: 25px;
  width: 25px;
  vertical-align: middle;
  margin-right: 10px;
}

.extra-info-title {
  font-size: 2rem;
}
</style>
