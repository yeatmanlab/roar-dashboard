<template>
  <div>
    <div v-if="isLoading" class="flex flex-column justify-content-center align-items-center">
      <AppSpinner class="mb-4" />
      <span>{{ $t('scoreReports.loading') }}</span>
    </div>

    <template v-else>
      <div v-if="isPrintMode" data-pdf-export-container>
        <HeaderPrint
          :student-first-name="studentFirstName"
          :student-last-name="studentLastName"
          :student-grade="studentGrade"
          :administration-name="administrationData?.name"
          :administration-date="administrationData?.date"
        />

        <template v-if="!taskData?.length">
          <EmptyState :student-first-name="studentFirstName" />
        </template>

        <template v-else>
          <SummaryPrint
            :student-first-name="studentFirstName"
            :tasks="tasksListArray"
            :expanded="expanded"
            :export-loading="exportLoading"
          />

          <SupportPrint
            :student-grade="studentGrade"
            :distribution-chart-path="distributionChartPath"
            :is-distribution-chart-enabled="isDistributionChartEnabled"
          />

          <ScoreListPrint
            :student-first-name="studentFirstName"
            :student-grade="studentGrade"
            :report-tasks="reportTasks"
            :tasks-dictionary="tasksDictionary"
            :current-assignment-id="administrationId"
            :task-scoring-versions="getScoringVersions"
          />
        </template>
      </div>

      <template v-else>
        <HeaderScreen
          :student-first-name="studentFirstName"
          :student-last-name="studentLastName"
          :student-grade="studentGrade"
          :administration-name="administrationData?.name"
          :administration-date="administrationData?.date"
          :expanded="expanded"
          :export-loading="exportLoading"
          @toggle-expand="toggleExpand"
          @export-pdf="handleExportToPdf"
        />

        <template v-if="!taskData?.length">
          <EmptyState :student-first-name="studentFirstName" />
        </template>

        <template v-else>
          <SummaryScreen :student-first-name="studentFirstName" :tasks="tasksListArray" />

          <ScoreListScreen
            :student-first-name="studentFirstName"
            :student-grade="studentGrade"
            :report-tasks="reportTasks"
            :tasks-dictionary="tasksDictionary"
            :expanded="expanded"
            :task-scoring-versions="getScoringVersions"
            :current-assignment-id="administrationId"
          />

          <SupportScreen
            :expanded="expanded"
            :student-grade="studentGrade"
            :distribution-chart-path="distributionChartPath"
            :is-distribution-chart-enabled="isDistributionChartEnabled"
          />
        </template>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch, nextTick, toValue } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { useI18n } from 'vue-i18n';
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import useAdministrationsQuery from '@/composables/queries/useAdministrationsQuery';
import useAdministrationIndividualScoreReportQuery from '@/composables/queries/useAdministrationIndividualScoreReportQuery';
import useGuardianStudentReportQuery from '@/composables/queries/useGuardianStudentReportQuery';
import useTasksDictionaryQuery from '@/composables/queries/useTasksDictionaryQuery';
import usePagedPreview from '@/composables/usePagedPreview';
import PdfExportService from '@/services/PdfExport.service';
import { taskDisplayNames, getDistributionChartPath, updatedNormVersions } from '@/helpers/reports';

import AppSpinner from '@/components/AppSpinner.vue';
import { HeaderScreen, HeaderPrint } from './components/Header';
import { SummaryScreen, SummaryPrint } from './components/Summary';
import { ScoreListScreen, ScoreListPrint } from './components/ScoreList';
import { SupportScreen, SupportPrint } from './components/Support';
import EmptyState from './components/EmptyState.vue';
import { getStudentDisplayName } from '@/helpers/getStudentDisplayName';
import { formatListArray } from '@/helpers/formatListArray';
import { getStudentExternalId } from '@/helpers/getStudentExternalId';
import { STUDENT_SCORE_REPORT_TASK_IDS } from '@/constants/studentScoreReportTasks';
import { SINGULAR_ORG_TYPES } from '@/constants/orgTypes';

const props = defineProps({
  administrationId: { type: String, required: true },
  userId: { type: String, required: true },
  orgType: { type: String, required: true },
  orgId: { type: String, required: true },
});

const authStore = useAuthStore();
const route = useRoute();

