<template>
  <main class="container main">
    <section class="main-body">
      <div>
        <div class="">
          <div v-if="isLoadingOrgInfo" class="loading-wrapper">
            <AppSpinner style="margin: 0.3rem 0rem" />
            <div class="uppercase text-sm">Loading Org Info</div>
          </div>
          <div v-if="orgInfo && administrationInfo" id="at-a-glance-charts">
            <div class="flex justify-content-between align-items-center">
              <div class="flex flex-column align-items-start gap-2">
                <div>
                  <div class="uppercase font-light text-gray-500 text-sm">{{ props.orgType }} Score Report</div>
                  <div class="report-title">
                    {{ _toUpper(orgInfo?.name) }}
                  </div>
                </div>
                <div>
                  <div class="uppercase font-light text-gray-500 text-sm">Administration</div>
                  <div class="administration-name mb-4">
                    {{ _toUpper(displayName) }}
                  </div>
                </div>
                <div class="report-subheader mb-3 uppercase text-gray-500 font-normal">Scores at a glance</div>
              </div>
              <div class="flex flex-column align-items-end gap-2">
                <div class="flex flex-row align-items-center gap-4" data-html2canvas-ignore="true">
                  <div class="uppercase text-sm text-gray-600">VIEW</div>
                  <PvSelectButton
                    v-model="reportView"
                    :options="reportViews"
                    option-disabled="constant"
                    :allow-empty="false"
                    option-label="name"
                    class="flex my-2 select-button"
                    @change="handleViewChange"
                  >
                  </PvSelectButton>
                </div>
                <div v-if="!isLoadingRunResults">
                  <PvButton
                    class="flex flex-row"
                    :icon="!exportLoading ? 'pi pi-download' : 'pi pi-spin pi-spinner'"
                    :disabled="exportLoading"
                    label="Export To Pdf"
                    data-html2canvas-ignore="true"
                    @click="handleExportToPdf"
                  />
                </div>
              </div>
            </div>
            <div v-if="isLoadingRunResults" class="loading-wrapper">
              <AppSpinner style="margin: 1rem 0rem" />
              <div class="uppercase text-sm">Loading Overview Charts</div>
            </div>
            <div v-if="sortedAndFilteredTaskIds?.length > 0" class="overview-wrapper bg-gray-100 py-3 mb-2">
              <div class="chart-wrapper">
                <div v-for="taskId of sortedAndFilteredTaskIds" :key="taskId" style="width: 33%">
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
                    <div>Needs Extra Support</div>
                  </div>
                </div>
                <div class="legend-entry">
                  <div class="circle" :style="`background-color: ${supportLevelColors.some};`" />
                  <div>
                    <div>Developing Skill</div>
                  </div>
                </div>
                <div class="legend-entry">
                  <div class="circle" :style="`background-color: ${supportLevelColors.above};`" />
                  <div>
                    <div>Achieved Skill</div>
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
          <RoarDataTable
            :data="tableData"
            :columns="columns"
            :total-records="scoresCount"
            lazy
            :page-limit="pageLimit"
            :loading="isLoadingScores || isFetchingScores"
            data-cy="roar-data-table"
            :lazy-pre-sorting="sortDisplay"
            @page="onPage($event)"
            @sort="onSort($event)"
            @filter="onFilter($event)"
            @export-all="exportAll"
            @export-selected="exportSelected"
          >
            <template #filterbar>
              <div v-if="schoolsInfo" class="flex flex-row gap-2">
                <span class="p-float-label">
                  <PvMultiSelect
                    id="ms-school-filter"
                    v-model="filterSchools"
                    style="width: 20rem; max-width: 25rem"
                    :options="schoolsInfo"
                    option-label="name"
                    option-value="id"
                    :show-toggle-all="false"
                    selected-items-label="{0} schools selected"
                    data-cy="filter-by-school"
                  />
                  <label for="ms-school-filter">Filter by School</label>
                </span>
              </div>
              <div class="flex flex-row gap-2">
                <span class="p-float-label">
                  <PvMultiSelect
                    id="ms-grade-filter"
                    v-model="filterGrades"
                    style="width: 20rem; max-width: 25rem"
                    :options="gradeOptions"
                    option-label="label"
                    option-value="value"
                    :show-toggle-all="false"
                    selected-items-label="{0} grades selected"
                    data-cy="filter-by-grade"
                  />
                  <label for="ms-school-filter">Filter by Grade</label>
                </span>
              </div>
            </template>
            <span>
              <label for="view-columns" class="view-label">View</label>
              <PvDropdown
                id="view-columns"
                v-model="viewMode"
                :options="viewOptions"
                option-label="label"
                option-value="value"
                class="ml-2"
              />
            </span>
          </RoarDataTable>
        </div>
        <div v-if="!isLoadingRunResults" class="legend-container">
          <div class="legend-entry">
            <div class="circle tooltip" :style="`background-color: ${supportLevelColors.below};`" />
            <div>
              <div>Needs Extra Support</div>
            </div>
          </div>
          <div class="legend-entry">
            <div class="circle tooltip" :style="`background-color: ${supportLevelColors.some};`" />
            <div>
              <div>Developing Skill</div>
            </div>
          </div>
          <div class="legend-entry">
            <div class="circle tooltip" :style="`background-color: ${supportLevelColors.above};`" />
            <div>
              <div>Achieved Skill</div>
            </div>
          </div>
          <div class="legend-entry">
            <div class="circle tooltip" :style="`background-color: ${optionalAssessmentColor};`" />
            <div>
              <div>Optional</div>
            </div>
          </div>
          <div class="legend-entry">
            <div class="circle tooltip" :style="`background-color: white`" />
            <div>
              <div>Assessed</div>
            </div>
          </div>
        </div>
        <div class="legend-description">
          Students are classified into three support groups based on nationally-normed percentiles. Blank spaces
          indicate that the assessment was not completed. <br />
          Pale colors indicate that the score may not reflect the reader’s ability because responses were made too
          quickly or the assessment was incomplete.
        </div>
        <!-- Subscores tables -->
        <div v-if="isLoadingRunResults" class="loading-wrapper">
          <AppSpinner style="margin: 1rem 0rem" />
          <div class="uppercase text-sm">Loading Task Reports</div>
        </div>
        <PvTabView :active-index="activeTabIndex">
          <PvTabPanel
            v-for="taskId of sortedTaskIds"
            :key="taskId"
            :header="taskDisplayNames[taskId]?.name ? ('ROAR-' + taskDisplayNames[taskId]?.name).toUpperCase() : ''"
          >
            <div :id="'tab-view-' + taskId">
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
            </div>
          </PvTabPanel>
        </PvTabView>
        <div id="score-report-closing" class="bg-gray-200 px-4 py-2 mt-4">
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
            support your student, <a :href="NextSteps" class="hover:text-red-700" target="_blank">read more</a>.
          </p>
        </div>
      </div>
      <PvConfirmDialog group="sort" class="confirm">
        <template #message> Customized sorting on multiple fields is not yet supported. </template>
      </PvConfirmDialog>
    </section>
  </main>
