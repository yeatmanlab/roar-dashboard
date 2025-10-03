<template>
  <div>
    <div v-if="isLoading" class="flex flex-column justify-content-center align-items-center">
      <AppSpinner class="mb-4" />
      <span>{{ $t('scoreReports.loading') }}</span>
    </div>

    <template v-else>
      <template v-if="isPrintMode">
        <div data-pdf-export-container>
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
      </template>

      <template v-else>
        <div>
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
        </div>
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
import { Previewer } from 'pagedjs';

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
const route = useRoute();

const isPrintMode = computed(() => route.query.print === 'true', { immediate: true });

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
  {
    enabled: initialized,
  },
);

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
    return toValue(studentData)?.studentData?.grade;
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

/**
 * Toggles the expanded state of the report cards
 */
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
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});

// PostMessage communication for iframe loading state
let hasMessageBeenSent = false;

/**
 * Sends a message to the parent window to indicate that the page has loaded.
 *
 * @returns {Promise<void>} Promise that resolves when the message is sent
 */
const sendPageLoadedMessage = async () => {
  if (hasMessageBeenSent || window.parent === window) return;

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

// --- Paged.js helpers and lifecycle ---
// Track rendering state to avoid overlapping previews (useful with HMR and reactive re-runs)
const pagedRendering = ref(false);

// Wait for web fonts to be ready so text renders correctly in preview
const waitForFonts = async () => {
  if (document?.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
      // eslint-disable-next-line no-empty
    } catch {}
  }
};

// Wait for all images under a root node to finish loading
const waitForImages = async (root) => {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) return resolve();
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        }),
    ),
  );
};

// Remove previous Paged.js output/styles (for HMR or subsequent previews)
const clearPagedOutput = () => {
  const pages = document.querySelector('.pagedjs_pages');
  if (pages && pages.parentElement) {
    pages.parentElement.removeChild(pages);
  }
  // Remove any internal paged styles
  document
    .querySelectorAll('style[data-pagedjs-internal], #pagedjs-generated-styles')
    .forEach((n) => n.parentElement && n.parentElement.removeChild(n));
};

onUnmounted(() => {
  clearPagedOutput();
  pagedRendering.value = false;
});

const runPagedPreview = async () => {
  try {
    // Wait next tick to ensure DOM is stable
    await nextTick();
    // Ensure fonts and images are ready to avoid rendering only placeholders/spinners
    await waitForFonts();
    await waitForImages(document.body);
    // Give the browser one more frame to settle layout
    await new Promise((r) => requestAnimationFrame(() => r()));

    // Clear any previous Paged.js artifacts (useful for HMR and re-renders)
    clearPagedOutput();

    // Prevent re-entrancy
    if (pagedRendering.value) return;
    pagedRendering.value = true;
    try {
      const previewer = new Previewer();
      // Render the entire document. This is the simplest, previously working approach.
      await previewer.preview();
    } finally {
      sendPageLoadedMessage();
      pagedRendering.value = false;
    }
  } catch (e) {
    // Non-fatal; just log for diagnostics
    console.error('Paged.js preview failed:', e);
  }
};

watch(
  [isLoading, isPrintMode],
  async ([loading, print]) => {
    if (!loading && print) {
      await runPagedPreview();
    }
  },
  { immediate: false },
);

// Vite HMR: cleanup paged output when this module is replaced during development
if (import.meta && import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearPagedOutput();
    pagedRendering.value = false;
    runPagedPreview();
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

/* Render the print view in a container that is identical to the PDF export container */
[data-pdf-export-container]:not(.is-preview-mode) {
  width: 8.5in; /* Equivalent of a US Letter page width */
  padding: 18mm 15mm 18mm 15mm; /* 0.5 inch */
}

h1 {
  string-set: title content(text);
}

@media screen {
}

@media print {
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

  header {
    display: none;
  }

  .pagedjs_page {
    border: none;
  }
}
</style>
