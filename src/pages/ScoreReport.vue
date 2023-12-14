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

        <!-- Loading data spinner -->
        <div v-if="refreshing" class="loading-container">
          <AppSpinner style="margin-bottom: 1rem" />
          <span>Loading Administration Data</span>
        </div>

        <!-- Main table -->
        <div v-else-if="scoresCount === 0" class="no-scores-container">
          <h3>No scores found.</h3>
          <span
            >The filters applied have no matching scores.
            <PvButton text @click="resetFilters">Reset filters</PvButton></span
          >
        </div>
        <div v-else-if="scoresDataQuery?.length ?? 0 > 0">
          <div class="toggle-container">
            <span>View</span>
            <PvDropdown
              v-model="viewMode"
              :options="viewOptions"
              option-label="label"
              option-value="value"
              class="ml-2"
            />
          </div>
          <RoarDataTable
            :data="tableData"
            :columns="columns"
            :total-records="scoresCount"
            lazy
            :page-limit="pageLimit"
            :loading="isLoadingScores || isFetchingScores"
            @page="onPage($event)"
            @sort="onSort($event)"
            @filter="onFilter($event)"
            @export-all="exportAll"
            @export-selected="exportSelected"
          />
        </div>

        <div class="legend-container">
          <div class="legend-entry">
            <div class="circle" :style="`background-color: ${emptyTagColorMap.below};`" />
            <div>
              <div>Needs extra support</div>
              <div>(Below 25th percentile)</div>
            </div>
          </div>
          <div class="legend-entry">
            <div class="circle" :style="`background-color: ${emptyTagColorMap.some};`" />
            <div>
              <div>Needs some support</div>
              <div>(Below 50th percentile)</div>
            </div>
          </div>
          <div class="legend-entry">
            <div class="circle" :style="`background-color: ${emptyTagColorMap.above};`" />
            <div>
              <div>At or above average</div>
              <div>(At or above 50th percentile)</div>
            </div>
          </div>
          <div class="legend-description">
            Students are classified into three support groups based on nationally-normed percentiles. Blank spaces
            indicate that the assessment was not completed.
          </div>
        </div>
        <!-- Subscores tables -->
        <SubscoreTable
          v-if="allTasks.includes('letter')"
          task-id="letter"
          :task-name="displayNames['letter'].name"
          :administration-id="administrationId"
          :org-type="orgType"
          :org-id="orgId"
          :administration-name="administrationInfo.name ?? undefined"
          :org-name="orgInfo.name ?? undefined"
        />
        <SubscoreTable
          v-if="allTasks.includes('pa')"
          task-id="pa"
          :task-name="displayNames['pa'].name"
          :administration-id="administrationId"
          :org-type="orgType"
          :org-id="orgId"
          :administration-name="administrationInfo.name ?? undefined"
          :org-name="orgInfo.name ?? undefined"
        />
        <div v-if="authStore.isUserSuperAdmin">
          <DistributionChart
            v-for="task in allTasks"
            :key="task"
            :initialized="initialized"
            :administration-id="administrationId"
            :org-type="orgType"
            :org-id="orgId"
            :task-id="task"
          />
        </div>
        <!-- In depth breakdown of each task -->
        <div v-if="allTasks.includes('letter')" class="task-card">
          <div class="task-title">ROAR-LETTER</div>
          <span style="text-transform: uppercase">Letter Names and Letter-Sound Matching</span>
          <p class="task-description">
            ROAR-Letter assesses a student’s knowledge of letter names and letter sounds. Knowing letter names supports
            the learning of letter sounds, and knowing letter sounds supports the learning of letter names. Initial
            knowledge of letter names and letter sounds on entry to kindergarten has been shown to predict success in
            learning to read. Learning the connection between letters and the sounds they represent is fundamental for
            learning to decode and spell words. This assessment provides educators with valuable insights to customize
            instruction and address any gaps in these foundational skills.
          </p>
        </div>
        <div v-if="allTasks.includes('pa')" class="task-card">
          <div class="task-title">ROAR-PHONEME</div>
          <span style="text-transform: uppercase">Phonological Awareness</span>
          <p class="task-description">
            ROAR - Phoneme assesses a student's mastery of phonological awareness through elision and sound matching
            tasks. Research indicates that phonological awareness, as a foundational pre-reading skill, is crucial for
            achieving reading fluency. Without support for their foundational reading abilities, students may struggle
            to catch up in overall reading proficiency. The student's score will range between 0-57 and can be viewed by
            selecting 'Raw Score' on the table above.
          </p>
        </div>
        <div v-if="allTasks.includes('swr') || allTasks.includes('swr-es')" class="task-card">
          <div class="task-title">ROAR-WORD</div>
          <span style="text-transform: uppercase">Single Word Recognition</span>
          <p class="task-description">
            ROAR - Word evaluates a student's ability to quickly and automatically recognize individual words. To read
            fluently, students must master fundamental skills of decoding and automaticity. This test measures a
            student's ability to detect real and made-up words, which can then translate to a student's reading levels
            and need for support. The student's score will range between 100-900 and can be viewed by selecting 'Raw
            Score' on the table above.
          </p>
        </div>
        <div v-if="allTasks.includes('sre')" class="task-card">
          <div class="task-title">ROAR-SENTENCE</div>
          <span style="text-transform: uppercase">Sentence Reading Efficiency</span>
          <p class="task-description">
            ROAR - Sentence examines silent reading fluency and comprehension for individual sentences. To become fluent
            readers, students need to decode words accurately and read sentences smoothly. Poor fluency can make it
            harder for students to understand what they're reading. Students who don't receive support for their basic
            reading skills may find it challenging to improve their overall reading ability. This assessment is helpful
            for identifying students who may struggle with reading comprehension due to difficulties with decoding words
            accurately or reading slowly and with effort. The student's score will range between 0-130 and can be viewed
            by selecting 'Raw Score' on the table above.
          </p>
        </div>

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
import _head from 'lodash/head';
import _tail from 'lodash/tail';
import _isEmpty from 'lodash/isEmpty';
import { useAuthStore } from '@/store/auth';
import { useQuery } from '@tanstack/vue-query';
import AdministratorSidebar from '@/components/AdministratorSidebar.vue';
import DistributionChart from '@/components/reports/DistributionChart.vue';
import { getSidebarActions } from '@/router/sidebarActions';
import { getGrade } from '@bdelab/roar-utils';
import { orderByDefault, fetchDocById, exportCsv } from '../helpers/query/utils';
import { assignmentPageFetcher, assignmentCounter, assignmentFetchAll } from '@/helpers/query/assignments';
import { orgFetcher } from '@/helpers/query/orgs';
import { pluralizeFirestoreCollection } from '@/helpers';
import SubscoreTable from '@/components/reports/SubscoreTable.vue';

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
const filterBy = ref([]);
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
  queryKey: ['scores', props.administrationId, props.orgId, pageLimit, page, filterBy],
  queryFn: () =>
    assignmentPageFetcher(
      props.administrationId,
      props.orgType,
      props.orgId,
      pageLimit,
      page,
      true,
      undefined,
      true,
      filterBy.value,
    ),
  keepPreviousData: true,
  enabled: scoresQueryEnabled,
  staleTime: 5 * 60 * 1000, // 5 mins
});