</template>

<script setup>
import { computed, ref, onMounted, watch, toRaw } from 'vue';
import { storeToRefs } from 'pinia';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import _toUpper from 'lodash/toUpper';
import _round from 'lodash/round';
import _get from 'lodash/get';
import _map from 'lodash/map';
import _kebabCase from 'lodash/kebabCase';
import _find from 'lodash/find';
import _head from 'lodash/head';
import _tail from 'lodash/tail';
import _isEmpty from 'lodash/isEmpty';
import _pickBy from 'lodash/pickBy';
import _union from 'lodash/union';
import _remove from 'lodash/remove';
import { useAuthStore } from '@/store/auth';
import { useQuery } from '@tanstack/vue-query';
import { getGrade } from '@bdelab/roar-utils';
import { fetchDocById, exportCsv } from '@/helpers/query/utils';
import { assignmentPageFetcher, assignmentCounter, assignmentFetchAll } from '@/helpers/query/assignments';
import { orgFetcher } from '@/helpers/query/orgs';
import { useConfirm } from 'primevue/useconfirm';
import { runPageFetcher } from '@/helpers/query/runs';
import { pluralizeFirestoreCollection } from '@/helpers';
import { getTitle } from '../helpers/query/administrations';
import {
  optionalAssessmentColor,
  taskDisplayNames,
  taskInfoById,
  descriptionsByTaskId,
  supportLevelColors,
  getSupportLevel,
  tasksToDisplayGraphs,
  getRawScoreThreshold,
  rawOnlyTasks,
  scoredTasks,
  addElementToPdf,
  getScoreKeys,
} from '@/helpers/reports.js';
// import TaskReport from '@/components/reports/tasks/TaskReport.vue';
// import DistributionChartOverview from '@/components/reports/DistributionChartOverview.vue';
// import NextSteps from '@/assets/NextSteps.pdf';

