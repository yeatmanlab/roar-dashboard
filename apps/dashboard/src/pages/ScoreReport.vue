<template>
  <main class="container main">
    <section class="main-body">
      <div>
        <section>
          <div v-if="isLoadingOrgData" class="loading-wrapper">
            <AppSpinner style="margin: 0.3rem 0rem" />
            <div class="text-sm font-light text-gray-600 uppercase">Loading Org Info</div>
          </div>

          <div v-if="orgData && administrationData" id="at-a-glance-charts">
            <div class="flex justify-content-between align-items-center">
              <div class="flex gap-2 flex-column align-items-start">
                <div>
                  <div class="text-xs font-light text-gray-500 uppercase">{{ props.orgType }} Score Report</div>
                  <div class="report-title">
                    {{ _toUpper(orgData?.name) }}
                  </div>
                </div>
                <div>
                  <div class="text-xs font-light text-gray-500 uppercase">Administration</div>
                  <div class="mb-4 administration-name">
                    {{ _toUpper(displayName) }}
                  </div>
                </div>
              </div>
              <div class="flex gap-1 flex-column align-items-end">
                <div class="flex flex-row gap-4 align-items-center" data-html2canvas-ignore="true">
                  <div class="flex flex-row text-sm text-gray-600 uppercase">VIEW</div>
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

                <div v-if="!isLoadingAssignments" class="flex gap-2 mr-5 flex-column">
                  <PvButton
                    class="flex flex-row p-2 text-sm text-white border-none bg-primary border-round h-2rem hover:bg-red-900"
                    :icon="!exportLoading ? 'pi pi-download mr-2' : 'pi pi-spin pi-spinner mr-2'"
                    label="Export Combined Reports"
                    @click="exportData({ includeProgress: true })"
                  />
                  <PvButton
                    class="flex flex-row p-2 mb-2 text-sm text-white border-none bg-primary border-round h-2rem hover:bg-red-900"
                    :icon="!exportLoading ? 'pi pi-download mr-2' : 'pi pi-spin pi-spinner mr-2'"
                    :disabled="exportLoading"
                    label="Export To Pdf"
                    data-html2canvas-ignore="true"
                    @click="handleExportToPdf"
                  />
                </div>
              </div>
            </div>
            <div v-if="isLoadingAssignments" class="loading-wrapper">
              <AppSpinner style="margin: 1rem 0rem" />
              <div class="text-sm font-light text-gray-600 uppercase">Loading Overview Charts</div>
            </div>
            <div v-if="sortedAndFilteredTaskIds?.length > 0" class="py-3 mb-2 text-left bg-gray-100">
              <div class="overview-wrapper">
                <div class="chart-wrapper">
                  <div v-for="taskId of sortedAndFilteredTaskIds" :key="taskId" style="width: 33%">
                    <div class="distribution-overview-wrapper">
                      <DistributionChartOverview
                        :runs="computeAssignmentAndRunData.runsByTaskId[taskId]"
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
                v-if="!isLoadingAssignments && sortedAndFilteredTaskIds?.length > 0"
                class="flex rounded legend-container flex-column align-items-center"
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
                <div class="my-1 text-xs font-light text-gray-500 uppercase">Legend</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Loading data spinner -->
        <div v-if="isLoadingAssignments || isFetchingAssignments" class="my-4 loading-container">
          <AppSpinner style="margin-bottom: 1rem" />
          <span class="text-sm font-light text-gray-600 uppercase">Loading Administration Datatable</span>
        </div>
        <!-- Main table -->

        <div v-if="assignmentData?.length ?? 0 > 0">
          <RoarDataTable
            :data="filteredTableData"
            :columns="scoreReportColumns"
            :total-records="filteredTableData?.length"
            :page-limit="pageLimit"
            :loading="isLoadingAssignments || isFetchingAssignments"
            :groupheaders="true"
            data-cy="roar-data-table"
            @export-all="exportData({ selectedRows: $event })"
            @export-selected="exportData({ selectedRows: $event })"
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
        <div v-if="!isLoadingAssignments" class="legend-container">
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
        <div v-if="isLoadingAssignments || isLoadingTasksDictionary" class="loading-wrapper">
          <AppSpinner style="margin: 1rem 0rem" />
          <div class="text-sm font-light text-gray-600 uppercase">Loading Task Reports</div>
        </div>

        <PvTabView :active-index="activeTabIndex">
          <PvTabPanel
            v-for="taskId of sortedTaskIds"
            :key="taskId"
            :header="tasksDictionary[taskId]?.publicName ?? taskId"
          >
            <div :id="'tab-view-' + taskId">
              <TaskReport
                v-if="taskId"
                :computed-table-data="computeAssignmentAndRunData.assignmentTableData"
                :task-id="taskId"
                :initialized="initialized"
                :administration-id="administrationId"
                :runs="computeAssignmentAndRunData.runsByTaskId[taskId]"
                :org-type="orgType"
                :org-id="orgId"
                :org-info="orgData"
                :administration-info="administrationData"
              />
            </div>
          </PvTabPanel>
        </PvTabView>
        <div id="score-report-closing" class="px-4 py-2 mt-4 bg-gray-200">
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
        <div class="px-4 py-2 mb-7 bg-gray-200">
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
import { computed, ref, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import _toUpper from 'lodash/toUpper';
import _round from 'lodash/round';
import _get from 'lodash/get';
import _map from 'lodash/map';
import _kebabCase from 'lodash/kebabCase';
import _pickBy from 'lodash/pickBy';
import _lowerCase from 'lodash/lowerCase';
import { getGrade } from '@bdelab/roar-utils';
import PvButton from 'primevue/button';
import PvConfirmDialog from 'primevue/confirmdialog';
import PvSelect from 'primevue/select';
import PvSelectButton from 'primevue/selectbutton';
import PvTabPanel from 'primevue/tabpanel';
import PvTabView from 'primevue/tabview';
import { useAuthStore } from '@/store/auth';
import { getDynamicRouterPath } from '@/helpers/getDynamicRouterPath';
import useUserType from '@/composables/useUserType';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import useAdministrationsQuery from '@/composables/queries/useAdministrationsQuery';
import useOrgQuery from '@/composables/queries/useOrgQuery';
import useDistrictSchoolsQuery from '@/composables/queries/useDistrictSchoolsQuery';
import useAdministrationAssignmentsQuery from '@/composables/queries/useAdministrationAssignmentsQuery';
import useTasksDictionaryQuery from '@/composables/queries/useTasksDictionaryQuery';
import { usePermissions } from '@/composables/usePermissions';
import { exportCsv } from '@/helpers/query/utils';
import { getTitle } from '@/helpers/query/administrations';
import {
  taskDisplayNames,
  taskInfoById,
  descriptionsByTaskId,
  supportLevelColors,
  getSupportLevel,
  tasksToDisplayGraphs,
  rawOnlyTasks,
  tasksToDisplayPercentCorrect,
  tasksToDisplayTotalCorrect,
  tasksToDisplayThetaScore,
  excludeFromScoringTasks,
  includeReliabilityFlagsOnExport,
  addElementToPdf,
  getScoreKeys,
  tasksToDisplayCorrectIncorrectDifference,
  includedValidityFlags,
  roamAlpacaSubskills,
  getTagColor,
} from '@/helpers/reports';
import RoarDataTable from '@/components/RoarDataTable';
import { CSV_EXPORT_STATIC_COLUMNS } from '@/constants/csvExport';
import { APP_ROUTES } from '@/constants/routes';
import { SINGULAR_ORG_TYPES } from '@/constants/orgTypes';
import { SCORE_REPORT_NEXT_STEPS_DOCUMENT_PATH } from '@/constants/scores';

const { userCan, Permissions } = usePermissions();

let TaskReport, DistributionChartOverview;

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

const displayName = computed(() => {
  if (administrationData.value) {
    return getTitle(administrationData.value, isSuperAdmin.value);
  }
  return 'Fetching administration name...';
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
    `roar-scores-${_kebabCase(getTitle(administrationData.value, isSuperAdmin.value))}-${_kebabCase(
      orgData.value.name,
    )}.pdf`,
  );
  exportLoading.value = false;
  window.scrollTo(0, 0);

  return;
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
  isLoading: isLoadingAssignments,
  isFetching: isFetchingAssignments,
  data: assignmentData,
} = useAdministrationAssignmentsQuery(props.administrationId, props.orgType, props.orgId, {
  enabled: initialized,
});

const schoolsDictWithGrade = computed(() => {
  return (
    districtSchoolsData.value?.reduce((acc, school) => {
      acc[school.id] = getGrade(school.lowGrade ?? 0) + ' ' + school.name;
      return acc;
    }, {}) || {}
  );
});

const schoolNameDictionary = computed(() => {
  return (
    districtSchoolsData.value?.reduce((acc, school) => {
      acc[school.id] = school.name;
      return acc;
    }, {}) || {}
  );
});

// Return a faded color if assessment is not reliable
function returnColorByReliability(assessment, rawScore, support_level, tag_color) {
  if (assessment.reliable !== undefined && !assessment.reliable && assessment.engagementFlags !== undefined) {
    const engagementFlagExists = Object.keys(assessment.engagementFlags).some((flag) =>
      includedValidityFlags[assessment.taskId]?.includes(flag),
    );
    if (support_level === 'Optional') {
      return '#a1d8e3';
    } else if (support_level === 'Needs Extra Support' && engagementFlagExists) {
      return '#d6b8c7';
    } else if (support_level === 'Developing Skill' && engagementFlagExists) {
      return '#e8dbb5';
    } else if (support_level === 'Achieved Skill' && engagementFlagExists) {
      return '#c0d9bd';
    } else if (
      tasksToDisplayCorrectIncorrectDifference.includes(assessment.taskId) ||
      tasksToDisplayPercentCorrect.includes(assessment.taskId)
    ) {
      const test = assessment.scores?.raw?.composite?.test;
      if (
        (test?.numCorrect === undefined && test?.percentCorrect === undefined) ||
        (test?.numAttempted === 0 && test?.numCorrect === 0)
      ) {
        return '#EEEEF0';
      }
      return '#A4DDED';
    } else if (tasksToDisplayTotalCorrect.includes(assessment.taskId)) {
      const test = assessment.scores?.raw?.composite?.test;
      if (test?.numAttempted === 0 || test?.numAttempted === undefined) {
        return '#EEEEF0';
      } else {
        return '#A4DDED';
      }
    } else if (tasksToDisplayThetaScore.includes(assessment.taskId)) {
      const test = assessment.scores?.raw?.composite?.test;
      if (test?.thetaEstimate === undefined || test?.thetaEstimate === '') {
        return '#EEEEF0';
      } else {
        return '#A4DDED';
      }
    } else if (rawOnlyTasks.includes(assessment.taskId) && rawScore) {
      return 'white';
    }
  }
  return tag_color;
}

const getScoresAndSupportFromAssessment = ({
  grade,
  assessment,
  standardScoreDisplayKey,
  percentileScoreKey,
  percentileScoreDisplayKey,
  rawScoreKey,
  taskId,
  optional,
}) => {
  let support_level;
  let tag_color;
  let percentile = _get(assessment, `scores.computed.composite.${percentileScoreKey}`);
  let percentileString = _get(assessment, `scores.computed.composite.${percentileScoreDisplayKey}`);
  let standardScore = _get(assessment, `scores.computed.composite.${standardScoreDisplayKey}`);
  let rawScore = _get(assessment, `scores.computed.composite.${rawScoreKey}`);

  if (
    tasksToDisplayCorrectIncorrectDifference.includes(assessment.taskId) ||
    tasksToDisplayPercentCorrect.includes(assessment.taskId) ||
    tasksToDisplayTotalCorrect.includes(taskId) ||
    tasksToDisplayThetaScore.includes(assessment.taskId)
  ) {
    if (assessment.scores === undefined) {
      support_level = null;
      tag_color = null;
    } else {
      support_level = '';
      tag_color = '#A4DDED';
    }
  } else {
    ({ support_level, tag_color } = getSupportLevel(grade, percentile, rawScore, taskId, optional));
  }

  if (percentile) percentile = _round(percentile);
  if (percentileString && !isNaN(_round(percentileString))) percentileString = _round(percentileString);

  return {
    support_level,
    tag_color,
    percentile,
    percentileString,
    standardScore,
    rawScore,
  };
};

const computedProgressData = computed(() => {
  if (!assignmentData.value) return [];
  return assignmentData.value.map(({ assignment }) => {
    const progress = assignment.assessments.reduce((acc, assessment) => {
      const status = assessment.optional
        ? 'optional'
        : assessment.completedOn
          ? 'completed'
          : assessment.startedOn
            ? 'started'
            : 'assigned';

      acc[assessment.taskId] = { value: status };
      return acc;
    }, {});
    return {
      userPid: assignment.userData?.assessmentPid, // Assuming user contains a `username` property
      progress,
    };
  });
});

// This function takes in the return from assignmentFetchAll and returns 2 objects
// 1. assignmentTableData: The data that should be passed into the ROARDataTable component
// 2. runsByTaskId: run data for the TaskReport distribution chartsb
const computeAssignmentAndRunData = computed(() => {
  if (!assignmentData.value || assignmentData.value.length === 0) {
    return { assignmentTableData: [], runsByTaskId: {} };
  } else {
    // assignmentTableData is an array of objects, each representing a row in the table
    const assignmentTableDataAcc = [];
    // runsByTaskId is an object with keys as taskIds and values as arrays of scores
    const runsByTaskIdAcc = {};
    for (const { assignment, user } of assignmentData.value) {
      // for each row, compute: username, firstName, lastName, assessmentPID, grade, school, all the scores, and routeParams for report link
      const grade = String(assignment.userData?.grade);
      // compute schoolName. Use the schoolId from the assignment's assigningOrgs, as this should be correct even when the
      //   user is unenrolled. The assigningOrgs should be up to date and persistant. Fallback to the student's current schools.
      let schoolName = '';
      const assigningSchool = assignment?.assigningOrgs?.schools;
      const schoolId = assigningSchool[0] ?? user?.schools?.current[0];
      if (schoolId) {
        schoolName = schoolNameDictionary.value[schoolId];
      }

      const firstName = user.name?.first;
      const lastName = user.name?.last;
      const username = user.username;

      const firstNameOrUsername = firstName ?? username;

      const currRow = {
        user: {
          username: username,
          email: user.email,
          userId: user.userId,
          firstName: firstName,
          lastName: lastName,
          grade: grade,
          assessmentPid: user.assessmentPid,
          schoolName: schoolName,
          stateId: user.studentData?.state_id,
          studentId: user.studentData?.student_number,
        },
        tooltip: `View ${firstNameOrUsername}'s Score Report`,
        launchTooltip: `View assessment portal for ${firstNameOrUsername}`,
        routeParams: {
          administrationId: props.administrationId,
          orgId: props.orgId,
          orgType: props.orgType,
          userId: user.userId,
        },
        compositeScore: assignment.compositeScore ?? null,
        startDate:
          assignment.assessments.reduce((earliest, assessment) => {
            if (!earliest) return assessment.startedOn;
            return assessment.startedOn < earliest ? assessment.startedOn : earliest;
          }, null) ?? null,
        completionDate: assignment.completed
          ? (assignment.assessments.reduce((latest, assessment) => {
              if (!latest) return assessment.completedOn;
              return assessment.completedOn > latest ? assessment.completedOn : latest;
            }, null) ?? null)
          : null,
        // compute and add scores data in next step as so
        // swr: { support_level: 'Needs Extra Support', percentile: 10, raw: 10, reliable: true, engagementFlags: {}},
      };

      let numAssessmentsCompleted = 0;
      const currRowScores = {};
      for (const assessment of assignment.assessments) {
        // General Logic to grab support level, scores, etc
        let scoreFilterTags = '';
        const taskId = assessment.taskId;
        const isOptional = assessment.optional;
        if (isOptional) {
          scoreFilterTags += ' Optional ';
        } else {
          scoreFilterTags += ' Required ';
        }
        if (assessment.reliable == true) {
          scoreFilterTags += ' Reliable ';
        } else {
          scoreFilterTags += ' Unreliable ';
        }
        // Add filter tags for completed/incomplete
        if (assessment.completedOn != undefined) {
          numAssessmentsCompleted += 1;
          scoreFilterTags += ' Completed ';
        } else if (assessment.startedOn != undefined) {
          scoreFilterTags += ' Started ';
        } else {
          scoreFilterTags += ' Assigned ';
        }
        // Add filter tags for assessed (what is this?)
        if (typeof assessment?.scores?.computed?.composite == 'number') {
          scoreFilterTags += ' Assessed ';
        }

        const { percentileScoreKey, rawScoreKey, percentileScoreDisplayKey, standardScoreDisplayKey } =
          getScoreKeysByRow(assessment, getGrade(grade));
        // compute and add scores data in next step as so
        const { support_level, tag_color, percentile, percentileString, standardScore, rawScore } =
          getScoresAndSupportFromAssessment({
            grade,
            assessment,
            percentileScoreKey,
            percentileScoreDisplayKey,
            standardScoreDisplayKey,
            rawScoreKey,
            taskId,
            isOptional,
          });

        if (tag_color === supportLevelColors.above) {
          scoreFilterTags += ' Green ';
        } else if (tag_color === supportLevelColors.some) {
          scoreFilterTags += ' Yellow ';
        } else if (tag_color === supportLevelColors.below) {
          scoreFilterTags += ' Pink ';
        }

        const tagColor = returnColorByReliability(assessment, rawScore, support_level, tag_color);

        // Logic to update assignmentTableDataAcc
        currRowScores[taskId] = {
          optional: isOptional,
          supportLevel: support_level,
          reliable: assessment.reliable,
          engagementFlags: assessment.engagementFlags ?? [],
          tagColor: tagColor,
          percentile: percentile,
          percentileString: percentileString,
          rawScore: rawScore,
          standardScore: standardScore,
          tags: scoreFilterTags,
        };

        if (tasksToDisplayCorrectIncorrectDifference.includes(taskId)) {
          const numCorrect = assessment.scores?.raw?.composite?.test?.numCorrect;
          const numIncorrect = assessment.scores?.raw?.composite?.test?.numAttempted - numCorrect;
          currRowScores[taskId].correctIncorrectDifference =
            numCorrect != null && numIncorrect != null ? Math.round(numCorrect - numIncorrect) : null;
          currRowScores[taskId].numCorrect = numCorrect;
          currRowScores[taskId].numIncorrect = numIncorrect;
          currRowScores[taskId].tagColor = tagColor;
          scoreFilterTags += ' Assessed ';
        } else if (tasksToDisplayPercentCorrect.includes(taskId)) {
          const numAttempted = assessment.scores?.raw?.composite?.test?.numAttempted;
          const numCorrect = assessment.scores?.raw?.composite?.test?.numCorrect;
          const percentCorrect =
            numAttempted > 0 && !isNaN(numCorrect) && !isNaN(numAttempted)
              ? Math.round((numCorrect * 100) / numAttempted).toString() + '%'
              : null;
          currRowScores[taskId].percentCorrect = percentCorrect;
          currRowScores[taskId].numAttempted = numAttempted;
          currRowScores[taskId].numCorrect = numCorrect;
          currRowScores[taskId].tagColor = percentCorrect === null ? 'transparent' : tagColor;
          scoreFilterTags += ' Assessed ';
        } else if (tasksToDisplayTotalCorrect.includes(taskId)) {
          const numAttempted = assessment.scores?.raw?.composite?.test?.numAttempted;
          const numCorrect =
            numAttempted === undefined || numAttempted === 0
              ? ''
              : numAttempted !== 0 && assessment.scores?.raw?.composite?.test?.numCorrect !== undefined
                ? assessment.scores?.raw?.composite?.test?.numCorrect
                : 0;
          currRowScores[taskId].numAttempted = numAttempted;
          currRowScores[taskId].numCorrect = numCorrect;
          currRowScores[taskId].tagColor =
            numAttempted === undefined || numAttempted === 0 ? '#EEEEF0' : numAttempted !== 0 ? tagColor : '#EEEEF0';
          scoreFilterTags += ' Assessed ';
        }
        if ((taskId === 'letter' || taskId === 'letter-en-ca') && assessment.scores) {
          currRowScores[taskId].lowerCaseScore = assessment.scores.computed.LowercaseNames?.subScore;
          currRowScores[taskId].upperCaseScore = assessment.scores.computed.UppercaseNames?.subScore;
          currRowScores[taskId].phonemeScore = assessment.scores.computed.Phonemes?.subScore;
          currRowScores[taskId].totalScore = assessment.scores.computed.composite?.totalCorrect;
          const incorrectLettersArray = [
            ...(_get(assessment, 'scores.computed.UppercaseNames.upperIncorrect') ?? '').split(','),
            ...(_get(assessment, 'scores.computed.LowercaseNames.lowerIncorrect') ?? '').split(','),
          ]
            .sort((a, b) => _toUpper(a) - _toUpper(b))
            .filter(Boolean)
            .join(', ');
          currRowScores[taskId].incorrectLetters = incorrectLettersArray.length > 0 ? incorrectLettersArray : 'None';

          const incorrectPhonemesArray = (_get(assessment, 'scores.computed.Phonemes.phonemeIncorrect') ?? '')
            .split(',')
            .join(', ');
          currRowScores[taskId].incorrectPhonemes = incorrectPhonemesArray.length > 0 ? incorrectPhonemesArray : 'None';
        }
        if (taskId === 'pa' && assessment.scores) {
          const first = _get(assessment, 'scores.computed.FSM.roarScore');
          const last = _get(assessment, 'scores.computed.LSM.roarScore');
          const deletion = _get(assessment, 'scores.computed.DEL.roarScore');
          let skills = [];
          if (first < 15) skills.push('First Sound Matching');
          if (last < 15) skills.push('Last sound matching');
          if (deletion < 15) skills.push('Deletion');
          currRowScores[taskId].firstSound = first;
          currRowScores[taskId].lastSound = last;
          currRowScores[taskId].deletion = deletion;
          currRowScores[taskId].total = _get(assessment, 'scores.computed.composite.roarScore');
          currRowScores[taskId].skills = skills.length > 0 ? skills.join(', ') : 'None';
        }
        if (tasksToDisplayThetaScore.includes(taskId)) {
          const numCorrect = assessment.scores?.raw?.composite?.test?.numCorrect;
          const numIncorrect = assessment.scores?.raw?.composite?.test?.numIncorrect;
          const thetaEstimate = _get(assessment, 'scores.computed.composite.thetaEstimate') ?? '';

          currRowScores[taskId].numCorrect = numCorrect;
          currRowScores[taskId].numIncorrect = numIncorrect;
          currRowScores[taskId].thetaEstimate = thetaEstimate;
        }
        if (['fluency-calf', 'fluency-arf', 'fluency-calf-es', 'fluency-arf-es'].includes(taskId)) {
          const fc = _get(assessment, 'scores.computed.FC.roamScore');
          const fr = _get(assessment, 'scores.computed.FR.roamScore');

          currRowScores[taskId].fc = fc;
          currRowScores[taskId].fr = fr;
        }

        if (taskId === 'roam-alpaca') {
          const scores = _get(assessment, 'scores.computed');
          if (scores) {
            Object.keys(roamAlpacaSubskills).forEach((subskill) => {
              const subskillInfo = _get(scores, subskill);
              if (subskillInfo) {
                const score = `${_round((subskillInfo.rawScore / subskillInfo.totalNumAttempted) * 100)}%`;
                // roam-alpaca calculates and returns support level automatically
                let tagColor = getTagColor(subskillInfo.supportCategory);
                currRowScores[taskId][subskill] = {
                  score,
                  tagColor: returnColorByReliability(
                    assessment,
                    subskillInfo.rawScore,
                    subskillInfo.supportCategory,
                    tagColor,
                  ),
                  ...subskillInfo,
                };
              } else {
                currRowScores[taskId][subskill] = '-';
              }
            });
            currRowScores[taskId].composite = {
              ...scores.composite,
              tagColor: getTagColor(scores.composite.supportCategory),
            };
          }
        }

        // Logic to update runsByTaskIdAcc
        const run = {
          // A bit of a workaround to properly sort grades in facetted graphs (changes Kindergarten to grade 0)
          grade: getGrade(grade),
          scores: {
            support_level: support_level,
            stdPercentile: percentile,
            rawScore: rawScore,
          },
          taskId,
          user: {
            grade,
            schoolName: schoolsDictWithGrade.value[schoolId] ?? '0 Unknown School',
          },
          tag_color: tag_color,
        };

        if (run.taskId in runsByTaskIdAcc) {
          runsByTaskIdAcc[run.taskId].push(run);
        } else {
          runsByTaskIdAcc[run.taskId] = [run];
        }
      }

      // update scores for current row with computed object
      currRow.scores = currRowScores;
      currRow.numAssessmentsCompleted = numAssessmentsCompleted;
      // push currRow to assignmentTableDataAcc
      assignmentTableDataAcc.push(currRow);
    }

    // sort by numAssessmentsCompleted
    assignmentTableDataAcc.sort((a, b) => {
      const completionDiff = b.numAssessmentsCompleted - a.numAssessmentsCompleted;
      if (completionDiff !== 0) {
        return completionDiff;
      }

      const schoolDiff = (a.user?.schoolName ?? '').localeCompare(b.user?.schoolName ?? '');
      if (schoolDiff !== 0) {
        return schoolDiff;
      }

      const gradeDiff = Number(a.user.grade) - Number(b.user.grade);
      if (isNaN(gradeDiff)) {
        const gradeA = a.user?.grade?.toString() ?? '';
        const gradeB = b.user?.grade?.toString() ?? '';
        const stringGradeDiff = gradeA.localeCompare(gradeB);
        if (stringGradeDiff !== 0) {
          return stringGradeDiff;
        }
      } else if (gradeDiff !== 0) {
        return gradeDiff;
      }

      const lastNameDiff = (a.user?.lastName ?? '').localeCompare(b.user?.lastName ?? '');
      return lastNameDiff;
    });

    const filteredRunsByTaskId = _pickBy(runsByTaskIdAcc, (scores, taskId) => {
      return Object.keys(taskInfoById).includes(taskId);
    });

    // We only want to display the ROAM Tasks if the recruitment param is responseModality
    // Otherwise, remove them from the runsByTaskId object to prevent including them in TaskReports.
    const assessments = administrationData.value.assessments;
    for (const assessment of assessments) {
      if (['fluency-calf', 'fluency-arf', 'fluency-calf-es', 'fluency-arf-es'].includes(assessment.taskId)) {
        const recruitment = assessment?.params?.recruitment;
        if (recruitment !== 'responseModality') {
          delete filteredRunsByTaskId[assessment.taskId];
        }
      }
    }

    return { runsByTaskId: filteredRunsByTaskId, assignmentTableData: assignmentTableDataAcc };
  }
});

// This composable manages the data which is passed into the FilterBar component slot for filtering
const filteredTableData = ref([]);

watch(
  computeAssignmentAndRunData,
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

    if (props.orgType === 'district') {
      tableRow['School'] = user?.schoolName;
    }

    // if org is from clever, include stateId
    // if (orgData.value?.clever === true) {
    tableRow['State ID'] = user.stateId;
    tableRow['Student ID'] = user.studentId;
    // }

    for (const taskId in scores) {
      const score = scores[taskId];
      const taskName = tasksDictionary.value[taskId]?.publicName ?? taskId;

      // Add task-specific score information
      if (tasksToDisplayPercentCorrect.includes(taskId)) {
        tableRow[`${taskName} - Percent Correct`] = score.percentCorrect;
        tableRow[`${taskName} - Num Attempted`] = score.numAttempted;
        tableRow[`${taskName} - Num Correct`] = score.numCorrect;
      } else if (tasksToDisplayCorrectIncorrectDifference.includes(taskId)) {
        tableRow[`${taskName} - Correct/Incorrect Difference`] = score.correctIncorrectDifference;
        tableRow[`${taskName} - Num Incorrect`] = score.numIncorrect;
        tableRow[`${taskName} - Num Correct`] = score.numCorrect;
      } else if (tasksToDisplayTotalCorrect.includes(taskId)) {
        tableRow[`${taskName} - Num Correct`] = score.numCorrect;
        tableRow[`${taskName} - Num Attempted`] = score.numAttempted;
      } else if (rawOnlyTasks.includes(taskId)) {
        tableRow[`${taskName} - Raw`] = score.rawScore;
      } else if (tasksToDisplayThetaScore.includes(taskId)) {
        tableRow[`${taskName} - Num Correct`] = score.numCorrect;
        tableRow[`${taskName} - Num Incorrect`] = score.numIncorrect;
        tableRow[`${taskName} - Grade Estimate`] = score.thetaEstimate;
      } else {
        tableRow[`${taskName} - Percentile`] = score.percentileString;
        tableRow[`${taskName} - Standard`] = score.standardScore;
        tableRow[`${taskName} - Raw`] = score.rawScore;
        tableRow[`${taskName} - Support Level`] = score.supportLevel;
      }

      // Add reliability information
      if (score.reliable !== undefined && !score.reliable && score.engagementFlags !== undefined) {
        const engagementFlags = Object.keys(score.engagementFlags);
        if (engagementFlags.length > 0) {
          if (includedValidityFlags[taskId]) {
            const filteredFlags = Object.keys(score.engagementFlags).filter((flag) =>
              includedValidityFlags[taskId].includes(flag),
            );
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
        const progressRow = computedProgressData.value.find((progress) => progress.userPid === user?.assessmentPid);

        if (progressRow) {
          scoreReportColumns.value.forEach((column) => {
            const { field, header: taskName } = column; // Use taskName from the column header

            // Ensure field is defined and is a string before calling startsWith
            if (typeof field === 'string' && field.startsWith('scores')) {
              const scoreKey = field.split('.').slice(-2, -1)[0]; // Extract taskId (e.g., "swr", "sre", etc.)

              // Check if taskId exists in progressRow.progress
              if (progressRow.progress[scoreKey]) {
                tableRow[`${taskName} - Progress`] = progressRow.progress[scoreKey].value;
              } else {
                tableRow[`${taskName} - Progress`] = 'not assigned';
              }
            }
          });
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
  const rows = selectedRows || computeAssignmentAndRunData.value.assignmentTableData;
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
};

function getScoreKeysByRow(row, grade) {
  const taskId = row?.taskId;
  return getScoreKeys(taskId, grade);
}

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
  if (isLoadingTasksDictionary.value || assignmentData.value === undefined) return [];
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
  if (assignmentData.value.find((assignment) => assignment.user?.name?.last)) {
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
      multiSelectOptions: districtSchoolsData.value.map((school) => school.name),
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

  tableColumns.push({
    field: 'user.studentId',
    header: 'Student ID',
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
  if (userCan(Permissions.Reports.Score.READ_COMPOSITE)) {
    tableColumns.push({
      field: 'compositeScore',
      header: 'Composite Score',
      dataType: 'text',
      sort: true,
      hidden: true,
      headerStyle: `background:var(--primary-color); color:white; padding-top:0; margin-top:0; padding-bottom:0; margin-bottom:0; border:0; margin-left:0; border-right-width:2px; border-right-style:solid; border-right-color:#ffffff;`,
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
      !tasksToDisplayCorrectIncorrectDifference.includes(taskId) &&
      !tasksToDisplayPercentCorrect.includes(taskId) &&
      !tasksToDisplayTotalCorrect.includes(taskId) &&
      !tasksToDisplayThetaScore.includes(taskId)
    ) {
      colField = `scores.${taskId}.standardScore`;
    } else if (
      viewMode.value === 'raw' &&
      !tasksToDisplayCorrectIncorrectDifference.includes(taskId) &&
      !tasksToDisplayPercentCorrect.includes(taskId) &&
      !tasksToDisplayTotalCorrect.includes(taskId) &&
      !tasksToDisplayThetaScore.includes(taskId)
    ) {
      colField = `scores.${taskId}.rawScore`;
    } else {
      if (tasksToDisplayCorrectIncorrectDifference.includes(taskId) && viewMode.value === 'raw') {
        colField = `scores.${taskId}.correctIncorrectDifference`;
      } else if (tasksToDisplayTotalCorrect.includes(taskId) && viewMode.value === 'raw') {
        colField = `scores.${taskId}.numCorrect`;
      } else if (tasksToDisplayPercentCorrect.includes(taskId) && viewMode.value === 'raw') {
        colField = `scores.${taskId}.percentCorrect`;
      } else if (tasksToDisplayThetaScore.includes(taskId) && viewMode.value === 'raw') {
        colField = `scores.${taskId}.numCorrect`;
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
  if (administrationData.value?.assessments?.length > 0) {
    return administrationData.value?.assessments?.map((assessment) => assessment.taskId);
  } else return [];
});

const sortedTaskIds = computed(() => {
  const runsByTaskId = computeAssignmentAndRunData.value.runsByTaskId;
  const specialTaskIds = ['swr', 'sre', 'pa'].filter((id) => Object.keys(runsByTaskId).includes(id));
  const remainingTaskIds = Object.keys(runsByTaskId).filter((id) => !specialTaskIds.includes(id));

  remainingTaskIds.sort((p1, p2) => {
    return taskDisplayNames[p1].order - taskDisplayNames[p2].order;
  });

  const sortedIds = specialTaskIds.concat(remainingTaskIds);
  return sortedIds.filter((taskId) => allTasks.value.includes(taskId));
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
  if (state.roarfirekit.restConfig?.()) refresh();
});

onMounted(async () => {
  TaskReport = (await import('@/components/reports/tasks/TaskReport.vue')).default;
  DistributionChartOverview = (await import('@/components/reports/DistributionChartOverview.vue')).default;
  if (roarfirekit.value.restConfig?.()) refresh();
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

.p-datatable .p-column-header-content {
  display: flex;
  align-items: center;
  text-align: center;
  justify-content: center;
}
</style>
