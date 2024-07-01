<template>
  <main class="container main">
    <section class="main-body">
      <div>
        <div class="">
          <div v-if="isLoadingOrgInfo" class="loading-wrapper">
            <AppSpinner style="margin: 0.3rem 0rem" />
            <div class="uppercase text-sm text-gray-600 font-light">Loading Org Info</div>
          </div>
          <div v-if="orgInfo && administrationInfo" id="at-a-glance-charts">
            <div class="flex justify-content-between align-items-center">
              <div class="flex flex-column align-items-start gap-2">
                <div>
                  <div class="uppercase font-light text-gray-500 text-xs">{{ props.orgType }} Score Report</div>
                  <div class="report-title">
                    {{ _toUpper(orgInfo?.name) }}
                  </div>
                </div>
                <div>
                  <div class="uppercase font-light text-gray-500 text-xs">Administration</div>
                  <div class="administration-name mb-4">
                    {{ _toUpper(displayName) }}
                  </div>
                </div>
              </div>
              <div class="flex flex-column align-items-end gap-1">
                <div class="flex flex-row align-items-center gap-4" data-html2canvas-ignore="true">
                  <div class="uppercase text-sm text-gray-600">VIEW</div>
                  <PvSelectButton
                    v-model="reportView"
                    v-tooltip.top="'View different report'"
                    :options="reportViews"
                    option-disabled="constant"
                    :allow-empty="false"
                    option-label="name"
                    class="flex my-2 select-button"
                    @change="handleViewChange"
                  >
                  </PvSelectButton>
                </div>
                <div v-if="!isLoadingScores">
                  <PvButton
                    class="flex flex-row p-2 text-sm bg-primary text-white border-none border-round h-2rem text-sm hover:bg-red-900"
                    :icon="!exportLoading ? 'pi pi-download mr-2' : 'pi pi-spin pi-spinner mr-2'"
                    :disabled="exportLoading"
                    label="Export To Pdf"
                    data-html2canvas-ignore="true"
                    @click="handleExportToPdf"
                  />
                </div>
              </div>
            </div>
            <div v-if="isLoadingScores" class="loading-wrapper">
              <AppSpinner style="margin: 1rem 0rem" />
              <div class="uppercase text-sm text-gray-600 font-light">Loading Overview Charts</div>
            </div>
            <div v-if="sortedAndFilteredTaskIds?.length > 0" class="text-left bg-gray-100 py-3 mb-2">
              <div class="overview-wrapper">
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
                          {{
                            descriptionsByTaskId[taskId]?.description ? descriptionsByTaskId[taskId].description : ''
                          }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-if="!isLoadingScores && sortedAndFilteredTaskIds?.length > 0"
                class="legend-container flex flex-column align-items-center rounded"
              >
                <div class="flex align-items-center">
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
                <div class="font-light uppercase text-xs text-gray-500 my-1">Legend</div>
              </div>
            </div>
          </div>
        </div>
        <!-- Loading data spinner -->
        <div v-if="isLoadingScores || isFetchingScores" class="loading-container my-4">
          <AppSpinner style="margin-bottom: 1rem" />
          <span class="text-sm text-gray-600 uppercase font-light">Loading Administration Datatable</span>
        </div>
        <!-- Main table -->

        <div v-if="assignmentData?.length ?? 0 > 0">
          <RoarDataTable
            :data="filteredTableData"
            :columns="scoreReportColumns"
            :total-records="filteredTableData?.length"
            :page-limit="pageLimit"
            :loading="isLoadingScores || isFetchingScores"
            data-cy="roar-data-table"
            @reset-filters="resetFilters"
            @export-all="exportAll"
            @export-selected="exportSelected"
          >
            <template #filterbar>
              <div class="flex flex-row flex-wrap gap-2 align-items-center justify-content-center">
                <div v-if="schoolsInfo" class="flex flex-row my-3">
                  <span class="p-float-label">
                    <PvMultiSelect
                      id="ms-school-filter"
                      v-model="filterSchools"
                      style="width: 10rem; max-width: 15rem"
                      :options="schoolsInfo"
                      option-label="name"
                      option-value="name"
                      :show-toggle-all="false"
                      selected-items-label="{0} schools selected"
                      data-cy="filter-by-school"
                    />
                    <label for="ms-school-filter">Filter by School</label>
                  </span>
                </div>
                <div class="flex flex-row gap-2 my-3">
                  <span class="p-float-label">
                    <PvMultiSelect
                      id="ms-grade-filter"
                      v-model="filterGrades"
                      style="width: 10rem; max-width: 15rem"
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
        <div v-if="!isLoadingScores" class="legend-container">
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
            <div class="circle tooltip" :style="`background-color: ${supportLevelColors.Optional};`" />
            <div>
              <div>Optional</div>
            </div>
          </div>
          <div class="legend-entry">
            <div class="circle tooltip" :style="`background-color: ${supportLevelColors.Assessed}`" />
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
        <div v-if="isLoadingScores" class="loading-wrapper">
          <AppSpinner style="margin: 1rem 0rem" />
          <div class="uppercase text-sm font-light text-gray-600">Loading Task Reports</div>
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
                :computed-table-data="assignmentTableData"
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
        <div class="bg-gray-200 px-4 py-2 mb-7">
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
import { computed, ref, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import _toUpper from 'lodash/toUpper';
import _round from 'lodash/round';
import _get from 'lodash/get';
import _map from 'lodash/map';
import _kebabCase from 'lodash/kebabCase';
import _pickBy from 'lodash/pickBy';
import _lowerCase from 'lodash/lowerCase';
import { useAuthStore } from '@/store/auth';
import { useQuery } from '@tanstack/vue-query';
import { getGrade } from '@bdelab/roar-utils';
import { fetchDocById, exportCsv } from '@/helpers/query/utils';
import { assignmentFetchAll } from '@/helpers/query/assignments';
import { orgFetcher } from '@/helpers/query/orgs';
import { pluralizeFirestoreCollection } from '@/helpers';
import { getTitle } from '../helpers/query/administrations';
import {
  taskDisplayNames,
  descriptionsByTaskId,
  supportLevelColors,
  tasksToDisplayGraphs,
  rawOnlyTasks,
  tasksToDisplayPercentCorrect,
  addElementToPdf,
  getScoreKeys,
  gradeOptions,
  tasksToDisplayCorrectIncorrectDifference,
  includedValidityFlags,
} from '@/helpers/reports.js';
import Worker from './ScoreReportWorker?worker';

let TaskReport, DistributionChartOverview, NextSteps;

const authStore = useAuthStore();

const { roarfirekit, uid, userQueryKeyIndex } = storeToRefs(authStore);

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

const displayName = computed(() => {
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
const filterSchools = ref([]);
const filterGrades = ref([]);
const pageLimit = ref(10);

// User Claims
const { isLoading: isLoadingClaims, data: userClaims } = useQuery({
  queryKey: ['userClaims', uid, userQueryKeyIndex],
  queryFn: () => fetchDocById('userClaims', uid.value),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});
const claimsLoaded = computed(() => !isLoadingClaims.value);
const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));
const adminOrgs = computed(() => userClaims.value?.claims?.minimalAdminOrgs);

const { data: administrationInfo } = useQuery({
  queryKey: ['administrationInfo', uid, props.administrationId],
  queryFn: () => fetchDocById('administrations', props.administrationId, ['name', 'publicName', 'assessments']),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const { data: orgInfo, isLoading: isLoadingOrgInfo } = useQuery({
  queryKey: ['orgInfo', uid, props.orgId],
  queryFn: () => fetchDocById(pluralizeFirestoreCollection(props.orgType), props.orgId, ['name']),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Grab schools if this is a district score report
const { data: schoolsInfo } = useQuery({
  queryKey: ['schools', uid, ref(props.orgId)],
  queryFn: () => orgFetcher('schools', ref(props.orgId), isSuperAdmin, adminOrgs, ['name', 'id', 'lowGrade']),
  keepPreviousData: true,
  enabled: props.orgType === 'district' && initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const schoolsDictWithGrade = computed(() => {
  if (schoolsInfo.value) {
    return schoolsInfo.value.reduce((acc, school) => {
      acc[school.id] = getGrade(school.lowGrade ?? 0) + ' ' + school.name;
      return acc;
    }, {});
  } else {
    return {};
  }
});

const schoolNameDictionary = computed(() => {
  if (schoolsInfo.value) {
    return schoolsInfo.value.reduce((acc, school) => {
      acc[school.id] = school.name;
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
  data: assignmentData,
} = useQuery({
  queryKey: ['scores', uid, props.administrationId, props.orgId],
  queryFn: () => assignmentFetchAll(props.administrationId, props.orgType, props.orgId, true),
  keepPreviousData: true,
  enabled: scoresQueryEnabled,
  staleTime: 5 * 60 * 1000, // 5 mins
});

const assignmentTableData = ref([]);
const runsByTaskId = ref({});

const fetchRunsDataFromWorker = computed(() => {
  const worker = new Worker();

  worker.addEventListener('message', (event) => {
    const { assignmentTableData: newData, runsByTaskId: newRuns } = event?.data;
    assignmentTableData.value = newData;
    runsByTaskId.value = newRuns;
    resetFilters();
  });

  worker.addEventListener('error', (error) => {
    console.error('Worker error:', error);
  });

  const adminInfo = { adminId: props.administrationId, orgType: props.orgType, orgId: props.orgId };
  const computeData = {
    schoolNameDictionary: schoolNameDictionary.value,
    schoolsDictWithGrade: schoolsDictWithGrade.value,
    assignmentData: assignmentData.value,
    adminInfo: adminInfo,
  };

  worker.postMessage(JSON.stringify(computeData));
});

const filteredTableData = ref(assignmentTableData.value);

// Flag to track whether the watcher is already processing an update
const isUpdating = ref(false);

watch(fetchRunsDataFromWorker, (newValue) => {
  filteredTableData.value = newValue;
});

watch([filterSchools, filterGrades], ([newSchools, newGrades]) => {
  // If an update is already in progress, return early to prevent recursion
  if (isUpdating.value) {
    return;
  }
  if (newSchools.length > 0 || newGrades.length > 0) {
    isUpdating.value = true;
    //set scoresTableData to filtered data if filter is added
    let filteredData = assignmentTableData.value;

    if (newSchools.length > 0) {
      filteredData = filteredData.filter((item) => {
        return newSchools.includes(item.user.schoolName);
      });
    }
    if (newGrades.length > 0) {
      filteredData = filteredData.filter((item) => {
        return newGrades.includes(item.user.grade);
      });
    }
    filteredTableData.value = filteredData;

    isUpdating.value = false; // Reset the flag after the update
  } else {
    filteredTableData.value = assignmentTableData.value;
  }
});

const resetFilters = () => {
  isUpdating.value = true;

  filterSchools.value = [];
  filterGrades.value = [];
  isUpdating.value = false;
};
const viewMode = ref('color');

const viewOptions = ref([
  { label: 'Support Level', value: 'color' },
  { label: 'Percentile', value: 'percentile' },
  { label: 'Standard Score', value: 'standard' },
  { label: 'Raw Score', value: 'raw' },
]);

const exportSelected = (selectedRows) => {
  const computedExportData = _map(selectedRows, ({ user, scores }) => {
    let tableRow = {
      Username: _get(user, 'username'),
      First: _get(user, 'firstName'),
      Last: _get(user, 'lastName'),
      Grade: _get(user, 'grade'),
    };
    if (authStore.isUserSuperAdmin) {
      tableRow['PID'] = _get(user, 'assessmentPid');
    }
    if (props.orgType === 'district') {
      tableRow['School'] = _get(user, 'schoolName');
    }
    for (const taskId in scores) {
      const score = scores[taskId];
      if (tasksToDisplayPercentCorrect.includes(taskId)) {
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Percent Correct`] = score.percentCorrect;
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Num Attempted`] = score.numAttempted;
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Num Correct`] = score.numCorrect;
      } else if (tasksToDisplayCorrectIncorrectDifference.includes(taskId)) {
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Correct/Incorrect Difference`] =
          score.correctIncorrectDifference;
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Num Incorrect`] = score.numIncorrect;
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Num Correct`] = score.numCorrect;
      } else if (rawOnlyTasks.includes(taskId)) {
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Raw`] = score.rawScore;
      } else {
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Percentile`] = score.percentileString;
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Standard`] = score.standardScore;

        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Raw`] = score.rawScore;
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Support Level`] = score.supportLevel;
      }
      if (score.reliable !== undefined && !score.reliable && score.engagementFlags !== undefined) {
        const engagementFlags = Object.keys(score.engagementFlags);
        if (engagementFlags.length > 0) {
          if (includedValidityFlags[taskId]) {
            const filteredFlags = Object.keys(score.engagementFlags).filter((flag) =>
              includedValidityFlags[taskId].includes(flag),
            );
            if (filteredFlags.length === 0) {
              tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Reliability`] = 'Unreliable';
            } else {
              const engagementFlagString = 'Unreliable: ' + filteredFlags.map((key) => _lowerCase(key)).join(', ');
              tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Reliability`] = engagementFlagString;
            }
          } else {
            const engagementFlagString = 'Unreliable: ' + engagementFlags.map((key) => _lowerCase(key)).join(', ');
            tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Reliability`] = engagementFlagString;
          }
        } else {
          tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Reliability`] = 'Assessment Incomplete';
        }
      } else {
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Reliability`] = 'Reliable';
      }
    }
    return tableRow;
  });
  exportCsv(
    computedExportData,
    `roar-scores-${_kebabCase(getTitle(administrationInfo.value, isSuperAdmin.value))}-${_kebabCase(
      orgInfo.value.name,
    )}-selected.csv`,
  );
  return;
};

const exportAll = async () => {
  const computedExportData = _map(assignmentTableData.value, ({ user, scores }) => {
    let tableRow = {
      Username: _get(user, 'username'),
      Email: _get(user, 'email'),
      First: _get(user, 'firstName'),
      Last: _get(user, 'lastName'),
      Grade: _get(user, 'grade'),
    };
    if (authStore.isUserSuperAdmin) {
      tableRow['PID'] = _get(user, 'assessmentPid');
    }
    if (props.orgType === 'district') {
      tableRow['School'] = _get(user, 'schoolName');
    }
    for (const taskId in scores) {
      const score = scores[taskId];
      if (tasksToDisplayPercentCorrect.includes(taskId)) {
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Percent Correct`] = score.percentCorrect;
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Num Attempted`] = score.numAttempted;
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Num Correct`] = score.numCorrect;
      } else if (tasksToDisplayCorrectIncorrectDifference.includes(taskId)) {
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Correct/Incorrect Difference`] =
          score.correctIncorrectDifference;
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Num Incorrect`] = score.numIncorrect;
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Num Correct`] = score.numCorrect;
      } else if (rawOnlyTasks.includes(taskId)) {
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Raw`] = score.rawScore;
      } else {
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Percentile`] = score.percentileString;
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Standard`] = score.standardScore;

        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Raw`] = score.rawScore;
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Support Level`] = score.supportLevel;
      }

      if (score.reliable !== undefined && !score.reliable && score.engagementFlags !== undefined) {
        const engagementFlags = Object.keys(score.engagementFlags);
        if (engagementFlags.length > 0) {
          if (includedValidityFlags[taskId]) {
            const filteredFlags = Object.keys(score.engagementFlags).filter((flag) =>
              includedValidityFlags[taskId].includes(flag),
            );
            if (filteredFlags.length === 0) {
              tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Reliability`] = 'Unreliable';
            } else {
              const engagementFlagString = 'Unreliable: ' + filteredFlags.map((key) => _lowerCase(key)).join(', ');
              tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Reliability`] = engagementFlagString;
            }
          } else {
            const engagementFlagString = 'Unreliable: ' + engagementFlags.map((key) => _lowerCase(key)).join(', ');
            tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Reliability`] = engagementFlagString;
          }
        } else {
          tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Reliability`] = 'Assessment Incomplete';
        }
      } else {
        tableRow[`${taskDisplayNames[taskId]?.name ?? taskId} - Reliability`] = 'Reliable';
      }
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
  const taskId = row?.taskId;
  return getScoreKeys(taskId, grade);
}

const refreshing = ref(false);

// compute and store schoolid -> school name map for schools. store adminId,
// orgType, orgId for individual score report link
const scoreReportColumns = computed(() => {
  if (assignmentData.value === undefined) return [];
  const tableColumns = [];
  tableColumns.push({
    header: 'Report',
    link: true,
    routeName: 'StudentReport',
    routeTooltip: 'Student Score Report',
    routeIcon: 'pi pi-chart-bar border-none text-primary hover:text-white',
    sort: false,
    pinned: true,
    orgType: props.orgType,
    orgId: props.orgId,
    administrationId: props.administrationId,
  });
  let hasUsername = false;
  if (assignmentData.value.find((assignment) => assignment.user?.username)) {
    tableColumns.push({
      field: 'user.username',
      header: 'Username',
      dataType: 'text',
      pinned: true,
      sort: true,
      filter: true,
    });
    hasUsername = true;
  }
  if (assignmentData.value.find((assignment) => assignment.user?.email)) {
    tableColumns.push({
      field: 'user.email',
      header: 'Email',
      dataType: 'text',
      pinned: true,
      sort: true,
      filter: true,
    });
  }
  if (assignmentData.value.find((assignment) => assignment.user?.name?.first)) {
    if (!hasUsername) {
      tableColumns.push({
        field: 'user.firstName',
        header: 'First Name',
        dataType: 'text',
        sort: true,
        filter: true,
        pinned: true,
      });
    } else {
      tableColumns.push({ field: 'user.firstName', header: 'First Name', dataType: 'text', sort: true, filter: true });
    }
  }
  if (assignmentData.value.find((assignment) => assignment.user?.name?.last)) {
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

  if (authStore.isUserSuperAdmin) {
    tableColumns.push({ field: 'user.assessmentPid', header: 'PID', dataType: 'text', sort: false });
  }

  const sortedTasks = allTasks.value.toSorted((p1, p2) => {
    if (Object.keys(taskDisplayNames).includes(p1) && Object.keys(taskDisplayNames).includes(p2)) {
      return taskDisplayNames[p1].order - taskDisplayNames[p2].order;
    } else {
      return -1;
    }
  });

  const priorityTasks = ['swr', 'sre', 'pa'];
  const orderedTasks = [];

  for (const task of priorityTasks) {
    if (sortedTasks.includes(task)) {
      orderedTasks.push(task);
    }
  }

  for (const task of sortedTasks) {
    if (!priorityTasks.includes(task)) {
      orderedTasks.push(task);
    }
  }

  for (const taskId of orderedTasks) {
    let colField;
    const isOptional = `scores.${taskId}.optional`;
    // Color needs to include a field to allow sorting.
    if (viewMode.value === 'percentile' || viewMode.value === 'color') colField = `scores.${taskId}.percentile`;
    if (viewMode.value === 'standard') colField = `scores.${taskId}.standardScore`;
    if (viewMode.value === 'raw') colField = `scores.${taskId}.rawScore`;
    if (tasksToDisplayCorrectIncorrectDifference.includes(taskId)) {
      colField = `scores.${taskId}.correctIncorrectDifference`;
    } else if (tasksToDisplayPercentCorrect.includes(taskId)) {
      colField = `scores.${taskId}.percentCorrect`;
    } else if (rawOnlyTasks.includes(taskId)) {
      colField = `scores.${taskId}.rawScore`;
    }

    let backgroundColor = '';

    if (priorityTasks.includes(taskId)) {
      backgroundColor = 'transparent';
    } else {
      backgroundColor = '#E6E6E6';
    }

    tableColumns.push({
      field: colField,
      header: taskDisplayNames[taskId]?.name ?? taskId,
      filterField: `scores.${taskId}.tags`,
      dataType: 'score',
      sort: true,
      filter: true,
      sortField: colField ? colField : `scores.${taskId}.percentile`,
      tag: viewMode.value !== 'color',
      emptyTag:
        !rawOnlyTasks.includes(taskId) &&
        !tasksToDisplayPercentCorrect.includes(taskId) &&
        !tasksToDisplayCorrectIncorrectDifference.includes(taskId) &&
        (viewMode.value === 'color' || isOptional),
      tagColor: `scores.${taskId}.tagColor`,
      style: `background-color: ${backgroundColor}; justify-content: center; margin: 0; text-align: center; `,
    });
  }
  return tableColumns;
});

const allTasks = computed(() => {
  if (administrationInfo.value?.assessments?.length > 0) {
    return administrationInfo.value?.assessments?.map((assessment) => assessment.taskId);
  } else return [];
});

const sortedTaskIds = computed(() => {
  const specialTaskIds = ['swr', 'sre', 'pa'].filter((id) => Object.keys(runsByTaskId.value).includes(id));
  const remainingTaskIds = Object.keys(runsByTaskId.value).filter((id) => !specialTaskIds.includes(id));

  remainingTaskIds.sort((p1, p2) => {
    return taskDisplayNames[p1]?.order - taskDisplayNames[p2]?.order;
  });

  const sortedIds = specialTaskIds.concat(remainingTaskIds);
  return sortedIds;
});

const sortedAndFilteredTaskIds = computed(() => {
  return sortedTaskIds.value?.filter((taskId) => {
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
  font-size: clamp(1.5rem, 2rem, 2.5rem);
  font-weight: bold;
  margin-top: 0;
}

.administration-name {
  font-size: clamp(1.1rem, 1.3rem, 1.7rem);
  font-weight: light;
}

.report-subheader {
  font-size: clamp(0.9rem, 1.1rem, 1.3rem);
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
  padding: 0.3rem;

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

.select-button .p-button:last-of-type:not(:only-of-type) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-top-right-radius: 25rem;
  border-bottom-right-radius: 25rem;
}

.select-button .p-button:first-of-type:not(:only-of-type) {
  border-top-left-radius: 25rem;
  border-bottom-left-radius: 25rem;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
</style>