let TaskReport, DistributionChartOverview, NextSteps;

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

const publicName = computed(() => {
  if (administrationInfo.value) {
    return getTitle(administrationInfo.value, isSuperAdmin.value);
  }
  return 'Fetching administration name...';
});

const reportView = ref({ name: 'Score Report', constant: true });
const reportViews = [
  { name: 'Progress Report', constant: false },
  { name: 'Score Report', constant: true },
];

const handleViewChange = () => {
  window.location.href = `/administration/${props.administrationId}/${props.orgType}/${props.orgId}`;
};

const exportLoading = ref(false);

const activeTabIndex = ref(0);

const pageWidth = 190; // Set page width for calculations
const returnScaleFactor = (width) => pageWidth / width; // Calculate the scale factor

const handleExportToPdf = async () => {
  exportLoading.value = true; // Set loading icon in button to prevent multiple clicks
  const doc = new jsPDF();
  let yCounter = 10; // yCounter tracks the y position in the PDF

  // Add At a Glance Charts and report header to the PDF
  const atAGlanceCharts = document.getElementById('at-a-glance-charts');
  if (atAGlanceCharts !== null) {
    yCounter = await addElementToPdf(atAGlanceCharts, doc, yCounter);
  }

  // Initialize to first tab
  activeTabIndex.value = 0;

  for (const [i, taskId] of sortedTaskIds.value.entries()) {
    activeTabIndex.value = i;
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Add Task Description and Task Chart to document
    const tabViewDesc = document.getElementById('tab-view-description-' + taskId);
    const tabViewChart = document.getElementById('tab-view-chart-' + taskId);
    const chartHeight =
      tabViewChart &&
      (await html2canvas(document.getElementById('tab-view-chart-' + taskId)).then(
        (canvas) => canvas.height * returnScaleFactor(canvas.width),
      ));

    if (tabViewDesc !== null) {
      yCounter = await addElementToPdf(tabViewDesc, doc, yCounter, chartHeight);
    }
    if (tabViewChart !== null) {
      yCounter = await addElementToPdf(tabViewChart, doc, yCounter);
    }
  }

  // Add Report Closing
  const closing = document.getElementById('score-report-closing');
  if (closing !== null) {
    yCounter = await addElementToPdf(closing, doc, yCounter);
  }
  doc.save(
    `roar-scores-${_kebabCase(getTitle(administrationInfo.value, isSuperAdmin.value))}-${_kebabCase(
      orgInfo.value.name,
    )}.pdf`,
  );
  exportLoading.value = false;
  window.scrollTo(0, 0);

  return;
};

// Queries for page
// Boolean ref to keep track of whether this is the initial sort or a user-defined sort
const initialSort = ref(true);

const orderBy = ref([
  {
    direction: 'ASCENDING',
    field: {
      fieldPath: 'userData.grade',
    },
  },
  {
    direction: 'ASCENDING',
    field: {
      fieldPath: 'userData.name.last',
    },
  },
]);
// If this is a district report, make the schools column first sorted.
if (props.orgType === 'district') {
  orderBy.value.unshift({
    direction: 'ASCENDING',
    field: {
      fieldPath: 'readOrgs.schools',
    },
  });
}
const filterBy = ref([]);
const filterSchools = ref([]);
const filterGrades = ref([]);
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
  queryFn: () => fetchDocById('administrations', props.administrationId, ['name', 'publicName', 'assessments']),
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