const isPrintMode = computed(() => route.query.print !== undefined);

// Two routes into this container use different backend endpoints: the parent/guardian path
// (orgType 'family') uses the longitudinal guardian report; the administrator path (org
// scopes) uses the administration-scoped individual report.
const isParentPath = computed(() => props.orgType === SINGULAR_ORG_TYPES.FAMILIES);

const expanded = ref(false);
const exportLoading = ref(false);

const initialized = ref(false);
const isLoading = computed(
  () =>
    isLoadingStudentData.value ||
    isLoadingTasksDictionary.value ||
    isLoadingReport.value ||
    isLoadingGuardian.value ||
    isLoadingAdministrationData.value,
);

const { data: studentData, isLoading: isLoadingStudentData } = useUserDataQuery(props.userId, {
  enabled: initialized,
});

const { data: administrationData, isLoading: isLoadingAdministrationData } = useAdministrationsQuery(
  [props.administrationId],
  {
    enabled: initialized,
    select: (data) => data[0],
  },
);

// Administrator path: administration-scoped individual report (scores, support level, tags,
// subscores, per-task historical scores).
const { data: reportData, isLoading: isLoadingReport } = useAdministrationIndividualScoreReportQuery(
  props.administrationId,
  props.userId,
  props.orgType,
  props.orgId,
  { enabled: computed(() => initialized.value && !isParentPath.value) },
);

// Parent/guardian path: longitudinal report across all administrations.
const { data: guardianData, isLoading: isLoadingGuardian } = useGuardianStudentReportQuery(props.userId, {
  enabled: computed(() => initialized.value && isParentPath.value),
});

// The guardian report returns every administration plus a top-level longitudinalScores map.
// Pick the administration being viewed and attach its per-task historical scores so the
// guardian tasks match the admin report's per-task shape (which carries historicalScores).
const guardianReportTasks = computed(() => {
  const data = guardianData.value;
  if (!data) return [];
  const administration = data.administrations.find((entry) => entry.administrationId === props.administrationId);
  if (!administration) return [];
  return administration.tasks.map((task) => ({
    ...task,
    historicalScores: data.longitudinalScores?.[task.taskSlug] ?? [],
  }));
});

// Both paths feed the score cards from the backend; the score list builds its cards from
// these report tasks (see useReportCardData).
const reportTasks = computed(() => (isParentPath.value ? guardianReportTasks.value : (reportData.value?.tasks ?? [])));

// Minimal { taskId(slug), scores } shape the container's summary/distribution computeds and
// the empty-state read, derived from the same backend report tasks (scores present only when
// completed — the distribution/empty-state consumers key off score presence).
const taskData = computed(() =>
  reportTasks.value.map((task) => ({ taskId: task.taskSlug, scores: task.completed ? task.scores : undefined })),
);

const { data: tasksDictionary, isLoading: isLoadingTasksDictionary } = useTasksDictionaryQuery({
  enabled: initialized,
});

const tasks = computed(
  () =>
    taskData?.value
      ?.map((assignment) => assignment.taskId)
      .filter((t) => {
        if (!STUDENT_SCORE_REPORT_TASK_IDS.includes(t)) return false;
        if (t === 'swr-es' || t === 'sre-es') return getScoringVersions.value[t] >= 1;
        return true;
      }) || [],
);

const tasksListArray = computed(() =>
  formatListArray(tasks.value, tasksDictionary.value, (task, entry) => entry?.nameSimple ?? task, {
    orderLookup: Object.entries(taskDisplayNames).reduce((acc, [key, value]) => {
      acc[key] = value.order;
      return acc;
    }, {}),
    suffix: '.',
  }),
);

const studentFirstName = computed(() => getStudentDisplayName(studentData).firstName);
const studentLastName = computed(() => getStudentDisplayName(studentData).lastName);
const studentGrade = computed(() => toValue(studentData)?.studentData?.grade);
const getScoringVersions = computed(() => {
  const scoringVersions = Object.fromEntries(
    administrationData.value?.assessments.map((assessment) => [
      assessment.taskId,
      assessment?.params?.scoringVersion ?? null,
    ]),
  );
  return scoringVersions;
});

const { locale } = useI18n();

