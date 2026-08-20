<template>
  <main class="container main" data-cy="score-report">
    <section class="main-body">
      <div>
        <section>
          <div v-if="isLoadingOrgData" class="loading-wrapper">
            <AppSpinner style="margin: 0.3rem 0rem" />
            <div class="text-sm font-light text-gray-600 uppercase">Loading Org Info</div>
          </div>

          <AtAGlanceCharts
            v-if="orgData && administrationData"
            id="at-a-glance-charts"
            :org-type="props.orgType"
            :org-name="_toUpper(orgData?.name)"
            :administration-name="_toUpper(displayName)"
            :report-view="reportView"
            :report-views="reportViews"
            :is-loading-assignments="isLoadingScoreStudents"
            :is-loading-district-support-categories="isLoadingDistrictSupportCategories"
            :is-empty-district-support-categories="isEmptyDistrictSupportCategories"
            :sorted-and-filtered-task-ids="sortedAndFilteredTaskIds"
            :runs-by-task-id-for-distribution-chart="runsByTaskIdForDistributionChart"
            :tasks-dictionary="tasksDictionary"
            :assigned-normed-task-ids="assignedNormedTaskIds"
            :assigned-task-ids="assignedTaskIds"
            @view-change="handleViewChange"
          >
            <template #export-buttons>
              <div
                v-if="!isLoadingScoreReportRows && !isLoadingDistrictSupportCategories"
                class="flex gap-2 mr-5 flex-column"
              >
                <PvButton
                  v-if="orgType !== 'district'"
                  class="flex flex-row p-2 text-sm text-white border-none bg-primary border-round h-2rem hover:bg-red-900"
                  :icon="!csvExportLoading ? 'pi pi-download mr-2' : 'pi pi-spin pi-spinner mr-2'"
                  label="Export Combined Reports"
                  @click="exportData({ includeProgress: true })"
                />
                <PvButton
                  v-if="orgType !== 'district' || !isEmptyDistrictSupportCategories"
                  class="flex flex-row p-2 mb-2 text-sm text-white border-none bg-primary border-round h-2rem hover:bg-red-900"
                  :class="orgType === 'district' && !isEmptyDistrictSupportCategories ? 'mt-4' : ''"
                  :icon="!exportLoading ? 'pi pi-download mr-2' : 'pi pi-spin pi-spinner mr-2'"
                  :disabled="exportLoading"
                  label="Export To Pdf"
                  data-html2canvas-ignore="true"
                  @click="handleExportToPdf"
                />
              </div>
            </template>
          </AtAGlanceCharts>
        </section>

        <!--
          Off-screen twin of the at-a-glance charts, permanently rendered at the PDF capture
          width. Chart.js bakes each canvas's pixel size into an inline style measured from its
          real container, so a canvas sized for the live page overflows when html2canvas clones
          the DOM into a differently-sized virtual window for export. Keeping a second copy that's
          always laid out at PDF_CAPTURE_WINDOW_WIDTH means its charts are always correctly sized,
          with no resize step (and no visible transition) needed at export time.
        -->
        <div aria-hidden="true" inert class="pdf-export-host" :style="{ width: `${PDF_CAPTURE_WINDOW_WIDTH}px` }">
          <AtAGlanceCharts
            v-if="orgData && administrationData"
            id="at-a-glance-charts-export"
            class="pdf-export-mode"
            :org-type="props.orgType"
            :org-name="_toUpper(orgData?.name)"
            :administration-name="_toUpper(displayName)"
            :report-view="reportView"
            :report-views="reportViews"
            :is-loading-assignments="isLoadingScoreStudents"
            :is-loading-district-support-categories="isLoadingDistrictSupportCategories"
            :is-empty-district-support-categories="isEmptyDistrictSupportCategories"
            :sorted-and-filtered-task-ids="sortedAndFilteredTaskIds"
            :runs-by-task-id-for-distribution-chart="runsByTaskIdForDistributionChart"
            :tasks-dictionary="tasksDictionary"
            :assigned-normed-task-ids="assignedNormedTaskIds"
            :assigned-task-ids="assignedTaskIds"
          />
        </div>

        <!-- Loading data spinner -->
        <div v-if="isLoadingScoreReportRows" class="my-4 loading-container">
          <AppSpinner style="margin-bottom: 1rem" />
          <span class="text-sm font-light text-gray-600 uppercase">Loading Administration Datatable</span>
        </div>

        <!-- Bulk Export Modal -->
        <AppDialog :is-enabled="exportModalEnabled" @modal-closed="exportModalEnabled = false">
          <template #header>
            <template v-if="exportModalStep !== EXPORT_MODAL_STEP.COMPLETED">
              <h1 class="p-0 m-0 font-semibold text-md">PDF Export</h1>
            </template>
          </template>

          <div v-if="exportModalStep === EXPORT_MODAL_STEP.WARNING" class="">
            <p class="mt-0">
              This export generates a printer-friendly score report. Charts and visualizations will not be included in
              the PDF.
            </p>
            <p>Please note: The export may take a few moments.</p>
            <p>Do not close this tab or navigate away until the export is complete.</p>
          </div>

          <div v-else-if="exportModalStep === EXPORT_MODAL_STEP.PROGRESS">
            <p class="mt-0">Your export is in progress and may take some time.</p>

            <div class="pt-2">
              <PvProgressBar :value="exportProgress.percentage" class="mb-2" />

              <div class="flex mt-4 mb-2 justify-content-between align-items-center">
                <span class="text-sm text-gray-600"> {{ exportProgress.completed }} / {{ exportProgress.total }}</span>

                <span class="text-sm text-gray-600">
                  {{
                    exportProgress.currentStudent
                      ? `Processing: ${exportProgress.currentStudent}`
                      : 'Preparing export...'
                  }}
                </span>
              </div>

              <div v-if="exportProgress.errors.length > 0" class="p-3 mt-4 rounded border border-gray-200 border-solid">
                <div class="flex gap-2">
                  <i class="text-red-600 pi pi-exclamation-circle"></i>
                  <h4 class="mt-0 mb-1 text-sm font-semibold text-red-600">Export Errors</h4>
                </div>

                <p class="text-sm text-red-600">
                  Errors have occurred while exporting the score reports. Please check the errors below:
                </p>

                <ul class="text-sm text-red-600">
                  <li v-for="error in exportProgress.errors" :key="error.studentId">
                    {{ error.studentName }}: {{ error.message }}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div v-else-if="exportModalStep === EXPORT_MODAL_STEP.COMPLETED">
            <div class="flex text-center flex-column align-items-center">
              <i class="mb-2 text-green-600 pi pi-check-circle" style="font-size: 2rem"></i>
              <h1 class="p-0 m-0 mb-3 font-semibold text-md">Export complete</h1>

              <p class="m-0">
                Your export has finished{{ exportProgress.errors.length ? ' with some errors' : '' }}. The ZIP download
                should have started automatically.
              </p>

              <div
                v-if="exportProgress.errors.length > 0"
                class="p-3 mt-4 w-full rounded border border-gray-200 border-solid"
              >
                <div class="flex gap-2">
                  <i class="text-red-600 pi pi-exclamation-circle"></i>
                  <h4 class="mt-0 mb-1 text-sm font-semibold text-red-600">Export Errors</h4>
                </div>
                <p class="text-sm text-red-600">The following items failed to export:</p>
                <ul class="text-sm text-left text-red-600">
                  <li v-for="error in exportProgress.errors" :key="error.studentId">
                    {{ error.studentName }}: {{ error.message }}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <template #footer>
            <div v-if="exportModalStep === EXPORT_MODAL_STEP.WARNING" class="flex gap-2 p-3">
              <PvButton label="Cancel" class="p-button-text" @click="exportModalEnabled = false" />
              <PvButton
                label="Continue"
                icon="pi pi-arrow-right"
                class="text-white border-none bg-primary border-round hover:bg-red-900"
                @click="proceedExportFromModal"
              />
            </div>
            <div
              v-else-if="exportModalStep === EXPORT_MODAL_STEP.COMPLETED"
              class="flex gap-2 w-full justify-content-center"
            >
              <PvButton label="Close" class="w-full p-button-text" @click="exportModalEnabled = false" />
            </div>
          </template>
        </AppDialog>

        <!-- Main table -->
        <div v-if="scoreReportTableData?.length ?? 0 > 0" data-cy="score-report__table">
          <RoarDataTable
            :data="filteredTableData"
            :columns="scoreReportColumns"
            :total-records="filteredTableData?.length"
            :page-limit="pageLimit"
            :loading="isLoadingScoreReportRows"
            :groupheaders="true"
            :task-scoring-versions="getScoringVersions"
            test-id="score-report__data-table"
            @export-all="exportData({ selectedRows: $event })"
            @export-selected="exportData({ selectedRows: $event })"
            @export-pdf-reports="openExportModal($event)"
          >
            <span>
              <label for="view-columns" class="view-label">View</label>
              <PvSelect
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
        <div v-if="!isLoadingScoreStudents" class="legend-container">
          <div class="legend-entry">
            <div class="circle tooltip" :style="`background-color: ${SCORE_SUPPORT_LEVEL_COLORS.BELOW};`" />
            <div>
              <div>Needs Extra Support</div>
            </div>
          </div>
          <div class="legend-entry">
            <div class="circle tooltip" :style="`background-color: ${SCORE_SUPPORT_LEVEL_COLORS.SOME};`" />
            <div>
              <div>Developing Skill</div>
            </div>
          </div>
          <div class="legend-entry">
            <div class="circle tooltip" :style="`background-color: ${SCORE_SUPPORT_LEVEL_COLORS.ABOVE};`" />
            <div>
              <div>Achieved Skill</div>
            </div>
          </div>
          <div class="legend-entry">
            <div class="circle tooltip" :style="`background-color: ${SCORE_SUPPORT_LEVEL_COLORS.ASSESSED}`" />
            <div>
              <div>Assessed</div>
            </div>
          </div>
        </div>
        <div v-if="orgType !== 'district'" class="legend-description">
          Students are classified into three support groups based on nationally-normed percentiles. Blank spaces
          indicate that the assessment was not completed. <br />
          Pale colors indicate that the score may not reflect the reader’s ability because responses were made too
          quickly or the assessment was incomplete.
        </div>

        <!-- Subscores tables -->
        <div v-if="isLoadingScoreReportRows || isLoadingTasksDictionary" class="loading-wrapper">
          <AppSpinner style="margin: 1rem 0rem" />
          <div class="text-sm font-light text-gray-600 uppercase">Loading Task Reports</div>
        </div>
        <template v-if="!isLoadingScoreReportRows && !isLoadingTasksDictionary && !isLoadingDistrictSupportCategories">
          <PvTabs v-model:value="activeTabIndex">
            <PvTabList>
              <PvTab v-for="(taskId, i) in sortedAndFilteredSubscoreTaskIds" :key="taskId" :value="i" class="text-base">
                {{ tasksDictionary[taskId]?.publicName ?? taskId }}
              </PvTab>
            </PvTabList>

            <PvTabPanels>
              <PvTabPanel v-for="(taskId, i) in sortedAndFilteredSubscoreTaskIds" :key="taskId" :value="i">
                <div :id="'tab-view-' + taskId">
                  <TaskReport
                    v-if="taskId"
                    :computed-table-data="backendScoreReportData.assignmentTableData"
                    :task-id="taskId"
                    :initialized="initialized"
                    :administration-id="administrationId"
                    :runs="
                      orgType === 'district'
                        ? aggregatedDistrictSupportCategories?.[taskId]
                        : backendScoreReportData.runsByTaskId?.[taskId]
                    "
                    :org-type="orgType"
                    :org-id="orgId"
                    :org-info="orgData"
                    :administration-info="administrationData"
                    :task-scoring-versions="getScoringVersions"
                  />
                </div>
              </PvTabPanel>
            </PvTabPanels>
          </PvTabs>
        </template>
        <div id="score-report-closing" class="px-4 py-2 mt-4 bg-gray-100">
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
        <div class="px-4 py-2 mb-7 bg-gray-100">
          <h2 class="extra-info-title">NEXT STEPS</h2>
          <!-- Reintroduce when we have somewhere for this link to go. -->
          <!-- <p>This score report has provided a snapshot of your school's reading performance at the time of administration. By providing classifications for students based on national norms for scoring, you are able to see which students can benefit from varying levels of support. To read more about what to do to support your students, <a href="google.com">read here.</a></p> -->
          <p>
            This score report has provided a snapshot of your student's reading performance at the time of
            administration. By providing classifications for students based on national norms for scoring, you are able
            to see how your student(s) can benefit from varying levels of support. To read more about what to do to
            support your student,
            <a :href="SCORE_REPORT_NEXT_STEPS_DOCUMENT_PATH" class="hover:text-red-700" target="_blank">read more</a>.
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
import { computed, ref, onMounted, nextTick, watch } from 'vue';
import { useQueries } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import _toUpper from 'lodash/toUpper';
import _round from 'lodash/round';
import _map from 'lodash/map';
import _kebabCase from 'lodash/kebabCase';
import _pickBy from 'lodash/pickBy';
import _lowerCase from 'lodash/lowerCase';
import { getGrade } from '@bdelab/roar-utils';
import PvButton from 'primevue/button';
import PvConfirmDialog from 'primevue/confirmdialog';
import PvSelect from 'primevue/select';
import PvTabPanel from 'primevue/tabpanel';
import PvTabs from 'primevue/tabs';
import PvTabList from 'primevue/tablist';
import PvTab from 'primevue/tab';
import PvTabPanels from 'primevue/tabpanels';
import PvProgressBar from 'primevue/progressbar';
import { useAuthStore } from '@/store/auth';
import { getDynamicRouterPath } from '@/helpers/getDynamicRouterPath';
import useUserType from '@/composables/useUserType';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import useAdministrationsQuery from '@/composables/queries/useAdministrationsQuery';
import useOrgQuery from '@/composables/queries/useOrgQuery';
import useDistrictSchoolsQuery from '@/composables/queries/useDistrictSchoolsQuery';
import useAdministrationProgressQuery from '@/composables/queries/useAdministrationProgressQuery';
import useAdministrationScoreStudentsQuery from '@/composables/queries/useAdministrationScoreStudentsQuery';
import {
  fetchAdministrationTaskSubscores,
  getAdministrationTaskSubscoresQueryKey,
  shouldRetryAdministrationTaskSubscoresQuery,
} from '@/composables/queries/useAdministrationTaskSubscoresQuery';
import useTasksDictionaryQuery from '@/composables/queries/useTasksDictionaryQuery';
import { usePermissions } from '@/composables/usePermissions';
import { exportCsv } from '@/helpers/query/utils';
import PdfExportService from '@/services/PdfExport.service';
import { getTitle } from '@/helpers/query/administrations';
import {
  taskDisplayNames,
  taskInfoById,
  tasksToDisplayGraphs,
  rawOnlyTasks,
  tasksToDisplayPercentCorrect,
  tasksToDisplayTotalCorrect,
  tasksToDisplayGradeEstimate,
  excludeFromScoringTasks,
  includeReliabilityFlagsOnExport,
  addElementToPdf,
  waitForElementRendered,
  PDF_CAPTURE_WINDOW_WIDTH,
  tasksToDisplayCorrectIncorrectDifference,
  includedValidityFlags,
  roamAlpacaSubskills,
  roamFluencySubskills,
  roamFluencySubskillHeaders,
  roamFluencySubskillHeadersNonResponse,
  isTaskNormed,
  previouslyUnnormedTasks,
  getTagColor,
  PA_SUBTASK_I18N_KEYS,
} from '@/helpers/reports';
import {
  SCORE_SUPPORT_LEVEL_COLORS,
  SCORE_REPORT_NEXT_STEPS_DOCUMENT_PATH,
  SCORE_SUPPORT_SKILL_LEVELS,
} from '@/constants/scores';
import RoarDataTable from '@/components/RoarDataTable';
import useDistrictSupportCategoriesQuery from '@/composables/queries/useDistrictSupportCategoriesQuery';
import { CSV_EXPORT_STATIC_COLUMNS } from '@/constants/csvExport';
import { APP_ROUTES } from '@/constants/routes';
import { SINGULAR_ORG_TYPES } from '@/constants/orgTypes';
import { LEVANTE_TASK_IDS_NO_SCORES } from '@/constants/levanteTasks';
import { i18n } from '@/translations/i18n';
import AppDialog from '@/components/Dialog/Dialog.vue';
import { getStudentDisplayName } from '@/helpers/getStudentDisplayName';
import { getStudentExternalId } from '@/helpers/getStudentExternalId';
import AtAGlanceCharts from '@/components/reports/AtAGlanceCharts.vue';
const { userCan, Permissions } = usePermissions();