// Scores count query
const { data: scoresCount } = useQuery({
  queryKey: ['assignments', props.administrationId, props.orgId, filterBy],
  queryFn: () => assignmentCounter(props.administrationId, props.orgType, props.orgId, filterBy.value),
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

const onFilter = (event) => {
  const filters = [];
  for (const filterKey in _get(event, 'filters')) {
    const filter = _get(event, 'filters')[filterKey];
    const constraint = _head(_get(filter, 'constraints'));
    if (_get(constraint, 'value')) {
      const path = filterKey.split('.');
      let collection;
      if (_head(path) === 'user') {
        collection = 'users';
        filters.push({ ...constraint, collection, field: _tail(path).join('.') });
      }
      if (_head(path) === 'scores') {
        const taskId = path[1];
        const grade = _get(constraint, 'nationalNorms') ? 1 : 10;
        const { percentileScoreKey } = getScoreKeys({ taskId: taskId }, grade);
        filters.push({
          ...constraint,
          collection: 'scores',
          taskId: taskId,
          field: `scores.computed.composite.${percentileScoreKey}`,
        });
      }
      // console.log('constraint is', { ...constraint, collection, field: _tail(path).join('.') })
    }
  }
  // Scores Query
  filterBy.value = filters;
};

const resetFilters = () => {
  filterBy.value = [];
};
const viewMode = ref('color');

const viewOptions = ref([
  { label: 'Support Level', value: 'color' },
  { label: 'Percentile', value: 'percentile' },
  { label: 'Standard Score', value: 'standard' },
  { label: 'Raw Score', value: 'raw' },
]);

const displayNames = {
  swr: { name: 'Word', order: 3 },
  'swr-es': { name: 'Palabra', order: 4 },
  pa: { name: 'Phoneme', order: 2 },
  sre: { name: 'Sentence', order: 5 },
  letter: { name: 'Letter', order: 1 },
  multichoice: { name: 'Multichoice', order: 6 },
  mep: { name: 'MEP', order: 7 },
  ExternalTask: { name: 'External Task', order: 8 },
  ExternalTest: { name: 'External Test', order: 9 },
};
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
      tableRow[`${displayNames[taskId]?.name ?? taskId} - Percentile`] = percentileString;
      tableRow[`${displayNames[taskId]?.name ?? taskId} - Standard`] = _get(
        assessment,
        `scores.computed.composite.${standardScoreDisplayKey}`,
      );
      tableRow[`${displayNames[taskId]?.name ?? taskId} - Raw`] = rawOnlyTasks.includes(assessment.taskId)
        ? _get(assessment, 'scores.computed.composite')
        : _get(assessment, `scores.computed.composite.${rawScoreKey}`);
      const { support_level } = getSupportLevel(percentile);
      tableRow[`${displayNames[taskId]?.name ?? taskId} - Support Level`] = support_level;
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
      tableRow[`${displayNames[taskId]?.name ?? taskId} - Percentile`] = percentileString;
      tableRow[`${displayNames[taskId]?.name ?? taskId} - Standard`] = _get(
        assessment,
        `scores.computed.composite.${standardScoreDisplayKey}`,
      );
      tableRow[`${displayNames[taskId]?.name ?? taskId} - Raw`] = rawOnlyTasks.includes(assessment.taskId)
        ? _get(assessment, 'scores.computed.composite')
        : _get(assessment, `scores.computed.composite.${rawScoreKey}`);
      const { support_level } = getSupportLevel(percentile);
      tableRow[`${displayNames[taskId]?.name ?? taskId} - Support Level`] = support_level;
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

function getSupportLevel(percentile) {
  let support_level = null;
  let tag_color = null;
  if (percentile !== undefined) {
    if (percentile >= 50) {
      support_level = 'At or Above Average';
      tag_color = emptyTagColorMap.above;
    } else if (percentile > 25 && percentile < 50) {
      support_level = 'Needs Some Support';
      tag_color = emptyTagColorMap.some;
    } else {
      support_level = 'Needs Extra Support';
      tag_color = emptyTagColorMap.below;
    }
  }
  return {
    support_level,
    tag_color,
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

const emptyTagColorMap = {
  above: 'green',
  some: '#edc037',
  below: '#c93d82',
};

const columns = computed(() => {
  if (scoresDataQuery.value === undefined) return [];
  const tableColumns = [
    { field: 'user.username', header: 'Username', dataType: 'text', pinned: true, sort: false },
    { field: 'user.name.first', header: 'First Name', dataType: 'text', sort: false },
    { field: 'user.name.last', header: 'Last Name', dataType: 'text', sort: false },
    { field: 'user.studentData.grade', header: 'Grade', dataType: 'number', sort: false },
  ];

  if (props.orgType === 'district') {
    tableColumns.push({ field: 'user.schoolName', header: 'School', dataType: 'text', sort: false });
  }

  if (authStore.isUserSuperAdmin) {
    tableColumns.push({ field: 'user.assessmentPid', header: 'PID', dataType: 'text', sort: false });
  }

  if (tableData.value.length > 0) {
    const sortedTasks = allTasks.value.toSorted((p1, p2) => {
      if (Object.keys(displayNames).includes(p1) && Object.keys(displayNames).includes(p2)) {
        return displayNames[p1].order - displayNames[p2].order;
      } else {
        return -1;
      }
    });
    for (const taskId of sortedTasks) {
      let colField;
      // Color needs to include a field to allow sorting.
      if (viewMode.value === 'percentile' || viewMode.value === 'color') colField = `scores.${taskId}.percentile`;
      if (viewMode.value === 'standard') colField = `scores.${taskId}.standard`;
      if (viewMode.value === 'raw') colField = `scores.${taskId}.raw`;
      tableColumns.push({
        field: colField,
        header: displayNames[taskId]?.name ?? taskId,
        dataType: 'score',
        sort: false,
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

<style lang="scss">
.report-title {
  font-size: 3.5rem;
  margin-top: 0;
}

.task-header {
  font-weight: bold;
}

.task-card {
  background: #f6f6fe;
  padding: 2rem;
  text-align: center;
  margin-bottom: 1rem;
}

.task-title {
  font-size: 3.5rem;
  /* font-weight: bold; */
}

.task-description {
  font-size: 1.25rem;
  text-align: left;
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

.no-scores-container {
  display: flex;
  flex-direction: column;
  padding: 2rem;
  h3 {
    font-weight: bold;
  }
  span {
    display: flex;
    align-items: center;
  }
}
</style>