const distributionChartPath = computed(() => {
  const language = locale.value.includes('es') ? 'es' : 'en';
  const completedTasks = Object.values(taskData.value)
    .filter((task) => task.scores)
    .map((task) => task.taskId);

  const scoringVersions = Object.fromEntries(
    completedTasks.map((taskId) => [taskId, getScoringVersions.value[taskId]]),
  );

  return getDistributionChartPath(studentGrade.value, scoringVersions, language);
});

// Only show the distribution chart if there are completed normed tasks
// Spanish tasks (sre-es, swr-es) must also have a non-null scoring version
const isDistributionChartEnabled = computed(() => {
  const normedTaskIds = Object.keys(updatedNormVersions);
  return Object.values(taskData.value).some((task) => {
    // Must have scores and be a normed task
    if (!task.scores || !normedTaskIds.includes(task.taskId)) return false;

    // Spanish tasks require a non-null scoring version
    if (task.taskId === 'sre-es' || task.taskId === 'swr-es') {
      return getScoringVersions.value[task.taskId] >= 1;
    }

    // All other normed tasks just need scores
    return true;
  });
});

/**
 * Controls the expanded state of the report cards
 */
const setExpanded = (isExpanded) => {
  if (expanded.value !== isExpanded) {
    expanded.value = isExpanded;
  }
};

/**
 * Toggles the expanded state of the report cards
 */
const toggleExpand = () => setExpanded(!expanded.value);

/**
 * Controls the iframe postMessage
 */
let hasMessageBeenSent = false;

const sendPageLoadedMessage = async () => {
  if (hasMessageBeenSent || window.parent === window) return;
  await nextTick();
  if (!isLoading.value) {
    hasMessageBeenSent = true;
    window.parent.postMessage({ type: 'page:loaded', timestamp: Date.now() }, window.parent.location.origin);
  }
};

const { run: runPaged, clear: clearPaged } = usePagedPreview({
  onRendered: () => {
    sendPageLoadedMessage();
  },
});

/**
 * Handles the export to PDF
 */
const handleExportToPdf = async () => {
  const studentName = `${studentFirstName.value}${studentLastName.value ? studentLastName.value : ''}`;
  const studentDataValue = toValue(studentData);
  // Align to how user data is set in ScoreReport.vue
  const studentDataIds = {
    sisId: studentDataValue?.sisId ?? studentDataValue?.studentData?.sis_id,
    studentId: studentDataValue?.studentData?.student_number,
    stateId: studentDataValue?.studentData?.state_id,
  };
  const fileName = `ROAR-IndividualScoreReport-${studentName}${getStudentExternalId(studentDataIds)}.pdf`;

  exportLoading.value = true;
  try {
    // Always render the print view in an offscreen iframe for consistent export
    const url = `${window.location.origin}/scores/${props.administrationId}/${props.orgType}/${props.orgId}/user/${props.userId}?print=true`;
    await PdfExportService.generateSingleDocument(url, fileName, {
      containerSelector: '[data-pdf-export-container]',
    });
  } catch (error) {
    console.error('Error exporting to PDF:', error);
  } finally {
    exportLoading.value = false;
  }
};

// Initialization
const refreshing = ref(false);
let unsubscribe;

const refresh = async () => {
  if (refreshing.value) return;
  refreshing.value = true;
  initialized.value = true;
  refreshing.value = false;
};

watch([isLoading, isPrintMode], ([loading, print]) => {
  if (!loading && print) runPaged();
});

onMounted(() => {
  unsubscribe = authStore.$subscribe(async (mutation, state) => {
    if (state.accessToken) refresh();
  });
  refresh();
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
  clearPaged();
});

// Vite HMR: cleanup paged output when this module is replaced during print view development
if (import.meta && import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (isPrintMode.value) {
      clearPaged();
      runPaged();
    }
  });
}
</script>

<style>
.pagedjs_pages {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  gap: 2rem;
}

.pagedjs_page {
  background-color: #fff;
}

h1 {
  string-set: title content(text);
}

@page {
  size: Letter;
  margin: 18mm 15mm 18mm 15mm; /* 0.5 inch */

  @bottom-left {
    content: string(title);
    font-size: 0.5rem;
  }

  @bottom-right {
    content: counter(page) ' / ' counter(pages);
    font-size: 0.5rem;
  }
}

@media print {
  header {
    display: none;
  }
}
</style>