// Grab grade options for filter dropdown
const gradeOptions = ref([
  {
    value: '1',
    label: '1st Grade',
  },
  {
    value: '2',
    label: '2nd Grade',
  },
  {
    value: '3',
    label: '3rd Grade',
  },
  {
    value: '4',
    label: '4th Grade',
  },
  {
    value: '5',
    label: '5th Grade',
  },
  {
    value: '6',
    label: '6th Grade',
  },
  {
    value: '7',
    label: '7th Grade',
  },
  {
    value: '8',
    label: '8th Grade',
  },
  {
    value: '9',
    label: '9th Grade',
  },
  {
    value: '10',
    label: '10th Grade',
  },
  {
    value: '11',
    label: '11th Grade',
  },
  {
    value: '12',
    label: '12th Grade',
  },
]);

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
      acc[school.id] = getGrade(school.lowGrade) + ' ' + school.name;
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
  queryKey: ['assignments', props.administrationId, props.orgId, filterBy, orderBy],
  queryFn: () => assignmentCounter(props.administrationId, props.orgType, props.orgId, filterBy.value, orderBy.value),
  keepPreviousData: true,
  enabled: scoresQueryEnabled,
  staleTime: 5 * 60 * 1000,
});

const onPage = (event) => {
  page.value = event.page;
  pageLimit.value = event.rows;
};

const sortDisplay = computed(() => {
  const display = [];
  for (const sort of orderBy.value) {
    // TODO: TEMPORARY - Make this a dynamic way of converting
    // fields into column paths
    let item = {};
    if (sort.direction === 'ASCENDING') {
      item.order = 1;
    } else {
      item.order = -1;
    }
    const sortFieldPath = sort.field.fieldPath;
    if (sortFieldPath === 'userData.grade') {
      item.field = 'user.studentData.grade';
    } else if (sortFieldPath === 'userData.name.first') {
      item.field = 'user.name.first';
    } else if (sortFieldPath === 'userData.name.last') {
      item.field = 'user.name.last';
    } else if (sortFieldPath === 'userData.username') {
      item.field = 'user.username';
    } else if (sortFieldPath === 'readOrgs.schools') {
      item.field = 'user.schoolName';
    }
    display.push(item);
  }
  return display;
});

const confirm = useConfirm();
const onSort = (event) => {
  initialSort.value = false;
  const _orderBy = (event.multiSortMeta ?? []).map((item) => {
    let field = item.field.replace('user', 'userData');
    // Due to differences in the document schemas,
    //   fields found in studentData in the user document are in the
    //   top level of the assignments.userData object.
    if (field.split('.')[1] === 'studentData') {
      field = `userData.${field.split('.').slice(2, field.length)}`;
    }
    if (field.split('.')[1] === 'schoolName') {
      field = `readOrgs.schools`;
    }
    return {
      field: { fieldPath: field },
      direction: item.order === 1 ? 'ASCENDING' : 'DESCENDING',
    };
  });
  if (_orderBy.length > 1) {
    confirm.require({
      group: 'sort',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Continue',
      acceptIcon: 'pi pi-check',
      accept: () => {
        console.log('modal closed.');
      },
    });
  } else {
    orderBy.value = !_isEmpty(_orderBy) ? _orderBy : [];
    page.value = 0;
  }
};

watch(filterSchools, (newSchools) => {
  // check if filter entry for schools exists
  const filterSchools = _find(filterBy.value, { collection: 'schools' });
  // Turn off sort when filtering
  orderBy.value = [];
  if (filterSchools) {
    if (_isEmpty(newSchools)) {
      _remove(filterBy.value, { collection: 'schools' });
      return;
    }
    filterSchools.value = _union(filterSchools.value, newSchools);
  } else {
    filterBy.value.push({
      collection: 'schools',
      field: 'assigningOrgs.schools',
      value: newSchools,
    });
  }
});

watch(filterGrades, (newGrades) => {
  // Turn off sort when filtering
  orderBy.value = [];
  filterBy.value.push({
    collection: 'grade',
    field: 'grade',
    value: toRaw(newGrades),
  });
});

watch(
  scoresCount,
  (count) => {
    if (initialSort.value && count === 0) {
      resetFilters();
    }
  },
  { immediate: true },
);

