<template>
  <div>
    <!-- Loading State -->
    <div v-if="isLoading" class="flex flex-column justify-content-center align-items-center">
      <AppSpinner class="mb-4" />
      <span>{{ $t('scoreReports.loading') }}</span>
    </div>

    <template v-else>
      <div data-pdf-export-container>
        <HeaderSection
          :student-first-name="studentFirstName"
          :student-last-name="studentLastName"
          :student-grade="studentGrade"
          :administration-name="administrationData?.name"
          :administration-date="administrationData?.date"
          :data-pdf-export-section="SCORE_REPORT_EXPORT_SECTIONS.HEADER"
        />

        <template v-if="!taskData?.length">
          <EmptyState :student-first-name="studentFirstName" data-pdf-export-section />
        </template>

        <template v-else>
          <SummarySection
            :student-first-name="studentFirstName"
            :formatted-tasks="formattedTasksList"
            :expanded="expanded"
            :export-loading="exportLoading"
            :data-pdf-export-section="SCORE_REPORT_EXPORT_SECTIONS.SUMMARY"
            @toggle-expand="toggleExpand"
            @export-pdf="handleExportToPdf"
          />

          <ScoreCardsListSection
            :student-first-name="studentFirstName"
            :student-grade="studentGrade"
            :task-data="taskData"
            :tasks-dictionary="tasksDictionary"
            :longitudinal-data="longitudinalData"
            :expanded="expanded"
            :data-pdf-export-section="SCORE_REPORT_EXPORT_SECTIONS.DETAILS"
          />

          <SupportSection
            :expanded="expanded"
            :student-grade="studentData?.studentData?.grade"
            :data-pdf-export-section="SCORE_REPORT_EXPORT_SECTIONS.SUPPORT"
          />
        </template>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useAuthStore } from '@/store/auth';
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import useAdministrationsQuery from '@/composables/queries/useAdministrationsQuery';
import useUserRunPageQuery from '@/composables/queries/useUserRunPageQuery';
import useUserLongitudinalRunsQuery from '@/composables/queries/useUserLongitudinalRunsQuery';
import useTasksDictionaryQuery from '@/composables/queries/useTasksDictionaryQuery';
import PdfExportService from '@/services/PdfExport.service';
import { taskDisplayNames } from '@/helpers/reports';

import AppSpinner from '@/components/AppSpinner.vue';
import HeaderSection from './components/HeaderSection.vue';
import SummarySection from './components/SummarySection.vue';
import ScoreCardsListSection from './components/ScoreCardsListSection.vue';
import SupportSection from './components/SupportSection.vue';
import EmptyState from './components/EmptyState.vue';
import { getStudentDisplayName } from '@/helpers/getStudentDisplayName';
import { getStudentGrade } from '@/helpers/getStudentGrade';
import { formatList } from '@/helpers/formatList';
import { SCORE_REPORT_SECTIONS_EXPANDED_URL_PARAM } from '@/constants/scores';

const SCORE_REPORT_EXPORT_SECTIONS = Object.freeze({
  HEADER: 'header',
  SUMMARY: 'summary',
  DETAILS: 'details',
  SUPPORT: 'support',
});

const props = defineProps({
  administrationId: {
    type: String,
    required: true,
  },
  userId: {
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

const authStore = useAuthStore();

// Data loading state
const initialized = ref(false);
const isLoading = computed(
  () =>
    isLoadingStudentData.value ||
    isLoadingTasksDictionary.value ||
    isLoadingTaskData.value ||
    isLoadingAdministrationData.value ||
    isLoadingLongitudinalData.value,
);

// UI control state
const expanded = ref(false);
const exportLoading = ref(false);

// Data queries
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

// Get current administration data
const { data: taskData, isLoading: isLoadingTaskData } = useUserRunPageQuery(
  props.userId,
  props.administrationId,
  props.orgType,
  props.orgId,
  {
    enabled: initialized,
  },
);

// Get longitudinal data across all administrations
const { data: longitudinalData, isLoading: isLoadingLongitudinalData } = useUserLongitudinalRunsQuery(
  props.userId,
  props.orgType,
  props.orgId,
  {
    enabled: initialized,
    select: (data) => {
      return data;
    },
  },
);

const { data: tasksDictionary, isLoading: isLoadingTasksDictionary } = useTasksDictionaryQuery({
  enabled: initialized,
});

// Computed properties
const tasks = computed(() => taskData?.value?.map((assignment) => assignment.taskId) || []);
const formattedTasksList = computed(() =>
  formatList(tasks.value, tasksDictionary.value, (task, entry) => entry?.technicalName ?? task, {
    orderLookup: Object.entries(taskDisplayNames).reduce((acc, [key, value]) => {
      acc[key] = value.order;
      return acc;
    }, {}),
    suffix: '.',
  }),
);

const studentFirstName = computed(
  () => {
    return getStudentDisplayName(studentData).firstName;
  },
  { immediate: true },
);

const studentLastName = computed(
  () => {
    return getStudentDisplayName(studentData).lastName;
  },
  { immediate: true },
);

const studentGrade = computed(
  () => {
    return getStudentGrade(studentData);
  },
  { immediate: true },
);

/**
 * Controls the expanded state of the report cards
 */
const setExpanded = (isExpanded) => {
  if (expanded.value !== isExpanded) {
    expanded.value = isExpanded;
  }
};

const toggleExpand = () => {
  setExpanded(!expanded.value);
};

/**
 * Handles the export to PDF
 *
 * @returns {Promise<void>} Promise that resolves when the export is complete
 */
const handleExportToPdf = async () => {
  const studentName = `${studentFirstName.value}${studentLastName.value ? studentLastName.value : ''}`;
  const fileName = `ROAR-IndividualScoreReport-${studentName}.pdf`;

  const elements = [];

  for (const section of Object.values(SCORE_REPORT_EXPORT_SECTIONS)) {
    const element = document.querySelector(`[data-pdf-export-section="${section}"]`);
    if (element) elements.push(element);
  }

  exportLoading.value = true;

  try {
    // Ensure all sections are expanded for consistent PDF rendering.
    setExpanded(true);
    await nextTick();

    await PdfExportService.generateDocument(elements, fileName);
  } catch (error) {
    // @TODO: Improve error handling.
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

onMounted(() => {
  unsubscribe = authStore.$subscribe(async (mutation, state) => {
    if (state.roarfirekit.restConfig?.()) refresh();
  });

  refresh();

  // Auto-expand when page is opened for export via iframe using ?expanded=true flag
  const params = new URLSearchParams(window.location.search);
  if (params.get(SCORE_REPORT_SECTIONS_EXPANDED_URL_PARAM) === 'true') {
    setExpanded(true);
  }
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});

// PostMessage communication for iframe loading state
let hasMessageBeenSent = false;
let isMounted = false;

const sendPageLoadedMessage = async () => {
  if (hasMessageBeenSent || window.parent === window || !isMounted) return;

  // Wait for next tick to ensure DOM is fully updated
  await nextTick();

  // Double-check loading state after nextTick
  if (!isLoading.value) {
    hasMessageBeenSent = true;

    window.parent.postMessage(
      {
        type: 'page:loaded',
        timestamp: Date.now(),
      },
      window.location.origin,
    );
  }
};

onMounted(() => {
  isMounted = true;

  // Check if we're already loaded when mounted
  if (!isLoading.value) {
    sendPageLoadedMessage();
  }
});

watch(
  isLoading,
  (loading) => {
    // Only send message when loading completes and component is mounted
    if (!loading) {
      sendPageLoadedMessage();
    }
  },
  { immediate: false },
);
</script>