let TaskReport;

const router = useRouter();
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

// Modal step constants for export dialog
const EXPORT_MODAL_STEP = Object.freeze({
  WARNING: 'warning',
  PROGRESS: 'progress',
  COMPLETED: 'completed',
});

const displayName = computed(() => {
  if (administrationData.value) {
    return getTitle(administrationData.value, isSuperAdmin.value);
  }
  return 'Fetching administration name...';
});

const {
  data: aggregatedDistrictSupportCategories,
  isLoading: isLoadingDistrictSupportCategories,
  isFetching: isFetchingDistrictSupportCategories,
} = useDistrictSupportCategoriesQuery(props.orgId, props.administrationId, {
  enabled: computed(() => initialized.value && props.orgType === 'district'),
});

const getScoringVersions = computed(() => {
  if (!administrationData.value?.assessments) return {};
  const scoringVersions = Object.fromEntries(
    administrationData.value?.assessments?.map((assessment) => [
      assessment.taskId,
      assessment?.params?.scoringVersion ?? null,
    ]),
  );
  return scoringVersions;
});

const reportView = ref({ name: 'Score Report', constant: true });
const reportViews = [
  { name: 'Progress Report', constant: false },
  { name: 'Score Report', constant: true },
];

const handleViewChange = () => {
  const { administrationId, orgType, orgId } = props;
  router.push({ path: getDynamicRouterPath(APP_ROUTES.PROGRESS_REPORT, { administrationId, orgType, orgId }) });
};

const exportLoading = ref(false);
const csvExportLoading = ref(false);
const bulkPdfExportLoading = ref(false);

// Export progress tracking
const exportProgress = ref({
  show: false,
  completed: 0,
  total: 0,
  percentage: 0,
  currentStudent: null,
  errors: [],
});

// Modal-based bulk export (beta)
const exportModalEnabled = ref(false);
const exportModalStep = ref(EXPORT_MODAL_STEP.WARNING); // 'warning' | 'progress' | 'completed'
const selectedRowsForExport = ref([]);

const openExportModal = (selectedRows) => {
  selectedRowsForExport.value = selectedRows || [];
  exportModalStep.value = EXPORT_MODAL_STEP.WARNING;
  exportModalEnabled.value = true;
  // Reset progress state for fresh run
  exportProgress.value = {
    show: false,
    completed: 0,
    total: selectedRowsForExport.value.length || 0,
    percentage: 0,
    currentStudent: null,
    errors: [],
  };
};

const proceedExportFromModal = async () => {
  // Switch view inside the modal
  exportModalStep.value = EXPORT_MODAL_STEP.PROGRESS;
  exportProgress.value.show = true;
  exportProgress.value.total = selectedRowsForExport.value.length || 0;

  try {
    await exportBulkPdfReports(selectedRowsForExport.value);
  } finally {
    // Always move to completed state when the export routine finishes (success or with errors)
    exportModalStep.value = EXPORT_MODAL_STEP.COMPLETED;
  }
};

const activeTabIndex = ref(0);

const pageWidth = 190; // Set page width for calculations
const returnScaleFactor = (width) => pageWidth / width; // Calculate the scale factor

