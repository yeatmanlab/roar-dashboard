<template>
  <main class="container main">
    <section class="main-body">
      <div>
        <div class="">
          <div v-if="isLoadingOrgInfo" class="loading-wrapper">
            <AppSpinner style="margin: 0.3rem 0rem" />
            <div class="uppercase text-sm">Loading Org Info</div>
          </div>
          <div v-if="orgInfo">
            <div class="report-title">
              {{ _toUpper(orgInfo.name) }}
            </div>
            <div class="report-subheader mb-3 uppercase text-gray-500 font-normal">Scores at a glance</div>
            <div v-if="isLoadingRunResults" class="loading-wrapper">
              <AppSpinner style="margin: 1rem 0rem" />
              <div class="uppercase text-sm">Loading Overview Charts</div>
            </div>
            <!-- <div v-if="isSuperAdmin && !isLoadingRunResults" class="overview-wrapper bg-gray-100 py-3 mb-2"> -->
            <div
              v-if="isSuperAdmin && sortedAndFilteredTaskIds?.length > 0"
              class="overview-wrapper bg-gray-100 py-3 mb-2"
            >
              <div class="chart-wrapper">
                <div v-for="taskId of sortedAndFilteredTaskIds" :key="taskId" class="">
                  <div class="distribution-overview-wrapper">
                    <DistributionChartOverview
                      :runs="runsByTaskId[taskId]"
                      :initialized="initialized"
                      :task-id="taskId"
                      :org-type="props.orgType"
                      :org-id="props.orgId"
                      :administration-id="props.administrationId"
                    />
                    <div className="task-description mt-3">
                      <span class="font-bold">
                        {{ descriptionsByTaskId[taskId]?.header ? descriptionsByTaskId[taskId].header : '' }}
                      </span>
                      <span class="font-light">
                        {{ descriptionsByTaskId[taskId]?.description ? descriptionsByTaskId[taskId].description : '' }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="!isLoadingRunResults && sortedAndFilteredTaskIds?.length > 0" class="legend-container">
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
            </div>
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
            <PvButton text @click="resetFilters">Reset filters</PvButton>
          </span>
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
        <div v-if="!isLoadingRunResults" class="legend-container">
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
        <div v-if="isLoadingRunResults" class="loading-wrapper">
          <AppSpinner style="margin: 1rem 0rem" />
          <div class="uppercase text-sm">Loading Task Reports</div>
        </div>
        <PvTabView v-if="isSuperAdmin">
          <PvTabPanel
            v-for="taskId of sortedTaskIds"
            :key="taskId"
            :header="taskDisplayNames[taskId]?.name ? ('ROAR-' + taskDisplayNames[taskId]?.name).toUpperCase() : ''"
          >
            <TaskReport
              v-if="taskId"
              :task-id="taskId"
              :initialized="initialized"
              :administration-id="administrationId"
              :runs="runsByTaskId[taskId]"
              :org-type="orgType"
              :org-id="orgId"
              :org-info="orgInfo"
              :administration-info="administrationInfo"
            />
          </PvTabPanel>
        </PvTabView>
        <div v-else>
          <!-- In depth breakdown of each task -->
          <div v-if="allTasks.includes('letter')" class="task-card">
            <div class="task-title">ROAR-LETTER NAMES AND SOUNDS</div>
            <span style="text-transform: uppercase">Letter Names and Letter-Sound Matching</span>
            <p class="task-description">
              ROAR-Letter Names and Sounds assesses a student’s knowledge of letter names and letter sounds. Knowing
              letter names supports the learning of letter sounds, and knowing letter sounds supports the learning of
              letter names. Initial knowledge of letter names and letter sounds on entry to kindergarten has been shown
              to predict success in learning to read. Learning the connection between letters and the sounds they
              represent is fundamental for learning to decode and spell words. This assessment provides educators with
              valuable insights to customize instruction and address any gaps in these foundational skills.
            </p>
          </div>
          <div v-if="allTasks.includes('pa')" class="task-card">
            <div class="task-title">ROAR-PHONEME</div>
            <span style="text-transform: uppercase">Phonological Awareness</span>
            <p class="task-description">
              ROAR - Phoneme assesses a student's mastery of phonological awareness through elision and sound matching
              tasks. Research indicates that phonological awareness, as a foundational pre-reading skill, is crucial for
              achieving reading fluency. Without support for their foundational reading abilities, students may struggle
              to catch up in overall reading proficiency. The student's score will range between 0-57 and can be viewed
              by selecting 'Raw Score' on the table above.
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
              ROAR - Sentence examines silent reading fluency and comprehension for individual sentences. To become
              fluent readers, students need to decode words accurately and read sentences smoothly. Poor fluency can
              make it harder for students to understand what they're reading. Students who don't receive support for
              their basic reading skills may find it challenging to improve their overall reading ability. This
              assessment is helpful for identifying students who may struggle with reading comprehension due to
              difficulties with decoding words accurately or reading slowly and with effort. The student's score will
              range between 0-130 and can be viewed by selecting 'Raw Score' on the table above.
            </p>
          </div>
        </div>
        <div class="bg-gray-200 px-4 py-2 mt-4">
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
        <div class="bg-gray-200 px-4 py-2">
          <h2 class="extra-info-title">NEXT STEPS</h2>
          <!-- Reintroduce when we have somewhere for this link to go. -->
          <!-- <p>This score report has provided a snapshot of your school's reading performance at the time of administration. By providing classifications for students based on national norms for scoring, you are able to see which students can benefit from varying levels of support. To read more about what to do to support your students, <a href="google.com">read here.</a></p> -->
          <p>
            This score report has provided a snapshot of your student's reading performance at the time of
            administration. By providing classifications for students based on national norms for scoring, you are able
            to see how your student(s) can benefit from varying levels of support. To read more about what to do to
            support your student, <a :href="NextSteps" class="hover:text-red-700" target="_blank">read more.</a>
          </p>
        </div>
      </div>
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
import _filter from 'lodash/filter';
import _pickBy from 'lodash/pickBy';
import { useAuthStore } from '@/store/auth';
import { useQuery } from '@tanstack/vue-query';
import { getGrade } from '@bdelab/roar-utils';
import { fetchDocById, exportCsv } from '@/helpers/query/utils';
import { assignmentPageFetcher, assignmentCounter, assignmentFetchAll } from '@/helpers/query/assignments';
import { orgFetcher } from '@/helpers/query/orgs';
import { runPageFetcher } from '@/helpers/query/runs';
import { pluralizeFirestoreCollection } from '@/helpers';
import {
  taskDisplayNames,
  descriptionsByTaskId,
  excludedTasks,
  supportLevelColors,
  getSupportLevel,
  tasksToDisplayGraphs,
} from '@/helpers/reports.js';
import TaskReport from '@/components/reports/tasks/TaskReport.vue';
import DistributionChartOverview from '@/components/reports/DistributionChartOverview.vue';
import NextSteps from '@/assets/NextSteps.pdf';

const authStore = useAuthStore();

const { roarfirekit } = storeToRefs(authStore);

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
const orderBy = ref([]);
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

const { data: orgInfo, isLoading: isLoadingOrgInfo } = useQuery({
  queryKey: ['orgInfo', props.orgId],
  queryFn: () => fetchDocById(pluralizeFirestoreCollection(props.orgType), props.orgId, ['name']),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Grab schools if this is a district score report
const { data: schoolsInfo } = useQuery({
  queryKey: ['schools', ref(props.orgId)],
  queryFn: () => orgFetcher('schools', ref(props.orgId), isSuperAdmin, adminOrgs, ['name', 'id', 'lowGrade']),
  keepPreviousData: true,
  enabled: props.orgType === 'district' && initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const schoolsDict = computed(() => {
  if (schoolsInfo.value) {
    return schoolsInfo.value.reduce((acc, school) => {
      acc[school.id] = parseLowGrade(school.lowGrade) + ' ' + school.name;
      return acc;
    }, {});
  } else {
    return {};
  }
});

const scoresQueryEnabled = computed(() => initialized.value && claimsLoaded.value);

// Scores Query
const {
  isLoading: isLoadingScores,
  isFetching: isFetchingScores,
  data: scoresDataQuery,
} = useQuery({
  queryKey: ['scores', props.administrationId, props.orgId, pageLimit, page, filterBy, orderBy],
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
      orderBy.value,
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
  console.log('onSort');
  const _orderBy = (event.multiSortMeta ?? []).map((item) => {
    let field = item.field.replace('user', 'userData');
    // Due to differences in the document schemas,
    //   fields found in studentData in the user document are in the
    //   top level of the assignments.userData object.
    if (field.split('.')[1] === 'studentData') {
      field = `userData.${field.split('.').slice(2, field.length)}`;
    }
    return {
      field: { fieldPath: field },
      direction: item.order === 1 ? 'ASCENDING' : 'DESCENDING',
    };
  });
  orderBy.value = !_isEmpty(_orderBy) ? _orderBy : [];
  page.value = 0;
};

const onFilter = (event) => {
  console.log('onFilter');
  const filters = [];
  for (const filterKey in _get(event, 'filters')) {
    const filter = _get(event, 'filters')[filterKey];
    const constraint = _head(_get(filter, 'constraints'));
    if (_get(constraint, 'value')) {
      const path = filterKey.split('.');
      if (_head(path) === 'user') {
        // Special case for school
        if (path[1] === 'schoolName') {
          // find ID from given name
          const schoolName = constraint.value;
          const schoolEntry = _find(schoolsInfo.value, { name: schoolName });
          if (!_isEmpty(schoolEntry)) {
            filters.push({ value: schoolEntry.id, collection: 'school', field: 'assigningOrgs.schools' });
          }
        } else if (path[1] === 'studentData') {
          // Due to differences in the document schemas,
          //   fields found in studentData in the user document are in the
          //   top level of the assignments.userData object.
          filters.push({ ...constraint, collection: 'users', field: path.slice(2, path.length) });
        } else {
          filters.push({ ...constraint, collection: 'users', field: _tail(path).join('.') });
        }
      }
      if (_head(path) === 'scores') {
        const taskId = path[1];
        const grade = _get(constraint, 'gradeRange');
        const { percentileScoreKey } = getScoreKeys({ taskId: taskId }, grade);
        filters.push({
          ...constraint,
          collection: 'scores',
          taskId: taskId,
          field: `scores.computed.composite.${percentileScoreKey}`,
        });
      }
    }
  }
  // Scores Query
  filterBy.value = filters;
  page.value = 0;
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

const rawOnlyTasks = ['letter', 'multichoice', 'vocab', 'fluency'];

const getPercentileScores = ({ assessment, percentileScoreKey, percentileScoreDisplayKey }) => {
  let percentile = _get(assessment, `scores.computed.composite.${percentileScoreKey}`);
  let percentileString = _get(assessment, `scores.computed.composite.${percentileScoreDisplayKey}`);
  const { support_level, tag_color } = getSupportLevel(percentile);
  if (percentile) percentile = _round(percentile);
  if (percentileString && !isNaN(_round(percentileString))) percentileString = _round(percentileString);

  return {
    support_level,
    tag_color,
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
      const { percentileString, support_level } = getPercentileScores({
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
      const { percentileString, support_level } = getPercentileScores({
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

const columns = computed(() => {
  if (scoresDataQuery.value === undefined) return [];
  const tableColumns = [
    { field: 'user.username', header: 'Username', dataType: 'text', pinned: true, sort: true },
    { field: 'user.name.first', header: 'First Name', dataType: 'text', sort: true },
    { field: 'user.name.last', header: 'Last Name', dataType: 'text', sort: true },
    { field: 'user.studentData.grade', header: 'Grade', dataType: 'text', sort: true },
  ];

  if (props.orgType === 'district') {
    tableColumns.push({ field: 'user.schoolName', header: 'School', dataType: 'text', sort: false });
  }

  if (authStore.isUserSuperAdmin) {
    tableColumns.push({ field: 'user.assessmentPid', header: 'PID', dataType: 'text', sort: false });
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
      // Color needs to include a field to allow sorting.
      if (viewMode.value === 'percentile' || viewMode.value === 'color') colField = `scores.${taskId}.percentile`;
      if (viewMode.value === 'standard') colField = `scores.${taskId}.standard`;
      if (viewMode.value === 'raw') colField = `scores.${taskId}.raw`;
      tableColumns.push({
        field: colField,
        header: taskDisplayNames[taskId]?.name ?? taskId,
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
    for (const assessment of assignment?.assessments ?? []) {
      const { percentileScoreKey, rawScoreKey, percentileScoreDisplayKey, standardScoreDisplayKey } = getScoreKeys(
        assessment,
        grade,
      );
      const { percentileString, support_level, tag_color } = getPercentileScores({
        assessment,
        percentileScoreKey,
        percentileScoreDisplayKey,
      });
      const standardScore = _get(assessment, `scores.computed.composite.${standardScoreDisplayKey}`);
      const rawScore = rawOnlyTasks.includes(assessment.taskId)
        ? _get(assessment, 'scores.computed.composite')
        : _get(assessment, `scores.computed.composite.${rawScoreKey}`);
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

const allTasks = computed(() => {
  if (tableData.value.length > 0) {
    let ids = tableData.value[0].assignment.assessments.map((assessment) => assessment.taskId);
    return _filter(ids, (taskId) => {
      return !excludedTasks.includes(taskId);
    });
  } else return [];
});

// Runs query for all tasks under admin id
const { isLoading: isLoadingRunResults, data: runResults } = useQuery({
  queryKey: ['scores', ref(0), props.orgType, props.orgId, props.administrationId],
  queryFn: () =>
    runPageFetcher({
      administrationId: props.administrationId,
      orgType: props.orgType,
      orgId: props.orgId,
      pageLimit: ref(0),
      page: ref(0),
      paginate: false,
      select: ['scores.computed.composite', 'taskId'],
      scoreKey: 'scores.computed.composite',
    }),
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

function scoreFieldBelowSixth(taskId) {
  if (taskId === 'swr') {
    return 'wjPercentile';
  } else if (taskId === 'sre') {
    return 'tosrecPercentile';
  } else if (taskId === 'pa') {
    return 'percentile';
  }
  return 'percentile';
}

function scoreFieldAboveSixth(taskId) {
  if (taskId === 'swr') {
    return 'sprPercentile';
  } else if (taskId === 'sre') {
    return 'sprPercentile';
  } else if (taskId === 'pa') {
    return 'sprPercentile';
  }
  return 'percentile';
}

function rawScoreByTaskId(taskId) {
  if (taskId === 'swr') {
    return 'roarScore';
  } else if (taskId === 'sre') {
    return 'sreScore';
  } else if (taskId === 'pa') {
    return 'roarScore';
  }
  return 'roarScore';
}

const parseLowGrade = (grade) => {
  if (grade === 'PreKindergarten' || grade === 'Kindergarten') return 0;
  else {
    return parseInt(grade);
  }
};

const runsByTaskId = computed(() => {
  if (runResults.value === undefined) return {};
  const computedScores = {};
  for (const { scores, taskId, user } of runResults.value) {
    let percentScore;
    const rawScore = _get(scores, rawScoreByTaskId(taskId));
    if (user?.data?.grade >= 6) {
      percentScore = _get(scores, scoreFieldAboveSixth(taskId));
    } else {
      percentScore = _get(scores, scoreFieldBelowSixth(taskId));
    }
    const { support_level } = getSupportLevel(percentScore);
    const run = {
      // A bit of a workaround to properly sort grades in facetted graphs (changes Kindergarten to grade 0)
      grade: user?.data?.grade === 'Kindergarten' ? 0 : parseInt(user?.data?.grade),
      scores: {
        ...scores,
        support_level: support_level,
        stdPercentile: percentScore,
        rawScore: rawScore,
      },
      taskId,
      user: {
        ...user.data,
        schoolName: schoolsDict.value[user?.data?.schools?.current[0]],
      },
    };
    if (run.taskId in computedScores) {
      computedScores[run.taskId].push(run);
    } else {
      computedScores[run.taskId] = [run];
    }
  }
  return _pickBy(computedScores, (scores, taskId) => {
    return !excludedTasks.includes(taskId);
  });
});

const sortedTaskIds = computed(() => {
  return Object.keys(runsByTaskId.value).toSorted((p1, p2) => {
    if (Object.keys(taskDisplayNames).includes(p1) && Object.keys(taskDisplayNames).includes(p2)) {
      return taskDisplayNames[p1].order - taskDisplayNames[p2].order;
    } else {
      return -1;
    }
  });
});

const sortedAndFilteredTaskIds = computed(() => {
  return sortedTaskIds.value.filter((taskId) => {
    return tasksToDisplayGraphs.includes(taskId);
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
.overview-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.chart-wrapper {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-around;
  border-radius: 0.3rem;
}

.distribution-overview-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-around;
}

.task-description {
  width: 240px;
  font-size: 14px;
}

.task-report-panel {
  border: 2px solid black !important;
}

.loading-wrapper {
  margin: 1rem 0rem;
  display: flex;
  flex-direction: column;
  width: 100%;
  align-items: center;
  justify-content: center;
}

.report-title {
  font-size: 2.5rem;
  font-weight: bold;
  margin-top: 0;
}

.report-subheader {
  font-size: 1.3rem;
  font-weight: light;
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
  gap: 1vw;
  justify-content: center;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.legend-entry {
  font-size: 0.9rem;
  font-weight: light;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.legend-description {
  text-align: center;
  margin-bottom: 1rem;
  font-size: 0.7rem;
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
  font-size: 1.5rem;
  font-weight: bold;
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