const onFilter = (event) => {
  // Turn off sort when filtering
  orderBy.value = [];
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
            filters.push({ value: [schoolEntry.id], collection: 'schools', field: 'assigningOrgs.schools' });
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
        const cutoffs = getRawScoreThreshold(taskId);
        filters.push({
          ...constraint,
          collection: 'scores',
          taskId: taskId,
          cutoffs,
          field: 'scores.computed.composite.categoryScore',
        });
      }
    }
  }
  const orgFilter = _find(filterBy.value, { collection: 'schools' });
  const gradeFilter = _find(filterBy.value, { collection: 'grade' });
  if (orgFilter) filters.push(orgFilter);
  if (gradeFilter) filters.push(gradeFilter);
  filterBy.value = filters;
  page.value = 0;
};

const resetFilters = () => {
  filterSchools.value = [];
  filterGrades.value = [];
  filterBy.value = [];
};
const viewMode = ref('color');

const viewOptions = ref([
  { label: 'Support Level', value: 'color' },
  { label: 'Percentile', value: 'percentile' },
  { label: 'Standard Score', value: 'standard' },
  { label: 'Raw Score', value: 'raw' },
]);

const getPercentileScores = ({
  grade,
  assessment,
  percentileScoreKey,
  percentileScoreDisplayKey,
  rawScoreKey,
  taskId,
  optional,
}) => {
  let percentile = _get(assessment, `scores.computed.composite.${percentileScoreKey}`);
  let percentileString = _get(assessment, `scores.computed.composite.${percentileScoreDisplayKey}`);
  let raw = _get(assessment, `scores.computed.composite.${rawScoreKey}`);
  const { support_level, tag_color } = getSupportLevel(grade, percentile, raw, taskId, optional);
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
      const isOptional = assessment.optional;
      const { percentileScoreKey, rawScoreKey, percentileScoreDisplayKey, standardScoreDisplayKey } = getScoreKeysByRow(
        assessment,
        getGrade(_get(user, 'studentData.grade')),
      );
      const { percentileString, support_level } = getPercentileScores({
        grade: getGrade(_get(user, 'studentData.grade')),
        assessment,
        percentileScoreKey,
        percentileScoreDisplayKey,
        rawScoreKey,
        taskId,
        isOptional,
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
      const isOptional = assessment.optional;
      const { percentileScoreKey, rawScoreKey, percentileScoreDisplayKey, standardScoreDisplayKey } = getScoreKeysByRow(
        assessment,
        getGrade(_get(user, 'studentData.grade')),
      );
      const { percentileString, support_level } = getPercentileScores({
        grade: getGrade(_get(user, 'studentData.grade')),
        assessment,
        percentileScoreKey,
        percentileScoreDisplayKey,
        rawScoreKey,
        taskId,
        isOptional,
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
    `roar-scores-${_kebabCase(getTitle(administrationInfo.value, isSuperAdmin.value))}-${_kebabCase(
      orgInfo.value.name,
    )}.csv`,
  );
  return;
};

function getScoreKeysByRow(row, grade) {
  const taskId = row.taskId;
  return getScoreKeys(taskId, grade);
}

const refreshing = ref(false);

const shouldBeOutlined = (taskId) => {
  if (scoredTasks.includes(taskId)) return false;
  else if (rawOnlyTasks.includes(taskId) && viewMode.value !== 'raw') return true;
  else return true;
};

const columns = computed(() => {
  if (scoresDataQuery.value === undefined) return [];
  const tableColumns = [
    { field: 'user.username', header: 'Username', dataType: 'text', pinned: true, sort: true },
    { field: 'user.name.first', header: 'First Name', dataType: 'text', sort: true },
    { field: 'user.name.last', header: 'Last Name', dataType: 'text', sort: true },
    { field: 'user.studentData.grade', header: 'Grade', dataType: 'text', sort: true, filter: false },
  ];

  if (props.orgType === 'district') {
    tableColumns.push({ field: 'user.schoolName', header: 'School', dataType: 'text', sort: true, filter: false });
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
      const isOptional = `scores.${taskId}.optional`;
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
        emptyTag:
          viewMode.value === 'color' || isOptional || (rawOnlyTasks.includes(taskId) && viewMode.value !== 'raw'),
        tagColor: `scores.${taskId}.color`,
        tagOutlined: shouldBeOutlined(taskId),
      });
    }
  }
  tableColumns.push({
    header: 'Student Report',
    link: true,
    routeName: 'StudentReport',
    routeTooltip: 'Student Score Report',
    routeLabel: 'Report',
    routeIcon: 'pi pi-user',
    sort: false,
  });
  return tableColumns;
});

