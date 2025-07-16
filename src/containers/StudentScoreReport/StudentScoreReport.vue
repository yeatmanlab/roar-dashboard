<template>
  <div>
    <!-- Loading State -->
    <div v-if="isLoading" class="flex flex-column justify-content-center align-items-center">
      <AppSpinner class="mb-4" />
      <span>{{ $t('scoreReports.loading') }}</span>
    </div>

    <template v-else>
      <HeaderSection
        :student-first-name="studentFirstName"
        :student-last-name="studentLastName"
        :student-grade="studentData?.studentData?.grade"
        :administration-name="administrationData?.name"
        :administration-date="administrationData?.date"
        data-pdf-export-section="header"
      />

      <SummarySection
        :first-name="studentFirstName"
        :tasks="taskData"
        :formatted-tasks="formattedTasks"
        :expanded="expanded"
        :export-loading="exportLoading"
        data-pdf-export-section="summary"
        @toggle-expand="toggleExpand"
        @export-pdf="handleExportToPdf"
      />

      <ScoreCardsListSection
        v-if="taskData?.length"
        :student-data="studentData"
        :task-data="taskData"
        :tasks-dictionary="tasksDictionary"
        :expanded="expanded"
        data-pdf-export-section="details"
      />

      <SupportSection
        v-if="taskData?.length"
        :expanded="expanded"
        :student-grade="studentData?.studentData?.grade"
        data-pdf-export-section="support"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '@/store/auth';
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import useAdministrationsQuery from '@/composables/queries/useAdministrationsQuery';
import useUserRunPageQuery from '@/composables/queries/useUserRunPageQuery';
import useTasksDictionaryQuery from '@/composables/queries/useTasksDictionaryQuery';
import PdfExportService from '@/services/PdfExport.service';
import { taskDisplayNames } from '@/helpers/reports';

import AppSpinner from '@/components/AppSpinner.vue';
import HeaderSection from './components/HeaderSection.vue';
import SummarySection from './components/SummarySection.vue';
import ScoreCardsListSection from './components/ScoreCardsListSection.vue';
import SupportSection from './components/SupportSection.vue';
import { getStudentDisplayName } from '../../helpers/getStudentDisplayName';

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

// UI control state
const expanded = ref(false);
const exportLoading = ref(false);

/**
 * Toggles the expanded state of the report to show all cards
 */
const toggleExpand = () => {
  expanded.value = !expanded.value;
};

// Data loading state
const initialized = ref(false);
const isLoading = computed(
  () =>
    isLoadingStudentData.value ||
    isLoadingTasksDictionary.value ||
    isLoadingTaskData.value ||
    isLoadingAdministrationData.value,
);

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

const { data: taskData, isLoading: isLoadingTaskData } = useUserRunPageQuery(
  props.userId,
  props.administrationId,
  props.orgType,
  props.orgId,
  {
    enabled: initialized,
  },
);

const { data: tasksDictionary, isLoading: isLoadingTasksDictionary } = useTasksDictionaryQuery({
  enabled: initialized,
});

// Computed properties
const tasks = computed(() => taskData?.value?.map((assignment) => assignment.taskId) || []);

const formattedTasks = computed(() => formatTaskList(tasks.value, tasksDictionary.value));

const studentFirstName = computed(() => {
  return getStudentDisplayName(studentData.value).firstName;
});

const studentLastName = computed(() => {
  return getStudentDisplayName(studentData.value).lastName;
});

/**
 * Handles the export to PDF
 *
 * @returns {Promise<void>} Promise that resolves when the export is complete
 */
const handleExportToPdf = async () => {
  const studentName = `${studentFirstName.value}${studentLastName.value ? studentLastName.value : ''}`;
  const fileName = `ROAR-IndividualScoreReport-${studentName}.pdf`;

  const elements = [
    document.querySelector('[data-pdf-export-section="header"]'),
    document.querySelector('[data-pdf-export-section="summary"]'),
    document.querySelector('[data-pdf-export-section="details"]'),
    document.querySelector('[data-pdf-export-section="support"]'),
  ];

  exportLoading.value = true;

  try {
    // Toggle expand to show all collapsed accordion panels and wait for the DOM to update.
    if (!expanded.value) {
      toggleExpand();
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    await PdfExportService.generateDocument(elements, fileName);
  } catch (error) {
    // @TODO: Improve error handling.
    console.error('Error exporting to PDF:', error);
  } finally {
    exportLoading.value = false;
  }
};

/**
 * Formats a list of tasks into a readable string
 * @param {Array} tasks - Array of task IDs
 * @param {Object} tasksDictionary - Dictionary of task information
 * @returns {String} Formatted task list
 */
const formatTaskList = (tasks = [], tasksDictionary = {}) => {
  if (!tasks || tasks.length === 0) return '';

  return (
    tasks
      .sort((a, b) => {
        if (Object.keys(taskDisplayNames).includes(a) && Object.keys(taskDisplayNames).includes(b)) {
          return taskDisplayNames[a].order - taskDisplayNames[b].order;
        } else {
          return -1;
        }
      })
      .map((task) => tasksDictionary[task]?.technicalName ?? task)
      .join(', ') + '.'
  );
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
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});
</script>