const handleExportToPdf = async () => {
  exportLoading.value = true; // Set loading icon in button to prevent multiple clicks
  const doc = new jsPDF();
  let yCounter = 10; // yCounter tracks the y position in the PDF

  // Add At a Glance Charts and report header to the PDF. Captured from the permanently
  // off-screen "-export" twin (see template) rather than the live, visible element, since that
  // twin is always laid out at PDF_CAPTURE_WINDOW_WIDTH and its charts are always sized to match
  // — nothing needs to be resized on the fly here.
  const atAGlanceCharts = document.getElementById('at-a-glance-charts-export');
  if (atAGlanceCharts !== null) {
    await waitForElementRendered(atAGlanceCharts);
    yCounter = await addElementToPdf(atAGlanceCharts, doc, yCounter);
  }

  // Initialize to first tab
  activeTabIndex.value = 0;

  for (const [i, taskId] of sortedAndFilteredSubscoreTaskIds.value.entries()) {
    activeTabIndex.value = i;
    await nextTick();

    // Add Task Description and Task Chart to document
    const tabViewDesc = document.getElementById('tab-view-description-' + taskId);
    const tabViewChart = document.getElementById('tab-view-chart-' + taskId);

    // Wait for element to be rendered before capturing it for PDF export.
    await waitForElementRendered(tabViewChart || tabViewDesc);

    const chartHeight =
      tabViewChart &&
      (await html2canvas(tabViewChart).then((canvas) =>
        canvas.width ? canvas.height * returnScaleFactor(canvas.width) : 0,
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
    `roar-scores-${_kebabCase(getTitle(administrationData.value, isSuperAdmin.value))}-${_kebabCase(
      orgData.value.name,
    )}.pdf`,
  );
  exportLoading.value = false;
  window.scrollTo(0, 0);

  return;
};

/**
 * Exports selected student reports as PDFs in bulk
 *
 * @param {Array} selectedRows - Array of selected rows to export
 * @returns {Promise<void>}
 */
const exportBulkPdfReports = async (selectedRows) => {
  if (!selectedRows || selectedRows.length === 0) {
    console.warn('No students selected for bulk PDF export');
    return;
  }

  try {
    bulkPdfExportLoading.value = true;

    exportProgress.value = {
      show: true,
      completed: 0,
      total: selectedRows.length,
      percentage: 0,
      currentStudent: null,
      errors: [],
    };

    // Transform selected rows to student objects
    const students = selectedRows.map((row) => ({
      id: row.user.userId,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      username: row.user.username,
      email: row.user.email,
      grade: row.user.grade,
      externalId: getStudentExternalId(row.user),
    }));

    // URL generator function
    const urlGenerator = (student) => {
      return `${window.location.origin}/scores/${props.administrationId}/${props.orgType}/${props.orgId}/user/${student.id}?print=true`;
    };

    // Filename generator function
    const filenameGenerator = (student) => {
      const studentName =
        `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.username || student.id;
      const safeStudentName = studentName.replace(/[^a-zA-Z0-9\s-_]/g, '');
      // Include student ID to ensure uniqueness when students have the same name
      const safeStudentId = student.id.replace(/[^a-zA-Z0-9-_]/g, '');
      const fileName = `${safeStudentName}_${safeStudentId}`;
      return `ROAR-IndividualScoreReport-${fileName}${student.externalId}.pdf`;
    };

    // ZIP filename
    const sanitizedOrgName =
      orgData.value?.name?.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-') || 'organization';
    const sanitizedAdminName =
      administrationData.value?.name?.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-') || 'reports';
    const zipFilename = `${sanitizedOrgName}-${sanitizedAdminName}-score-reports.zip`;

    await PdfExportService.generateBulkDocuments(students, urlGenerator, filenameGenerator, {
      zipFilename,
      debug: false,
      onProgress: (progress) => {
        // Get the student name from the students array using the current index
        const currentStudent = students[progress.completed];
        let displayName = 'Processing...';

        if (currentStudent) {
          const { firstName, lastName } = getStudentDisplayName({
            name: { first: currentStudent.firstName, last: currentStudent.lastName },
            username: currentStudent.username,
          });
          displayName = `${firstName} ${lastName}`.trim() || currentStudent.username || 'Processing...';
        }

        exportProgress.value = {
          ...exportProgress.value,
          completed: progress.completed,
          total: progress.total,
          percentage: progress.percentage,
          currentStudent: displayName,
          errors: progress.errors,
        };
      },
    });

    // Hide progress after completion, but keep visible longer if there are errors
    setTimeout(() => {
      const hasErrors = exportProgress.value.errors && exportProgress.value.errors.length > 0;
      if (!hasErrors) {
        exportProgress.value.show = false;
      }
    }, 3000);
  } catch (error) {
    console.error('Error during bulk PDF export:', error);
    // TODO: Show error toast
  } finally {
    bulkPdfExportLoading.value = false;
  }
};

const orderBy = ref([
  {
    field: 'user.grade',
    order: '1',
  },
  {
    field: 'user.lastName',
    order: '1',
  },
]);
// If this is a district report, make the schools column first sorted.
if (props.orgType === 'district') {
  orderBy.value.unshift({
    order: '1',
    field: 'user.schoolName',
  });
}

const pageLimit = ref(10);

const { data: tasksDictionary, isLoading: isLoadingTasksDictionary } = useTasksDictionaryQuery({
  enabled: initialized,
});

const { data: userClaims } = useUserClaimsQuery({
  enabled: initialized,
});

const { isSuperAdmin } = useUserType(userClaims);

const { data: administrationData } = useAdministrationsQuery([props.administrationId], {
  enabled: initialized,
  select: (data) => data[0],
});

const { data: districtSchoolsData } = useDistrictSchoolsQuery(props.orgId, {
  enabled: props.orgType === SINGULAR_ORG_TYPES.DISTRICTS && initialized,
});

const { data: orgData, isLoading: isLoadingOrgData } = useOrgQuery(props.orgType, [props.orgId], {
  enabled: initialized,
  select: (data) => data[0],
});

const {
  isLoading: isLoadingScoreStudents,
  isFetching: isFetchingScoreStudents,
  data: scoreStudentsData,
} = useAdministrationScoreStudentsQuery(props.administrationId, props.orgType, props.orgId, {
  enabled: initialized,
});

const {
  isLoading: isLoadingProgress,
  isFetching: isFetchingProgress,
  data: progressData,
} = useAdministrationProgressQuery(props.administrationId, props.orgType, props.orgId, {
  enabled: initialized,
});

const isEmptyDistrictSupportCategories = computed(() => {
  return (
    props.orgType === 'district' &&
    (aggregatedDistrictSupportCategories.value?.status === 'failed' ||
      aggregatedDistrictSupportCategories.value?.length === 0 ||
      !aggregatedDistrictSupportCategories.value)
  );
});

const assignedTaskIds = computed(() => administrationData.value?.assessments?.map((task) => task.taskId));

const assignedNormedTaskIds = computed(() => assignedTaskIds.value.filter((id) => tasksToDisplayGraphs.includes(id)));

// Return a faded color if the backend marks a completed score unreliable.
function returnColorByReliability(score, taskId, supportLevel, tagColor) {
  if (score.reliable !== false) return tagColor;

  const engagementFlagExists = (score.engagementFlags ?? []).some((flag) =>
    includedValidityFlags[taskId]?.includes(flag),
  );
  if (supportLevel === 'Optional') return '#a1d8e3';
  if (supportLevel === 'Needs Extra Support' && engagementFlagExists) return '#d6b8c7';
  if (supportLevel === 'Developing Skill' && engagementFlagExists) return '#e8dbb5';
  if (supportLevel === 'Achieved Skill' && engagementFlagExists) return '#c0d9bd';
  return tagColor;
}

const SUPPORT_LEVEL_DISPLAY = Object.freeze({
  achievedSkill: SCORE_SUPPORT_SKILL_LEVELS.ACHIEVED_SKILL,
  developingSkill: SCORE_SUPPORT_SKILL_LEVELS.DEVELOPING_SKILL,
  needsExtraSupport: SCORE_SUPPORT_SKILL_LEVELS.NEEDS_EXTRA_SUPPORT,
  optional: 'Optional',
});

const SUPPORT_LEVEL_COLOR = Object.freeze({
  achievedSkill: SCORE_SUPPORT_LEVEL_COLORS.ABOVE,
  developingSkill: SCORE_SUPPORT_LEVEL_COLORS.SOME,
  needsExtraSupport: SCORE_SUPPORT_LEVEL_COLORS.BELOW,
  optional: SCORE_SUPPORT_LEVEL_COLORS.OPTIONAL,
});

const scoreTaskSlugById = computed(() => {
  return Object.fromEntries((scoreStudentsData.value?.tasks ?? []).map((task) => [task.taskId, task.taskSlug]));
});

const scoreReportSourceRows = computed(() => scoreStudentsData.value?.students ?? []);

const TASK_SUBSCORE_SLUGS = new Set([
  'cva',
  'fluency-arf',
  'fluency-calf',
  'fluency-arf-es',
  'fluency-calf-es',
  'letter',
  'letter-es',
  'letter-en-ca',
  'morphology',
  'pa',
  'phonics',
  'roam-alpaca',
  'roam-alpaca-es',
  'roam-alpaca-pt',
  'roar-inference',
  'sre-es',
  'swr-es',
  'trog',
]);
const PHONICS_SUBSCORE_KEYS = [
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
const FLUENCY_INCORRECT_SKILL_KEYS = {
  addition: 'additionIncorrectSkills',
  subtraction: 'subtractionIncorrectSkills',
  multiplication: 'multiplicationIncorrectSkills',
  division: 'divisionIncorrectSkills',
};

const progressTaskSlugById = computed(() => {
  return Object.fromEntries((progressData.value?.tasks ?? []).map((task) => [task.taskId, task.taskSlug]));
});

const mapProgressStatusToValue = (status) => {
  if (status?.endsWith('-optional')) return 'optional';
  if (status?.startsWith('completed')) return 'completed';
  if (status?.startsWith('started')) return 'started';
  return 'assigned';
};

const backendProgressByUserId = computed(() => {
  const progressByUser = {};

  for (const { user, progress } of progressData.value?.students ?? []) {
    const taskProgress = {};
    let startDate = null;
    let latestRequiredCompletion = null;
    let requiredTaskCount = 0;
    let completedRequiredTaskCount = 0;

    for (const [progressTaskId, entry] of Object.entries(progress ?? {})) {
      const taskId =
        progressTaskSlugById.value[progressTaskId] ?? scoreTaskSlugById.value[progressTaskId] ?? progressTaskId;
      taskProgress[taskId] = entry;

      if (entry.startedAt && (!startDate || entry.startedAt < startDate)) {
        startDate = entry.startedAt;
      }

      const isOptional = entry.status?.endsWith('-optional');
      if (!isOptional) {
        requiredTaskCount += 1;
        if (entry.status?.startsWith('completed')) {
          completedRequiredTaskCount += 1;
          if (entry.completedAt && (!latestRequiredCompletion || entry.completedAt > latestRequiredCompletion)) {
            latestRequiredCompletion = entry.completedAt;
          }
        }
      }
    }

    progressByUser[user.userId] = {
      taskProgress,
      startDate,
      completionDate:
        requiredTaskCount > 0 && requiredTaskCount === completedRequiredTaskCount ? latestRequiredCompletion : null,
    };
  }

  return progressByUser;
});

const hasProgressMetadata = computed(() => Object.keys(backendProgressByUserId.value).length > 0);

const progressDataForExport = computed(() => {
  return Object.fromEntries(
    Object.entries(backendProgressByUserId.value).map(([userId, metadata]) => [
      userId,
      Object.fromEntries(
        Object.entries(metadata.taskProgress ?? {}).map(([taskId, entry]) => [
          taskId,
          { value: mapProgressStatusToValue(entry.status) },
        ]),
      ),
    ]),
  );
});

const taskSubscoreTasks = computed(() => {
  const seenTaskIds = new Set();
  return (scoreStudentsData.value?.tasks ?? []).filter((task) => {
    if (!TASK_SUBSCORE_SLUGS.has(task.taskSlug) || seenTaskIds.has(task.taskId)) return false;
    seenTaskIds.add(task.taskId);
    return true;
  });
});

const taskSubscoreQueryResults = useQueries({
  queries: () =>
    taskSubscoreTasks.value.map((task) => ({
      queryKey: getAdministrationTaskSubscoresQueryKey(props.administrationId, task.taskId, props.orgType, props.orgId),
      queryFn: () =>
        fetchAdministrationTaskSubscores({
          administrationId: props.administrationId,
          taskId: task.taskId,
          scopeType: props.orgType,
          scopeId: props.orgId,
        }),
      enabled:
        initialized.value &&
        Boolean(authStore.accessToken) &&
        Boolean(props.administrationId) &&
        Boolean(task.taskId) &&
        Boolean(props.orgType) &&
        Boolean(props.orgId),
      retry: shouldRetryAdministrationTaskSubscoresQuery,
    })),
});

const taskSubscoreQueryStates = computed(() => taskSubscoreQueryResults.value ?? []);

const isLoadingTaskSubscores = computed(() => {
  return (
    taskSubscoreTasks.value.length > 0 &&
    taskSubscoreQueryStates.value.some((query) => query.isLoading || query.isPending)
  );
});

const isFetchingTaskSubscores = computed(() => {
  return taskSubscoreTasks.value.length > 0 && taskSubscoreQueryStates.value.some((query) => query.isFetching);
});

const isLoadingScoreReportRows = computed(() => {
  return (
    isLoadingScoreStudents.value ||
    isFetchingScoreStudents.value ||
    isLoadingProgress.value ||
    isFetchingProgress.value ||
    isLoadingTaskSubscores.value ||
    isFetchingTaskSubscores.value
  );
});

const taskSubscoresBySlugAndUserId = computed(() => {
  const acc = {};

  for (const query of taskSubscoreQueryStates.value) {
    const taskSlug = query.data?.task?.taskSlug;
    if (!taskSlug) continue;

    acc[taskSlug] ??= {};
    for (const student of query.data?.students ?? []) {
      acc[taskSlug][student.user.userId] = student.subscores ?? {};
    }
  }

  return acc;
});

const getTaskSubscores = (taskId, userId) => taskSubscoresBySlugAndUserId.value[taskId]?.[userId] ?? null;

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
};

const roundNullable = (value, precision = 0) => {
  const numeric = toNullableNumber(value);
  return numeric === null ? null : _round(numeric, precision);
};

const toPercentLabel = (value) => {
  const numeric = toNullableNumber(value);
  if (numeric === null) return null;
  const percent = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
  return `${Math.round(percent)}%`;
};

const parseCorrectAttempted = (value) => {
  if (typeof value !== 'string' || !value.includes('/')) return { correct: null, attempted: null };
  const [correctRaw, attemptedRaw] = value.split('/');
  return {
    correct: toNullableNumber(correctRaw),
    attempted: toNullableNumber(attemptedRaw),
  };
};

const countCommaSeparatedValues = (value) => {
  if (!value) return 0;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean).length;
};

const formatPaSkillsToWorkOn = (value) => {
  if (!value) return i18n.global.t('scoreReports.none');
  return String(value)
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean)
    .map((skill) => (PA_SUBTASK_I18N_KEYS[skill] ? i18n.global.t(PA_SUBTASK_I18N_KEYS[skill]) : skill))
    .join(', ');
};

const applyDisplayFields = (scoreRow, score, taskId) => {
  const scoringVersion = getScoringVersions.value[taskId];

  if (score.display?.scoreType === 'percentCorrect') {
    scoreRow.percentCorrect = toPercentLabel(score.display.value);
    if (!isTaskNormed(taskId, scoringVersion)) {
      scoreRow.percentile = null;
    }
  }

  if (score.display?.scoreType === 'correctIncorrectDifference') {
    scoreRow.correctIncorrectDifference = score.display.value;
    if (!isTaskNormed(taskId, scoringVersion)) {
      scoreRow.rawScore = score.display.value;
    }
  }

  if (score.display?.scoreType === 'rawScore') {
    scoreRow.rawScore = score.display.value ?? scoreRow.rawScore;
  }
};

const applyCountSubscores = (scoreRow, subscores) => {
  if (!subscores) return;

  scoreRow.numCorrect = subscores.numCorrect ?? subscores.totalCorrect ?? subscores.subScore ?? scoreRow.numCorrect;
  scoreRow.numAttempted = subscores.numAttempted ?? subscores.totalNumAttempted ?? scoreRow.numAttempted;
  scoreRow.percentCorrect =
    toPercentLabel(subscores.percentCorrect ?? subscores.subPercentCorrect) ?? scoreRow.percentCorrect;
};

const applyBackendSpecialFields = (scoreRow, taskId, userId) => {
  const subscores = getTaskSubscores(taskId, userId);

  applyCountSubscores(scoreRow, subscores);

  if (tasksToDisplayCorrectIncorrectDifference.includes(taskId)) {
    scoreRow.numCorrect = subscores?.numCorrect ?? scoreRow.numCorrect;
    scoreRow.numIncorrect = subscores?.numIncorrect ?? scoreRow.numIncorrect;
    scoreRow.numAttempted = subscores?.numAttempted ?? scoreRow.numAttempted;
    scoreRow.correctIncorrectDifference = subscores?.correctIncorrectDifference ?? scoreRow.correctIncorrectDifference;
    scoreRow.scoringVersion = getScoringVersions.value[taskId];
  }

  if (taskId === 'phonics' && subscores) {
    scoreRow.numCorrect = subscores.totalCorrect ?? scoreRow.numCorrect;
    scoreRow.numAttempted = subscores.totalNumAttempted ?? scoreRow.numAttempted;
    scoreRow.percentCorrect = toPercentLabel(subscores.totalPercentCorrect) ?? scoreRow.percentCorrect;
    scoreRow.composite = {
      totalPercentCorrect: subscores.totalPercentCorrect ?? null,
      subscores: Object.fromEntries(PHONICS_SUBSCORE_KEYS.map((key) => [key, subscores[key] ?? '0/0'])),
    };
    scoreRow.skillsToWorkOn = subscores.skillsToWorkOn ?? 'None';
  }

  if ((taskId === 'letter' || taskId === 'letter-en-ca' || taskId === 'letter-es') && subscores) {
    scoreRow.lowerCaseScore = subscores.lowerCase;
    scoreRow.upperCaseScore = subscores.upperCase;
    scoreRow.phonemeScore = subscores.letterSounds;
    scoreRow.totalScore = subscores.total;
    scoreRow.numCorrect = toNullableNumber(subscores.total) ?? scoreRow.numCorrect;
    scoreRow.incorrectLetters = subscores.lettersToWorkOn || 'None';
    scoreRow.incorrectPhonemes = subscores.soundsToWorkOn || 'None';
  }

  if (taskId === 'pa' && subscores) {
    const total = parseCorrectAttempted(subscores.total);
    scoreRow.firstSound = subscores.FSM;
    scoreRow.lastSound = subscores.LSM;
    scoreRow.deletion = subscores.DEL;
    scoreRow.total = subscores.total;
    scoreRow.numCorrect = total.correct ?? scoreRow.numCorrect;
    scoreRow.numAttempted = total.attempted ?? scoreRow.numAttempted;
    scoreRow.skills = formatPaSkillsToWorkOn(subscores.skillsToWorkOn);
  }

  if (tasksToDisplayTotalCorrect.includes(taskId) && subscores) {
    scoreRow.rawScore = roundNullable(subscores.compositeRawScore ?? scoreRow.rawScore, 2);
    scoreRow.numCorrect = subscores.compositeNumCorrect ?? scoreRow.numCorrect;
    scoreRow.numIncorrect = subscores.compositeNumIncorrect ?? scoreRow.numIncorrect;
    scoreRow.numAttempted = subscores.compositeNumAttempted ?? scoreRow.numAttempted;
    scoreRow.percentCorrect = toPercentLabel(subscores.compositePercentCorrect) ?? scoreRow.percentCorrect;
    scoreRow.isNewScoring = true;
    scoreRow.recruitment =
      subscores.freeResponse != null || subscores.multipleChoice != null ? 'responseModality' : null;

    if (scoreRow.recruitment === 'responseModality') {
      scoreRow.fr = {
        rawScore: subscores.freeResponse,
        numCorrect: subscores.freeResponseNumCorrect,
        numIncorrect: subscores.freeResponseNumIncorrect,
        numAttempted: subscores.freeResponseNumAttempted,
      };
      scoreRow.fc = {
        rawScore: subscores.multipleChoice,
        numCorrect: subscores.multipleChoiceNumCorrect,
        numIncorrect: subscores.multipleChoiceNumIncorrect,
        numAttempted: subscores.multipleChoiceNumAttempted,
      };
      const rawScore = (subscores.freeResponse ?? 0) + (subscores.multipleChoice ?? 0);
      scoreRow.rawScore = rawScore === 0 ? null : rawScore;
    } else {
      const incorrectSkills = {};
      let totalIncorrectSkills = 0;

      for (const subskill of Object.keys(roamFluencySubskills)) {
        const subskillScore = {
          rawScore: roundNullable(subscores[`${subskill}RawScore`], 2),
          numCorrect: subscores[`${subskill}NumCorrect`],
          numIncorrect: subscores[`${subskill}NumIncorrect`],
          numAttempted: subscores[`${subskill}NumAttempted`],
          percentCorrect: toPercentLabel(subscores[`${subskill}PercentCorrect`]),
          skillsAssessed: subscores[`${subskill}SkillsAssessed`],
        };
        const hasSubskillScore = Object.values(subskillScore).some((value) => value !== null && value !== undefined);
        if (hasSubskillScore) {
          scoreRow[subskill] = subskillScore;
          scoreRow.useSubskillFormat = true;
        }

        const skills = subscores[FLUENCY_INCORRECT_SKILL_KEYS[subskill]];
        if (skills) {
          incorrectSkills[subskill] = skills;
          totalIncorrectSkills += countCommaSeparatedValues(skills);
        }
      }

      scoreRow.composite = {
        rawScore: scoreRow.rawScore,
        numCorrect: scoreRow.numCorrect,
        numIncorrect: scoreRow.numIncorrect,
        numAttempted: scoreRow.numAttempted,
        percentCorrect: scoreRow.percentCorrect,
        totalIncorrectSkills: totalIncorrectSkills || null,
        incorrectSkills,
      };
    }
  }

  if (taskId === 'roam-alpaca' && subscores) {
    const compositeSupportLevel = subscores.supportLevel ?? scoreRow.supportLevel;
    scoreRow.rawScore = subscores.rawScore ?? scoreRow.rawScore;
    scoreRow.numCorrect = subscores.compositeNumCorrect ?? subscores.rawScore ?? scoreRow.numCorrect;
    scoreRow.numAttempted = subscores.compositeNumAttempted ?? scoreRow.numAttempted;
    scoreRow.gradeEstimate = roundNullable(subscores.gradeEstimate, 2);
    scoreRow.supportLevel = compositeSupportLevel;
    scoreRow.tagColor = getTagColor(compositeSupportLevel);

    for (const subskillId of Object.keys(roamAlpacaSubskills)) {
      const supportLevel = subscores[`${subskillId}SupportLevel`];
      const subskillScore = {
        rawScore: subscores[`${subskillId}RawScore`] ?? subscores[`${subskillId}NumCorrect`],
        numCorrect: subscores[`${subskillId}NumCorrect`],
        numIncorrect: subscores[`${subskillId}NumIncorrect`],
        numAttempted: subscores[`${subskillId}NumAttempted`],
        percentCorrect: toPercentLabel(subscores[subskillId]),
        gradeEstimate: roundNullable(subscores[`${subskillId}GradeEstimate`], 2),
        supportLevel,
        tagColor: getTagColor(supportLevel),
      };
      scoreRow[subskillId] = Object.values(subskillScore).some((value) => value !== null && value !== undefined)
        ? subskillScore
        : null;
    }

    scoreRow.composite = {
      rawScore: subscores.rawScore,
      roarScore: subscores.rawScore,
      numCorrect: scoreRow.numCorrect,
      numAttempted: scoreRow.numAttempted,
      gradeEstimate: scoreRow.gradeEstimate ?? '',
      supportLevel: compositeSupportLevel,
      incorrectSkills: subscores.incorrectSkills || null,
      tagColor: scoreRow.tagColor,
    };
  }
};

const formatBackendScoreTags = (score, tagColor, progressEntry) => {
  let scoreFilterTags = score.optional ? ' Optional ' : ' Required ';
  scoreFilterTags += score.reliable === false ? ' Unreliable ' : ' Reliable ';

  if (progressEntry?.status?.startsWith('completed')) {
    scoreFilterTags += ' Completed ';
  } else if (progressEntry?.status?.startsWith('started')) {
    scoreFilterTags += ' Started ';
  } else if (progressEntry?.status?.startsWith('assigned')) {
    scoreFilterTags += ' Assigned ';
  } else if (score.completed) {
    scoreFilterTags += ' Completed ';
  }

  if (score.completed || score.rawScore != null || score.percentile != null || score.standardScore != null) {
    scoreFilterTags += ' Assessed ';
  }

  if (tagColor === SCORE_SUPPORT_LEVEL_COLORS.ABOVE) {
    scoreFilterTags += ' Green ';
  } else if (tagColor === SCORE_SUPPORT_LEVEL_COLORS.SOME) {
    scoreFilterTags += ' Yellow ';
  } else if (tagColor === SCORE_SUPPORT_LEVEL_COLORS.BELOW) {
    scoreFilterTags += ' Pink ';
  }

  return scoreFilterTags;
};

const mapBackendScoreRows = (rows) => {
  const assignmentTableDataAcc = [];
  const runsByTaskIdAcc = {};

  for (const { user, scores } of rows) {
    const firstNameOrUsername = user.firstName ?? user.username ?? 'user';
    const currRowScores = {};
    let numAssessmentsCompleted = 0;
    const progressMetadata = backendProgressByUserId.value[user.userId];

    for (const [scoreTaskId, score] of Object.entries(scores ?? {})) {
      const taskId = scoreTaskSlugById.value[scoreTaskId] ?? scoreTaskId;
      const progressEntry = progressMetadata?.taskProgress?.[taskId];
      const supportLevel = SUPPORT_LEVEL_DISPLAY[score.supportLevel] ?? null;
      const tagColor = returnColorByReliability(
        score,
        taskId,
        supportLevel,
        SUPPORT_LEVEL_COLOR[score.supportLevel] ?? SCORE_SUPPORT_LEVEL_COLORS.ASSESSED,
      );
      const percentile = score.percentile != null ? _round(score.percentile) : null;

      if (progressEntry?.status?.startsWith('completed') ?? score.completed) {
        numAssessmentsCompleted += 1;
      }

      currRowScores[taskId] = {
        optional: score.optional,
        supportLevel,
        reliable: score.reliable,
        engagementFlags: score.engagementFlags ?? [],
        tagColor,
        percentile,
        percentileString: percentile,
        rawScore: score.rawScore,
        standardScore: score.standardScore,
        tags: formatBackendScoreTags(score, tagColor, progressEntry),
      };
      applyDisplayFields(currRowScores[taskId], score, taskId);
      applyBackendSpecialFields(currRowScores[taskId], taskId, user.userId);

      const run = {
        grade: getGrade(user.grade),
        scores: {
          support_level: supportLevel,
          stdPercentile: percentile,
          rawScore: score.rawScore,
        },
        taskId,
        user: {
          grade: user.grade,
          schoolName: user.schoolName ?? '0 Unknown School',
        },
        tag_color: tagColor,
      };

      if (run.taskId in runsByTaskIdAcc) {
        runsByTaskIdAcc[run.taskId].push(run);
      } else {
        runsByTaskIdAcc[run.taskId] = [run];
      }
    }

    assignmentTableDataAcc.push({
      user: {
        username: user.username,
        email: user.email,
        userId: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        grade: user.grade,
        assessmentPid: user.assessmentPid,
        schoolName: user.schoolName,
        // These identifiers are not currently exposed by the backend report user shape.
        stateId: null,
        studentId: null,
        sisId: null,
      },
      tooltip: `View ${firstNameOrUsername}'s Score Report`,
      launchTooltip: `View assessment portal for ${firstNameOrUsername}`,
      routeParams: {
        administrationId: props.administrationId,
        orgId: props.orgId,
        orgType: props.orgType,
        userId: user.userId,
      },
      compositeScore: null,
      startDate: progressMetadata?.startDate ?? null,
      completionDate: progressMetadata?.completionDate ?? null,
      scores: currRowScores,
      numAssessmentsCompleted,
    });
  }

  assignmentTableDataAcc.sort((a, b) => {
    const completionDiff = b.numAssessmentsCompleted - a.numAssessmentsCompleted;
    if (completionDiff !== 0) return completionDiff;

    const schoolDiff = (a.user?.schoolName ?? '').localeCompare(b.user?.schoolName ?? '');
    if (schoolDiff !== 0) return schoolDiff;

    const gradeDiff = Number(a.user.grade) - Number(b.user.grade);
    if (isNaN(gradeDiff)) {
      const stringGradeDiff = (a.user?.grade?.toString() ?? '').localeCompare(b.user?.grade?.toString() ?? '');
      if (stringGradeDiff !== 0) return stringGradeDiff;
    } else if (gradeDiff !== 0) {
      return gradeDiff;
    }

    return (a.user?.lastName ?? '').localeCompare(b.user?.lastName ?? '');
  });

  return {
    runsByTaskId: _pickBy(runsByTaskIdAcc, (scores, taskId) => Object.keys(taskInfoById).includes(taskId)),
    assignmentTableData: assignmentTableDataAcc,
    compositeFoundationalRuns: [],
  };
};

const backendScoreReportData = computed(() => {
  return scoreReportSourceRows.value.length > 0
    ? mapBackendScoreRows(scoreReportSourceRows.value)
    : { assignmentTableData: [], runsByTaskId: {}, compositeFoundationalRuns: [] };
});

const scoreReportTableData = computed(() => backendScoreReportData.value.assignmentTableData);

// runsByTaskId for the ScoreDistributionOverview chart, including the foundational composite score
// (kept separate from backendScoreReportData.runsByTaskId since 'compositeFoundational' is not a real taskId
// and would break taskId-keyed logic like sortedTaskIds and CSV export).
const runsByTaskIdForDistributionChart = computed(() => {
  if (props.orgType === 'district') return aggregatedDistrictSupportCategories.value;

  const { runsByTaskId, compositeFoundationalRuns } = backendScoreReportData.value;
  if (!compositeFoundationalRuns?.length) return runsByTaskId;

  return { ...runsByTaskId, compositeFoundational: compositeFoundationalRuns };
});

// This composable manages the data which is passed into the FilterBar component slot for filtering
const filteredTableData = ref([]);

watch(
  backendScoreReportData,
  (newValue) => {
    filteredTableData.value = newValue.assignmentTableData;
  },
  { immediate: true, deep: true },
);

const viewMode = ref('color');

const viewOptions = ref([
  { label: 'Support Level', value: 'color' },
  { label: 'Percentile', value: 'percentile' },
  { label: 'Standard Score', value: 'standard' },
  { label: 'Raw Score', value: 'raw' },
]);

/**
 * Creates and formats the data for exporting user, score, and optionally, progress information to a CSV file.
 *
 * This function generates a structured dataset based on user and score data, with optional inclusion of progress
 * data. It ensures that the data is organized appropriately for export, including task-specific formatting an
 * reliability checks. If progress data is included, it appends relevant progress information per task.
 *
 * This function also checks for the user's role (e.g., super admin) to determine additional fields (such as PID),
 * handles task-specific score presentation based on configuration, and validates task reliability using engagement
 * flags. If scores are found unreliable, the reliability reason is included. If the task is incomplete, it is marked as
 * such.
 *
 * @param {Object[]} rows - The array of user data and associated scores.
 * @param {Object} rows[].user - The user object containing user details such as username, email, first name, and last
 * name.
 * @param {Object} rows[].scores - The scores object containing task-related score data for the user. It supports
 * different score types (percent correct, raw scores, standard scores, etc.) based on task configuration.
 * @param {boolean} [includeProgress=false] - Flag indicating whether to include task progress data in the export. If
 * true, progress data will be fetched and appended for each task per user.
 *
 * @returns {Array<Object>} - The formatted data array, where each object represents a user and their associated scores.
 * This data is ready for CSV export and optionally includes progress information.
 */

const createExportData = ({ rows, includeProgress = false }) => {
  // const computedExportData = _map(rows, ({ user, scores, startDate, completionDate, compositeScore }) => {
  const computedExportData = _map(rows, ({ user, scores, startDate, completionDate }) => {
    let tableRow = {
      Username: user?.username,
      Email: user?.email, // This will only be used when exporting all rows
      First: user?.firstName,
      Last: user?.lastName,
      Grade: user?.grade,
    };

    if (authStore.isUserSuperAdmin) {
      tableRow['PID'] = user?.assessmentPid;
    }

    tableRow['Start Date'] = startDate ? new Date(startDate).toLocaleDateString('en-US') : null;
    tableRow['Completion Date'] = completionDate ? new Date(completionDate).toLocaleDateString('en-US') : null;

    // if (userCan(Permissions.Reports.Score.READ_COMPOSITE)) {
    //   tableRow['Composite Score - Percentile'] = compositeScore?.percentile;
    //   tableRow['Composite Score - Standard'] = compositeScore?.standardScore;
    //   tableRow['Composite Score - Raw'] = compositeScore?.rawScore;
    //   tableRow['Composite Score - Support Level'] = compositeScore?.supportLevel;
    // }

    if (props.orgType === 'district') {
      tableRow['School'] = user?.schoolName;
    }

    tableRow['State ID'] = user.stateId;
    tableRow['Student ID'] = user.studentId;
    tableRow['SIS ID'] = user.sisId;

    for (const taskId in scores) {
      const score = scores[taskId];
      const taskName = tasksDictionary.value[taskId]?.publicName ?? taskId;

      // Add task-specific score information
      if (tasksToDisplayPercentCorrect.includes(taskId) && !isTaskNormed(taskId, getScoringVersions.value[taskId])) {
        tableRow[`${taskName} - Percent Correct`] = score.percentCorrect;
        tableRow[`${taskName} - Num Attempted`] = score.numAttempted;
        tableRow[`${taskName} - Num Correct`] = score.numCorrect;
      } else if (
        tasksToDisplayCorrectIncorrectDifference.includes(taskId) &&
        !isTaskNormed(taskId, getScoringVersions.value[taskId])
      ) {
        tableRow[`${taskName} - Correct/Incorrect Difference`] = score.correctIncorrectDifference;
        tableRow[`${taskName} - Num Incorrect`] = score.numIncorrect;
        tableRow[`${taskName} - Num Correct`] = score.numCorrect;
      } else if (tasksToDisplayTotalCorrect.includes(taskId)) {
        const hasSubskills = scores ? Object.keys(scores[taskId]).some((key) => roamFluencySubskills[key]) : false;
        // Non-response modality (1.3.6+)
        if (hasSubskills) {
          tableRow[`${taskName} - Raw Score`] = score.rawScore;

          Object.entries(roamFluencySubskillHeadersNonResponse).forEach(([property, propertyHeader]) => {
            tableRow[`${taskName} - ${propertyHeader}`] = score[property];
          });
        } else {
          const setSubscore = (field, score) => {
            // Response modality prod data only uses new field names (ver 1.2.23+)
            let result = '';
            let total = 0;
            if (score.fr) {
              const frScore = score.fr[field] ?? 0;
              result += `Free Response: ${frScore}`;
              total += frScore;
            }

            if (score.fc) {
              const fcScore = score.fc[field] ?? 0;
              result += `${result ? '\n' : ''}Multiple Choice: ${fcScore}`;
              total += fcScore;
            }

            if (score.fr || score.fc) result += `\nTotal: ${total}`;

            // If result is an empty string, handle a non-response modality score
            return result || score[field];
          };

          tableRow[`${taskName} - Raw Score`] = score.rawScore;

          Object.entries(roamFluencySubskillHeaders).forEach(([property, propertyHeader]) => {
            tableRow[`${taskName} - ${propertyHeader}`] = setSubscore(property, score);
          });
        }
      } else if (rawOnlyTasks.includes(taskId) && !isTaskNormed(taskId, getScoringVersions.value[taskId])) {
        tableRow[`${taskName} - Raw`] = score.rawScore;
      } else if (tasksToDisplayGradeEstimate.includes(taskId)) {
        tableRow[`${taskName} - Num Correct`] = score.numCorrect;
        tableRow[`${taskName} - Num Attempted`] = score.numAttempted;
        tableRow[`${taskName} - Raw`] = score.rawScore;
        // Technically thetaEstimate for old scoring system (previous implementation)
        tableRow[`${taskName} - Grade Estimate`] = score.gradeEstimate;
        tableRow[`${taskName} - Support Level`] = score.supportLevel;
        // TODO: Check if all tasks in excludeFromScoringTasks can be excluded from scoring report
      } else if (!LEVANTE_TASK_IDS_NO_SCORES.includes(taskId) && taskId !== 'roar-survey') {
        tableRow[`${taskName} - Percentile`] = score.percentileString;
        tableRow[`${taskName} - Standard`] = score.standardScore;
        tableRow[`${taskName} - Raw`] = score.rawScore;
        tableRow[`${taskName} - Support Level`] = score.supportLevel;
      }

      // Add reliability information
      if (score.reliable !== undefined && !score.reliable && score.engagementFlags !== undefined) {
        // engagementFlags may arrive as an array (backend / normalized rows) or a legacy
        // Firestore object map (raw assessment) — normalize before reading.
        const engagementFlags = Array.isArray(score.engagementFlags)
          ? score.engagementFlags
          : Object.keys(score.engagementFlags ?? {});
        if (engagementFlags.length > 0) {
          if (includedValidityFlags[taskId]) {
            const filteredFlags = engagementFlags.filter((flag) => includedValidityFlags[taskId].includes(flag));
            tableRow[`${taskName} - Reliability`] =
              filteredFlags.length === 0 ? 'Unreliable' : `Unreliable: ${filteredFlags.map(_lowerCase).join(', ')}`;
          } else {
            tableRow[`${taskName} - Reliability`] = `Unreliable: ${engagementFlags.map(_lowerCase).join(', ')}`;
          }
        } else {
          tableRow[`${taskName} - Reliability`] = 'Assessment Incomplete';
        }
      } else {
        tableRow[`${taskName} - Reliability`] = 'Reliable';
      }

      // Add progress immediately after reliability if includeProgress is true
      if (includeProgress) {
        const progressRow = progressDataForExport.value[user?.userId];

        if (progressRow) {
          scoreReportColumns.value.forEach((column) => {
            const { field, header: taskName } = column; // Use taskName from the column header

            // Ensure field is defined and is a string before calling startsWith
            if (typeof field === 'string' && field.startsWith('scores')) {
              const scoreKey = field.split('.').slice(-2, -1)[0]; // Extract taskId (e.g., "swr", "sre", etc.)

              // Check if taskId exists in progressRow.progress
              if (progressRow[scoreKey]) {
                tableRow[`${taskName} - Progress`] = progressRow[scoreKey].value;
              } else {
                tableRow[`${taskName} - Progress`] = 'not assigned';
              }
            }
          });

          /**
           * Use taskId to bypass the current filter ' - ' for scored tasks in exportData
           * to avoid duplicate columns (e.g. ROAR - Survey) and allow unique headers (e.g. Hearts and Flowers)
           */
          if (excludeFromScoringTasks.includes(taskId)) {
            tableRow[`${taskId} - Progress`] = progressRow[taskId]?.value ?? 'not assigned';
          }
        } else {
          // If no progressRow is found, mark all scores as "not assigned"
          scoreReportColumns.value.forEach((column) => {
            const { field, header: taskName } = column; // Use taskName from the column header

            // Ensure field is defined and is a string before calling startsWith
            if (field && typeof field === 'string' && field.startsWith('scores')) {
              tableRow[`${taskName} - Progress`] = 'not assigned';
            }
          });
        }
      }
    }

    return tableRow;
  });

  return computedExportData;
};

/**
 * Exports data to a CSV file with dynamic columns based on selected rows and tasks.
 *
 * @param {Object} options - Options for exporting data.
 * @param {Array} options.selectedRows - The selected rows to export. If null, will export all rows.
 * @param {boolean} options.includeProgress - Determines if progress columns should be included in the export.
 */
const exportData = async ({ selectedRows = null, includeProgress = false }) => {
  csvExportLoading.value = true;
  const rows = selectedRows || backendScoreReportData.value.assignmentTableData;
  let exportData = createExportData({ rows, includeProgress });

  // Analyze all rows to determine which columns are present in the data
  const allColumns = new Set();
  exportData.forEach((row) => {
    Object.keys(row).forEach((column) => {
      allColumns.add(column);
    });
  });

  // Convert Set to Array for sorting
  const allColumnsArray = Array.from(allColumns);

  // Define the static columns
  const staticColumns = [...CSV_EXPORT_STATIC_COLUMNS];

  // if (userCan(Permissions.Reports.Score.READ_COMPOSITE)) {
  //   staticColumns.push(...CSV_EXPORT_COMPOSITE_SCORE_COLUMNS);
  // }

  if (orgData.value?.clever === true) {
    staticColumns.push('State ID');
    staticColumns.unshift('Student ID');
  }

  // Automatically detect task names by splitting column names and excluding static columns
  const taskBases = Array.from(
    new Set(
      allColumnsArray.filter((col) => !staticColumns.includes(col)).map((col) => col.split(' - ')[1]), // Extract the task name part
    ),
  );

  // Group task columns and place 'Reliability' and 'Progress' last for each task
  const finalColumns = [
    ...staticColumns,
    ...taskBases.reduce((acc, taskBase) => {
      const taskCols = allColumnsArray.filter(
        (col) =>
          col.includes(` - ${taskBase} -`) &&
          !col.endsWith('Reliability') &&
          !col.endsWith('Progress') &&
          !col.endsWith('Reliable'),
      );

      // Include reliability columns ONLY if task is in includeReliabilityFlagsOnExport
      const reliabilityCol = includeReliabilityFlagsOnExport.includes(taskBase)
        ? allColumnsArray.filter(
            (col) => col.includes(` - ${taskBase} -`) && (col.endsWith('Reliability') || col.endsWith('Reliable')),
          )
        : [];

      const progressCol = allColumnsArray.filter((col) => col.includes(` - ${taskBase} -`) && col.endsWith('Progress'));
      return [...acc, ...taskCols, ...reliabilityCol, ...progressCol];
    }, []),
  ];

  // Reorder exportData according to finalColumns
  exportData = exportData.map((row) => {
    const reorderedRow = {};
    finalColumns.forEach((col) => {
      reorderedRow[col] = row[col] !== undefined ? row[col] : null;
    });

    // Add progress columns for unscored tasks when exporting combined reports
    if (includeProgress) {
      const unscoredTaskIds = Object.values(administrationData.value.assessments)
        .filter((assessment) => excludeFromScoringTasks.includes(assessment.taskId))
        .map((assessment) => assessment.taskId);
      unscoredTaskIds.forEach((taskId) => {
        const taskName = tasksDictionary.value[taskId]?.publicName ?? taskId;
        reorderedRow[`${taskName} - Progress`] =
          row[`${taskId} - Progress`] !== undefined ? row[`${taskId} - Progress`] : null;
      });
    }

    return reorderedRow;
  });

  // Create the file name for export
  const fileNameSuffix = includeProgress ? '-scores-progress' : '-scores';
  const selectedSuffix = selectedRows ? '-selected' : '';
  const fileName = `roar${fileNameSuffix}${selectedSuffix}-${_kebabCase(
    getTitle(administrationData.value, isSuperAdmin.value),
  )}-${_kebabCase(orgData.value.name)}.csv`;

  // Export CSV
  exportCsv(exportData, fileName);
  csvExportLoading.value = false;
};

const refreshing = ref(false);

const getTaskStyle = (taskId, backgroundColor, tasks) => {
  const taskGroups = {
    primary: ['swr', 'sre', 'pa', 'letter', 'letter-en-ca'],
    spanish: ['letter-es', 'pa-es', 'swr-es', 'sre-es'],
    spanishmath: ['fluency-arf-es', 'fluency-calf-es'],
    supplementary: ['morphology', 'cva', 'vocab', 'trog', 'phonics', 'roar-inference'],
    roam: ['fluency-arf', 'fluency-calf', 'roam-alpaca', 'egma-math'],
    roav: ['ran', 'crowding', 'roav-mep', 'mep', 'mep-pseudo'],
  };

  let taskGroup = null;
  for (const group in taskGroups) {
    if (taskGroups[group].includes(taskId)) {
      taskGroup = group;
      break;
    }
  }

  if (!taskGroup) return ''; // taskId not found in any group

  const tasksList = taskGroups[taskGroup];
  let borderStyle = '';

  const isCurrentTask = tasksList.includes(taskId);
  const firstMissingTask = tasksList.find((task) => tasks.includes(task));

  const taskIndex = tasks.indexOf(taskId);
  const nextTask = tasks[taskIndex + 1] ?? null;

  if (nextTask && !taskGroups[taskGroup].includes(nextTask)) {
    borderStyle = 'border-right: 2px solid var(--primary-color);;';
  } else if (taskId === tasksList[tasksList.length - 1] && firstMissingTask !== taskId) {
    borderStyle = 'border-right: 5px solid var(--primary-color);;';
  } else if (
    isCurrentTask &&
    firstMissingTask &&
    taskId === firstMissingTask &&
    firstMissingTask !== tasksList[tasksList.length - 1]
  ) {
    borderStyle = 'border-left: 2px solid var(--primary-color);;';
  } else if (firstMissingTask === tasksList[tasksList.length - 1]) {
    borderStyle = 'border-right: 5px solid var(--primary-color); border-left: 5px solid var(--primary-color);;';
  }
  return `background-color: ${backgroundColor}; justify-content: center; margin: 0; text-align: center; ${borderStyle}`;
};

// compute and store schoolid -> school name map for schools. store adminId,
// orgType, orgId for individual score report link
const scoreReportColumns = computed(() => {
  if (isLoadingTasksDictionary.value || scoreStudentsData.value === undefined) return [];
  const tableColumns = [];
  tableColumns.push({
    header: 'Report',
    link: true,
    routeName: 'StudentScoreReport',
    routeTooltip: 'Student Score Report',
    routeIcon: 'pi pi-chart-bar border-none text-primary hover:text-white',
    sort: false,
    pinned: true,
    orgType: props.orgType,
    orgId: props.orgId,
    administrationId: props.administrationId,
  });

  let hasUsername = false;
  if (scoreReportSourceRows.value.find((row) => row.user?.username)) {
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
  if (scoreReportSourceRows.value.find((row) => row.user?.email)) {
    tableColumns.push({
      field: 'user.email',
      header: 'Email',
      dataType: 'text',
      pinned: true,
      sort: true,
      filter: true,
    });
  }
  if (scoreReportSourceRows.value.find((row) => row.user?.firstName)) {
    if (!hasUsername) {
      tableColumns.push({
        field: 'user.firstName',
        header: 'First Name',
        dataType: 'text',
        sort: true,
        filter: true,
        pinned: true,
        style: (() => {
          return `text-align: left`;
        })(),
      });
    } else {
      tableColumns.push({
        field: 'user.firstName',
        header: 'First Name',
        dataType: 'text',
        sort: true,
        filter: true,
        style: (() => {
          return `text-align: left`;
        })(),
      });
    }
  }
  if (scoreReportSourceRows.value.find((row) => row.user?.lastName)) {
    tableColumns.push({
      field: 'user.lastName',
      header: 'Last Name',
      dataType: 'text',
      sort: true,
      filter: true,
      style: (() => {
        return `text-align: left`;
      })(),
    });
  }

  tableColumns.push({ field: 'user.grade', header: 'Grade', dataType: 'text', sort: true, filter: true });

  if (props.orgType === 'district') {
    tableColumns.push({
      field: 'user.schoolName',
      header: 'School',
      dataType: 'text',
      sort: true,
      filter: true,
      useMultiSelect: true,
      multiSelectOptions: districtSchoolsData.value?.map((school) => school.name) ?? [],
      multiSelectPlaceholder: 'Filter by School',
      headerStyle: authStore.isUserSuperAdmin
        ? `background:var(--primary-color); color:white; padding-top:0; margin-top:0; padding-bottom:0; margin-bottom:0; border:0; margin-left:0 `
        : `background:var(--primary-color); color:white; padding-top:0; margin-top:0; padding-bottom:0; margin-bottom:0; border:0; margin-left:0; border-right-width:2px; border-right-style:solid; border-right-color:#ffffff;`,
    });
  }

  if (authStore.isUserSuperAdmin) {
    tableColumns.push({
      field: 'user.assessmentPid',
      header: 'PID',
      dataType: 'text',
      sort: false,
      headerStyle: `background:var(--primary-color); color:white; padding-top:0; margin-top:0; padding-bottom:0; margin-bottom:0; border:0; margin-left:0; border-right-width:2px; border-right-style:solid; border-right-color:#ffffff;`,
    });
  }

  tableColumns.push({
    field: 'user.stateId',
    header: 'State ID',
    dataType: 'text',
    sort: false,
    hidden: true, // Column is hidden by default, available via the Show/Hide Columns menu
    headerStyle: `background:var(--primary-color); color:white; padding-top:0; margin-top:0; padding-bottom:0; margin-bottom:0; border:0; margin-left:0; border-right-width:2px; border-right-style:solid; border-right-color:#ffffff;`,
  });

  if (hasProgressMetadata.value) {
    tableColumns.push({
      field: 'startDate',
      header: 'Start Date',
      dataType: 'date',
      sort: true,
      filter: false,
      hidden: true, // Column is hidden by default, available via the Show/Hide Columns menu
      headerStyle: `background:var(--primary-color); color:white; padding-top:0; margin-top:0; padding-bottom:0; margin-bottom:0; border:0; margin-left:0; border-right-width:2px; border-right-style:solid; border-right-color:#ffffff;`,
    });

    tableColumns.push({
      field: 'completionDate',
      header: 'Completion Date',
      dataType: 'date',
      sort: true,
      filter: false,
      hidden: true, // Column is hidden by default, available via the Show/Hide Columns menu
      headerStyle: `background:var(--primary-color); color:white; padding-top:0; margin-top:0; padding-bottom:0; margin-bottom:0; border:0; margin-left:0; border-right-width:2px; border-right-style:solid; border-right-color:#ffffff;`,
    });
  }

  tableColumns.push({
    field: 'user.studentId',
    header: 'Student ID',
    dataType: 'text',
    sort: false,
    hidden: true, // Column is hidden by default, available via the Show/Hide Columns menu
    headerStyle: `background:var(--primary-color); color:white; padding-top:0; margin-top:0; padding-bottom:0; margin-bottom:0; border:0; margin-left:0; border-right-width:2px; border-right-style:solid; border-right-color:#ffffff;`,
  });

  tableColumns.push({
    field: 'user.sisId',
    header: 'SIS ID',
    dataType: 'text',
    sort: false,
    hidden: true, // Column is hidden by default, available via the Show/Hide Columns menu
    headerStyle: `background:var(--primary-color); color:white; padding-top:0; margin-top:0; padding-bottom:0; margin-bottom:0; border:0; margin-left:0; border-right-width:2px; border-right-style:solid; border-right-color:#ffffff;`,
  });

  const isAdministrationOpen = administrationData.value?.dateClosed
    ? new Date(administrationData.value?.dateClosed) > new Date()
    : false;
  if (userCan(Permissions.Tasks.LAUNCH) && isAdministrationOpen) {
    tableColumns.push({
      header: 'Launch Student',
      launcher: true,
      routeName: 'LaunchHome',
      routeTooltip: 'Launch Student Assessment',
      routeIcon: 'pi pi-arrow-right border-none text-primary hover:text-white',
      sort: false,
      pinned: true,
    });
  }
  // Apply a border-right to the last column currently in the tableColumns object
  tableColumns[tableColumns.length - 1].style = (() => {
    return `border-right: 2px solid var(--primary-color);`;
  })();

  const sortedTasks = allTasks.value.toSorted((p1, p2) => {
    if (Object.keys(taskDisplayNames).includes(p1) && Object.keys(taskDisplayNames).includes(p2)) {
      return taskDisplayNames[p1].order - taskDisplayNames[p2].order;
    } else {
      return -1;
    }
  });

  const priorityTasks = ['swr', 'sre', 'pa', 'letter', 'letter-en-ca'];
  const spanishTasks = ['letter-es', 'pa-es', 'swr-es', 'sre-es'];
  const spanishMathTasks = ['fluency-arf-es', 'fluency-calf-es'];
  const supplementaryTasks = ['morphology', 'cva', 'vocab', 'trog', 'phonics', 'roar-inference'];
  const roamTasks = ['fluency-arf', 'fluency-calf', 'roam-alpaca', 'egma-math'];
  const roavTasks = ['ran', 'crowding', 'roav-mep', 'mep', 'mep-pseudo'];
  const orderedTasks = [];

  // Helper function to add tasks in a specific order
  const addTasksInOrder = (tasks) => {
    for (const task of tasks) {
      if (sortedTasks.includes(task)) {
        orderedTasks.push(task);
      }
    }
  };

  // Add tasks based on the defined order
  addTasksInOrder(priorityTasks);
  addTasksInOrder(spanishTasks);
  addTasksInOrder(spanishMathTasks);
  addTasksInOrder(supplementaryTasks);
  addTasksInOrder(roamTasks);
  addTasksInOrder(roavTasks);

  // Add any remaining tasks that were not included in the predefined lists
  for (const task of sortedTasks) {
    if (!orderedTasks.includes(task)) {
      orderedTasks.push(task);
    }
  }

  for (const taskId of orderedTasks) {
    if (excludeFromScoringTasks.includes(taskId)) continue; // Skip adding this column
    let colField;
    const isOptional = `scores.${taskId}.optional`;

    // Color needs to include a field to allow sorting.
    if (viewMode.value === 'percentile' || viewMode.value === 'color') {
      colField = `scores.${taskId}.percentile`;
    } else if (
      viewMode.value === 'standard' &&
      ((!tasksToDisplayPercentCorrect.includes(taskId) &&
        !tasksToDisplayTotalCorrect.includes(taskId) &&
        !tasksToDisplayGradeEstimate.includes(taskId)) ||
        isTaskNormed(taskId, getScoringVersions.value[taskId]))
    ) {
      colField = `scores.${taskId}.standardScore`;
    } else if (
      viewMode.value === 'raw' &&
      ((!tasksToDisplayCorrectIncorrectDifference.includes(taskId) &&
        !tasksToDisplayPercentCorrect.includes(taskId) &&
        !tasksToDisplayTotalCorrect.includes(taskId) &&
        !tasksToDisplayGradeEstimate.includes(taskId)) ||
        isTaskNormed(taskId, getScoringVersions.value[taskId]))
    ) {
      colField = `scores.${taskId}.rawScore`;
    } else {
      if (tasksToDisplayCorrectIncorrectDifference.includes(taskId) && viewMode.value === 'raw') {
        colField = `scores.${taskId}.rawScore`; // Technically correctIncorrectDifference if unnormed
      } else if (tasksToDisplayTotalCorrect.includes(taskId) && viewMode.value === 'raw') {
        colField = `scores.${taskId}.rawScore`;
      } else if (tasksToDisplayPercentCorrect.includes(taskId) && viewMode.value === 'raw') {
        colField = `scores.${taskId}.percentCorrect`;
      } else if (tasksToDisplayGradeEstimate.includes(taskId) && viewMode.value === 'raw') {
        colField = `scores.${taskId}.rawScore`;
      } else if (rawOnlyTasks.includes(taskId) && viewMode.value === 'raw') {
        colField = `scores.${taskId}.rawScore`;
      } else {
        colField = `scores.${taskId}.percentile`;
      }
    }

    let backgroundColor = '';

    if (
      priorityTasks.includes(taskId) &&
      !priorityTasks.includes(spanishTasks) &&
      !priorityTasks.includes(supplementaryTasks) &&
      !priorityTasks.includes(roamTasks) &&
      !priorityTasks.includes(roavTasks)
    ) {
      backgroundColor = 'transparent';
    } else {
      backgroundColor = '#EEEEF0';
    }

    tableColumns.push({
      field: colField,
      header: tasksDictionary.value[taskId]?.publicName ?? taskId,
      filterField: `scores.${taskId}.tags`,
      dataType: 'score',
      sort: true,
      filter: true,
      sortField: colField ? colField : `scores.${taskId}.percentile`,
      tag: viewMode.value !== 'color',
      emptyTag: viewMode.value === 'color' || isOptional,
      tagColor: `scores.${taskId}.tagColor`,
      style: (() => {
        return `text-align: center; ${getTaskStyle(taskId, backgroundColor, orderedTasks)}`;
      })(),
    });
  }
  return tableColumns;
});

const allTasks = computed(() => {
  if (scoreStudentsData.value?.tasks?.length > 0) {
    return scoreStudentsData.value.tasks.map((task) => task.taskSlug);
  }
  if (administrationData.value?.assessments?.length > 0) {
    return administrationData.value?.assessments?.map((assessment) => assessment.taskId);
  } else return [];
});

const sortedTaskIds = computed(() => {
  if (props.orgType === 'district') {
    if (isLoadingDistrictSupportCategories.value || isFetchingDistrictSupportCategories.value) {
      return [];
    }

    if (!aggregatedDistrictSupportCategories.value) {
      return [];
    }

    const categorizedTasks = Object.keys(aggregatedDistrictSupportCategories.value);
    const assignedTaskIds = administrationData.value?.assessments?.map((a) => a.taskId) || [];

    // Include tasks with data and any assigned normed tasks
    const allTaskIds = new Set(categorizedTasks);

    for (const taskId of assignedTaskIds) {
      if (isTaskNormed(taskId, getScoringVersions.value[taskId])) {
        allTaskIds.add(taskId);
      }
    }

    return Array.from(allTaskIds);
  } else {
    const runsByTaskId = backendScoreReportData.value.runsByTaskId;
    const specialTaskIds = ['swr', 'sre', 'pa', 'phonics'].filter((id) => Object.keys(runsByTaskId).includes(id));
    const remainingTaskIds = Object.keys(runsByTaskId).filter((id) => !specialTaskIds.includes(id));

    remainingTaskIds.sort((p1, p2) => {
      return taskDisplayNames[p1].order - taskDisplayNames[p2].order;
    });

    const sortedIds = specialTaskIds.concat(remainingTaskIds);
    return sortedIds.filter((taskId) => allTasks.value.includes(taskId));
  }
});

const sortedAndFilteredTaskIds = computed(() => {
  return sortedTaskIds.value?.filter((taskId) => {
    if (!tasksToDisplayGraphs.includes(taskId)) return false;
    return isTaskNormed(taskId, getScoringVersions.value[taskId]);
  });
});

const sortedAndFilteredSubscoreTaskIds = computed(() => {
  if (props.orgType === 'district') {
    const districtTasks = sortedAndFilteredTaskIds.value || [];

    // Also include assigned tasks with scoring versions >= 1 that may not be in aggregated categories
    const assignedTaskIds = administrationData.value?.assessments?.map((a) => a.taskId) || [];
    const additionalTasks = assignedTaskIds.filter(
      (taskId) =>
        previouslyUnnormedTasks.includes(taskId) &&
        isTaskNormed(taskId, getScoringVersions.value[taskId]) &&
        !districtTasks.includes(taskId),
    );

    return [...districtTasks, ...additionalTasks].sort((a, b) => taskDisplayNames[a].order - taskDisplayNames[b].order);
  }
  // Show all available subscore tables, including unnormed assessments like roam and phonics
  // Some tasks require a scoring version to be available
  const availableTaskIds = Object.keys(backendScoreReportData.value?.runsByTaskId);
  const filteredTaskIds = availableTaskIds
    .filter((taskId) => {
      if (previouslyUnnormedTasks.includes(taskId)) {
        return getScoringVersions.value[taskId] && getScoringVersions.value[taskId] >= 1;
      }
      return true;
    })
    .sort((a, b) => taskDisplayNames[a].order - taskDisplayNames[b].order);

  return filteredTaskIds;
});

let unsubscribe;
const refresh = () => {
  refreshing.value = true;
  if (unsubscribe) unsubscribe();

  refreshing.value = false;
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig?.()) refresh();
});

onMounted(async () => {
  TaskReport = (await import('@/components/reports/tasks/TaskReport.vue')).default;
  if (roarfirekit.value.restConfig?.()) refresh();
});
</script>

<style lang="scss">
.pdf-export-host {
  position: fixed;
  top: 0;
  left: -10000px;
  pointer-events: none;
}

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

.p-datatable .p-column-header-content {
  display: flex;
  align-items: center;
  text-align: center;
  justify-content: center;
}
</style>