// this function light out color if assessment is not reliable
function colorSelection(assessment, rawScore, support_level, tag_color) {
  if (assessment.reliable !== undefined && !assessment.reliable && assessment.engagementFlags !== undefined) {
    if (support_level === 'Optional') {
      return '#a1d8e3';
    } else if (support_level === 'Needs Extra Support') {
      return '#d6b8c7';
    } else if (support_level === 'Developing Skill') {
      return '#e8dbb5';
    } else if (support_level === 'Achieved Skill') {
      return '#c0d9bd';
    } else if (rawOnlyTasks.includes(assessment.taskId) && rawScore) {
      return 'white';
    }
  }
  return tag_color;
}

const tableData = computed(() => {
  if (scoresDataQuery.value === undefined) return [];
  return scoresDataQuery.value.map(({ user, assignment }) => {
    const scores = {};
    const grade = getGrade(_get(user, 'studentData.grade'));
    for (const assessment of assignment?.assessments ?? []) {
      const { percentileScoreKey, rawScoreKey, percentileScoreDisplayKey, standardScoreDisplayKey } = getScoreKeysByRow(
        assessment,
        grade,
      );
      const { percentileString, support_level, tag_color } = getPercentileScores({
        grade,
        assessment,
        percentileScoreKey,
        percentileScoreDisplayKey,
        rawScoreKey,
        taskId: assessment.taskId,
        optional: assessment.optional,
      });
      const standardScore = _get(assessment, `scores.computed.composite.${standardScoreDisplayKey}`);
      const rawScore = rawOnlyTasks.includes(assessment.taskId)
        ? _get(assessment, 'scores.computed.composite')
        : _get(assessment, `scores.computed.composite.${rawScoreKey}`);
      const color = colorSelection(assessment, rawScore, support_level, tag_color);
      scores[assessment.taskId] = {
        percentile: percentileString,
        standard: standardScore,
        raw: rawScore,
        support_level,
        color: color,
        optional: assessment.optional,
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
      routeParams: {
        administrationId: props.administrationId,
        userId: _get(user, 'userId'),
        orgType: props.orgType,
        orgId: props.orgId,
      },
    };
  });
});

const allTasks = computed(() => {
  if (administrationInfo.value?.assessments?.length > 0) {
    return administrationInfo.value?.assessments?.map((assessment) => assessment.taskId);
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

const runsByTaskId = computed(() => {
  if (runResults.value === undefined) return {};
  const computedScores = {};
  for (const { scores, taskId, user } of runResults.value) {
    let percentScore;
    const rawScore = _get(scores, rawScoreByTaskId(taskId));
    const grade = getGrade(user?.data?.grade);
    if (grade >= 6) {
      percentScore = _get(scores, scoreFieldAboveSixth(taskId));
    } else {
      percentScore = _get(scores, scoreFieldBelowSixth(taskId));
    }
    const { support_level, tag_color } = getSupportLevel(grade, percentScore, rawScore, taskId);
    const run = {
      // A bit of a workaround to properly sort grades in facetted graphs (changes Kindergarten to grade 0)
      grade: grade,
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
      tag_color: tag_color,
    };
    if (run.taskId in computedScores) {
      computedScores[run.taskId].push(run);
    } else {
      computedScores[run.taskId] = [run];
    }
  }

  return _pickBy(computedScores, (scores, taskId) => {
    return Object.keys(taskInfoById).includes(taskId);
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
  TaskReport = (await import('@/components/reports/tasks/TaskReport.vue')).default;
  DistributionChartOverview = (await import('@/components/reports/DistributionChartOverview.vue')).default;
  NextSteps = (await import('@/assets/NextSteps.pdf')).default;
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
  width: 23vh;
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

.administration-name {
  font-size: 1.8rem;
  font-weight: light;
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
  font-size: 1rem;
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

.tooltip {
  outline: 1px dotted #0000cd;
  outline-offset: 3px;
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

.confirm .p-confirm-dialog-reject {
  display: none !important;
}

.confirm .p-dialog-header-close {
  display: none !important;
}
</style>
