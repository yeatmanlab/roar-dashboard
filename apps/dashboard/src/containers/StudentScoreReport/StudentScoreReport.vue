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

          <ScoreListPrint
            :student-first-name="studentFirstName"
            :student-grade="studentGrade"
            :task-data="taskData"
            :tasks-dictionary="tasksDictionary"
            :longitudinal-data="longitudinalData"
          />

          <SupportPrint :student-grade="studentGrade" />
        </template>
      </div>

      <template v-else>
        <HeaderScreen
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
          <SummaryScreen
            :student-first-name="studentFirstName"
            :formatted-tasks="tasksList"
            :expanded="expanded"
            :export-loading="exportLoading"
            @toggle-expand="toggleExpand"
            @export-pdf="handleExportToPdf"
          />

          <ScoreListScreen
            :student-first-name="studentFirstName"
            :student-grade="studentGrade"
            :task-data="taskData"
            :tasks-dictionary="tasksDictionary"
            :longitudinal-data="longitudinalData"
            :expanded="expanded"
          />

          <SupportScreen :expanded="expanded" :student-grade="studentGrade" />
        </template>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch, nextTick, toValue } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import useAdministrationsQuery from '@/composables/queries/useAdministrationsQuery';
import useUserRunPageQuery from '@/composables/queries/useUserRunPageQuery';
import useUserLongitudinalRunsQuery from '@/composables/queries/useUserLongitudinalRunsQuery';
import useTasksDictionaryQuery from '@/composables/queries/useTasksDictionaryQuery';
import usePagedPreview from '@/composables/usePagedPreview';
import PdfExportService from '@/services/PdfExport.service';
import { taskDisplayNames } from '@/helpers/reports';

import AppSpinner from '@/components/AppSpinner.vue';
import { HeaderScreen, HeaderPrint } from './components/Header';
import { SummaryScreen, SummaryPrint } from './components/Summary';
import { ScoreListScreen, ScoreListPrint } from './components/ScoreList';
import { SupportScreen, SupportPrint } from './components/Support';
import EmptyState from './components/EmptyState.vue';
import { getStudentDisplayName } from '@/helpers/getStudentDisplayName';
import { formatList } from '@/helpers/formatList';
import { formatListArray } from '@/helpers/formatListArray';

const props = defineProps({
  administrationId: { type: String, required: true },
  userId: { type: String, required: true },
  orgType: { type: String, required: true },
  orgId: { type: String, required: true },
});

const authStore = useAuthStore();
const route = useRoute();

const isPrintMode = computed(() => route.query.print !== undefined);

const expanded = ref(false);
const exportLoading = ref(false);

const initialized = ref(false);
const isLoading = computed(
  () =>
    isLoadingStudentData.value ||
    isLoadingTasksDictionary.value ||
    isLoadingTaskData.value ||
    isLoadingAdministrationData.value ||
    isLoadingLongitudinalData.value,
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

const { data: taskData, isLoading: isLoadingTaskData } = useUserRunPageQuery(
  props.userId,
  props.administrationId,
  props.orgType,
  props.orgId,
  { enabled: initialized },
);

const { data: longitudinalData, isLoading: isLoadingLongitudinalData } = useUserLongitudinalRunsQuery(
  props.userId,
  props.orgType,
  props.orgId,
  { enabled: initialized, select: (data) => data },
);

const { data: tasksDictionary, isLoading: isLoadingTasksDictionary } = useTasksDictionaryQuery({
  enabled: initialized,
});

const tasks = computed(() => taskData?.value?.map((assignment) => assignment.taskId) || []);
const tasksList = computed(() =>
  formatList(tasks.value, tasksDictionary.value, (task, entry) => entry?.technicalName ?? task, {
    orderLookup: Object.entries(taskDisplayNames).reduce((acc, [key, value]) => {
      acc[key] = value.order;
      return acc;
    }, {}),
    suffix: '.',
  }),
);

const tasksListArray = computed(() =>
  formatListArray(tasks.value, tasksDictionary.value, (task, entry) => entry?.technicalName ?? task, {
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
  const fileName = `ROAR-IndividualScoreReport-${studentName}.pdf`;

  exportLoading.value = true;
  try {
    setExpanded(true);
    await nextTick();
    await PdfExportService.generateDocument(fileName);
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
    if (state.roarfirekit?.restConfig?.()) refresh();
  });
  refresh();
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
  clearPaged();
});

// Vite HMR: cleanup paged output when this module is replaced during development
if (import.meta && import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearPaged();
    runPaged();
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
