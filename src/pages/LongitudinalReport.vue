<template>
  <div v-if="isLoading" class="flex flex-column justify-content-center align-items-center loading-container">
    <AppSpinner style="margin-bottom: 1rem" />
    <span>{{ $t('scoreReports.loading') }}</span>
  </div>

  <div v-else id="longitudinal-report" class="container flex flex-column align-items-around">
    <div
      id="longitudinal-report-header"
      class="flex flex-column md:flex-row align-items-center my-2"
      data-cy="report__header"
    >
      <div class="student-name text-center md:text-left my-3">
        <h1 class="text-lg uppercase text-gray-400">
          {{ $t('scoreReports.longitudinalTitle') }}
        </h1>
        <h2 class="text-5xl">
          <strong>{{ studentFirstName }} {{ studentLastName }}</strong>
        </h2>
      </div>

      <div class="student-info bg-gray-200">
        <p v-if="studentData?.studentData?.grade">
          <strong>{{ $t('scoreReports.grade') }}:</strong> {{ getGradeWithSuffix(studentData.studentData.grade) }}
        </p>
        <p v-if="studentData?.studentData?.class">
          <strong>{{ $t('scoreReports.class') }}:</strong> {{ studentData.studentData.class }}
        </p>
      </div>
    </div>

    <div class="welcome-banner">
      <div class="banner-text">{{ $t('scoreReports.longitudinalWelcome') }}</div>
      <div class="flex gap-2">
        <PvButton
          outlined
          class="text-white bg-primary border-white border-1 border-round h-3rem p-3 hover:bg-red-900"
          :label="!expanded ? $t('scoreReports.expandSections') : $t('scoreReports.collapseSections')"
          :icon="!expanded ? 'pi pi-plus ml-2' : 'pi pi-minus ml-2'"
          icon-pos="right"
          data-html2canvas-ignore="true"
          data-cy="report__expand-btn"
          @click="setExpand"
        />
        <PvButton
          outlined
          class="text-white bg-primary border-white border-1 border-round h-3rem p-3 hover:bg-red-900"
          :label="$t('scoreReports.exportPDF')"
          :icon="exportLoading ? 'pi pi-spin pi-spinner ml-2' : 'pi pi-download ml-2'"
          :disabled="exportLoading"
          icon-pos="right"
          data-html2canvas-ignore="true"
          @click="exportToPdf"
        />
      </div>
    </div>

    <div v-if="!hasAnyData" class="flex flex-column align-items-center py-6 bg-gray-100">
      <div class="my-4 px-4 text-xl font-normal text-gray-500">
        {{ $t('scoreReports.needOneComplete', { firstName: studentFirstName }) }}
      </div>
    </div>

    <div v-else>
      <div class="flex justify-content-end align-items-center mb-3">
        <div class="flex align-items-center">
          <span class="text-sm text-gray-600 mr-2">Sort by:</span>
          <PvDropdown v-model="sortOption" :options="sortOptions" option-label="label" class="w-15rem" />
        </div>
      </div>
      <PvAccordion class="w-full">
        <div
          v-for="assignmentId in availableAdministrations"
          :key="assignmentId"
          class="border-2 border-gray-300 border-round-lg mb-4 overflow-hidden"
        >
          <PvAccordionTab class="assignment-card bg-white">
            <div class="flex flex-column align-items-start justify-content-start px-4 py-3">
              <div class="text-xl font-bold">
                {{ administrationData?.find((a) => a.id == assignmentId)?.name || _startCase(assignmentId) }}
              </div>
              <div v-if="currentAdministration(assignmentId)" class="text-sm text-gray-500 mt-1">
                <span>Opened {{ formatDate(currentAdministration(assignmentId).dateOpened) }}</span>
                <span v-if="currentAdministration(assignmentId).dateClosed">
                  · Closes {{ formatDate(currentAdministration(assignmentId).dateClosed) }}
                </span>
              </div>
            </div>
            <div v-if="tasksByAdministration[assignmentId]?.length" class="mt-4 mx-4 mb-4 bg-gray-200 border-round">
              <div class="p-4">
                <div class="text-lg">
                  <i18n-t keypath="scoreReports.completedTasks" tag="div">
                    <template #firstName>
                      {{ studentFirstName }}
                    </template>
                  </i18n-t>
                  <ul class="inline-flex p-0 mt-2" style="list-style-type: none">
                    <li>
                      <strong>{{ formattedTasks[assignmentId] }}</strong>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div class="task-section px-4 pb-4">
              <div v-if="tasksByAdministration[assignmentId]?.length" class="bg-gray-50 border-round p-4">
                <div class="individual-report-wrapper flex flex-wrap align-items-center justify-content-center gap-4">
                  <IndividualScoreReportTask
                    :task-data="tasksByAdministration[assignmentId]"
                    :student-data="studentData"
                    :expanded="expanded"
                    class="w-full max-w-full"
                  />
                </div>
              </div>
              <div
                v-else
                class="flex flex-column align-items-center justify-content-center py-6 bg-gray-100 border-round"
              >
                <div class="my-4 px-4 text-xl font-normal text-gray-500">
                  {{ $t('scoreReports.needOneComplete', { firstName: studentFirstName }) }}
                </div>
              </div>
            </div>
          </PvAccordionTab>
        </div>
      </PvAccordion>

      <div id="support-graphic" class="support-wrapper">
        <PvAccordion
          class="my-2 w-full"
          :active-index="expanded ? 0 : null"
          expand-icon="pi pi-plus ml-2"
          collapse-icon="pi pi-minus ml-2"
        >
          <PvAccordionTab :header="$t('scoreReports.taskTabHeader')">
            <div class="flex flex-column align-items-center text-lg">
              <img
                v-if="!(studentData?.studentData?.grade >= 6)"
                src="../assets/support-distribution.png"
                width="650"
              />
              <div class="text-xl font-bold mt-2">{{ $t('scoreReports.taskIntro') }}</div>
              <ul>
                <i18n-t keypath="scoreReports.standardScoreDescription" tag="li">
                  <template #taskTitle>
                    <b>{{ _startCase($t('scoreReports.standardScore')) }}</b>
                  </template>
                </i18n-t>
                <i18n-t
                  v-if="!(studentData?.studentData?.grade >= 6)"
                  keypath="scoreReports.percentileScoreDescription"
                  tag="li"
                >
                  <template #taskTitle>
                    <b>{{ _startCase($t('scoreReports.percentileScore')) }}</b>
                  </template>
                </i18n-t>
              </ul>
            </div>
          </PvAccordionTab>
        </PvAccordion>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import PvDropdown from 'primevue/dropdown';
import PvButton from 'primevue/button';
import PvAccordion from 'primevue/accordion';
import { useI18n } from 'vue-i18n';
import useUserRunPageQuery from '@/composables/queries/useUserRunPageQuery';
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import useAdministrationsQuery from '@/composables/queries/useAdministrationsQuery';
import { uniq as _uniq, startCase as _startCase } from 'lodash';
import { taskDisplayNames } from '@/helpers/reports';
import PvAccordionTab from 'primevue/accordiontab';
import AppSpinner from '@/components/AppSpinner.vue';
import IndividualScoreReportTask from '@/components/reports/IndividualScoreReportTask.vue';
import { getGradeWithSuffix } from '@/helpers/reports';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

useI18n();

const props = defineProps({
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

const initialized = ref(true);
const exportLoading = ref(false);
const expanded = ref(false);

const { data: studentData, isLoading: isLoadingStudentData } = useUserDataQuery(props.userId);

const { data: taskData, isLoading: isLoadingTaskData } = useUserRunPageQuery(
  props.userId,
  null,
  props.orgType,
  props.orgId,
  {
    enabled: initialized,
    queryFnOptions: {
      select: ['scores.computed', 'taskId', 'assignmentId', 'taskName'],
    },
  },
);

const administrationIds = computed(() => {
  if (!taskData?.value) return [];
  return _uniq(
    taskData.value
      .filter((task) => task.assignmentId && task.assignmentId !== 'undefined')
      .map((task) => task.assignmentId),
  );
});

const { data: administrationData } = useAdministrationsQuery(administrationIds, {
  enabled: computed(() => initialized.value && administrationIds.value.length > 0),
});

const isLoading = computed(() => isLoadingStudentData.value || isLoadingTaskData.value || !administrationData.value);

const studentFirstName = computed(() => {
  if (!studentData?.value) return '';
  return studentData.value.name?.first || studentData.value.username || '';
});

const studentLastName = computed(() => {
  if (!studentData?.value?.name) return '';
  return studentData.value.name.last || '';
});

const sortOption = ref({
  value: 'scores',
  label: 'Has Scores First',
});

const sortOptions = [
  { value: 'scores', label: 'Has Scores First' },
  { value: 'openedDesc', label: 'Most Recently Opened' },
  { value: 'openedAsc', label: 'Oldest Opened First' },
  { value: 'closedDesc', label: 'Most Recently Closed' },
  { value: 'closedAsc', label: 'Oldest Closed First' },
];

const sortAdministrations = (administrations) => {
  return [...administrations].sort((a, b) => {
    const aAdmin = currentAdministration(a);
    const bAdmin = currentAdministration(b);
    const aHasScores = tasksByAdministration.value[a]?.length > 0;
    const bHasScores = tasksByAdministration.value[b]?.length > 0;

    switch (sortOption.value.value) {
      case 'scores':
        if (aHasScores !== bHasScores) return aHasScores ? -1 : 1;
        return bAdmin?.dateOpened?.localeCompare(aAdmin?.dateOpened) || 0;

      case 'openedDesc':
        return bAdmin?.dateOpened?.localeCompare(aAdmin?.dateOpened) || 0;

      case 'openedAsc':
        return aAdmin?.dateOpened?.localeCompare(bAdmin?.dateOpened) || 0;

      case 'closedDesc':
        if (!bAdmin?.dateClosed) return -1;
        if (!aAdmin?.dateClosed) return 1;
        return bAdmin.dateClosed.localeCompare(aAdmin.dateClosed);

      case 'closedAsc':
        if (!aAdmin?.dateClosed) return 1;
        if (!bAdmin?.dateClosed) return -1;
        return aAdmin.dateClosed.localeCompare(bAdmin.dateClosed);

      default:
        return 0;
    }
  });
};

const availableAdministrations = computed(() => {
  return sortAdministrations(administrationIds.value);
});

const tasksByAdministration = computed(() => {
  if (!taskData.value) return {};

  return taskData.value
    .filter((task) => task.assignmentId && task.assignmentId !== 'undefined' && task.scores != undefined)
    .reduce((acc, task) => {
      const adminId = task.assignmentId;
      if (!acc[adminId]) {
        acc[adminId] = [];
      }
      acc[adminId].push(task);
      return acc;
    }, {});
});

const currentAdministration = (assignmentId) => {
  return administrationData.value?.find((a) => a.id === assignmentId);
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formattedTasks = computed(() => {
  if (!taskData.value) return {};
  return Object.entries(tasksByAdministration.value).reduce((acc, [assignmentId, tasks]) => {
    acc[assignmentId] = _uniq(
      tasks.filter((task) => task.taskId).map((task) => taskDisplayNames[task.taskId].publicName || task.taskId),
    ).join(', ');
    return acc;
  }, {});
});

const hasAnyData = computed(() => {
  return taskData.value && taskData.value.length > 0;
});

const setExpand = () => {
  expanded.value = !expanded.value;
};

const exportToPdf = async () => {
  try {
    exportLoading.value = true;
    const element = document.getElementById('longitudinal-report');
    if (!element) return;

    // Temporarily expand all sections for PDF
    const wasExpanded = expanded.value;
    expanded.value = true;
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for DOM update

    const canvas = await html2canvas(element, {
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      ignoreElements: (element) => {
        return element.hasAttribute('data-html2canvas-ignore');
      },
    });

    // Reset expansion state
    expanded.value = wasExpanded;

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');

    const margin = 10; // 10mm margins
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - 2 * margin;
    const contentHeight = pageHeight - 2 * margin;

    // Calculate scale to fit width while maintaining aspect ratio
    const scale = contentWidth / canvas.width;
    const totalHeight = canvas.height * scale;
    const pagesNeeded = Math.ceil(totalHeight / contentHeight);

    // For each page
    for (let page = 0; page < pagesNeeded; page++) {
      if (page > 0) pdf.addPage();

      // Calculate which part of the image to use
      const sourceY = (page * contentHeight) / scale;
      const sourceHeight = Math.min(contentHeight / scale, canvas.height - sourceY);

      pdf.addImage(
        imgData,
        'PNG',
        margin, // x
        margin, // y
        contentWidth,
        sourceHeight * scale, // maintain aspect ratio
        `page-${page}`,
        'FAST',
        0,
        sourceY / canvas.height,
        1,
        sourceHeight / canvas.height,
      );
    }

    pdf.save(`${studentFirstName.value}_${studentLastName.value}_longitudinal_report.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
  } finally {
    exportLoading.value = false;
  }
};

onMounted(async () => {
  try {
    initialized.value = true;
    isLoading.value = false;
  } catch (error) {
    console.error('Error initializing longitudinal report:', error);
    isLoading.value = false;
  }
});
</script>

<style scoped>
.welcome-banner {
  background-color: var(--primary-color);
  padding: 0.8rem 1rem;
  border-radius: 0.5rem;
  color: white;
  justify-content: space-between;
  align-items: center;
  border-radius: 0.2rem 0.2rem 0rem 0rem;
}

.banner-text {
  color: white;
  font-weight: bold;
  font-size: 1.3rem;
}

.student-name {
  flex: 2;
  border-radius: 12px;
}

.student-info {
  flex: 1;
  font-size: 1.2rem;
  border-radius: 12px;
  padding: 0.35rem 0.75rem;
}

.support-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-around;
}

.container {
  margin: 0 auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

@media (min-width: 768px) {
  .container {
    max-width: 768px;
  }
}

@media (min-width: 992px) {
  .container {
    max-width: 992px;
  }
}

@media (min-width: 1200px) {
  .container {
    max-width: 1200px;
  }
}

.loading-container {
  height: 100vh;
}

.administration-section {
  background-color: var(--surface-ground);
  border-radius: 8px;
  padding: 1.5rem;
}

.task-section {
  margin-bottom: 1rem;
  padding: 1rem;
  background-color: var(--surface-card);
  border-radius: 4px;
  box-shadow: var(--card-shadow);
}

.student-info {
  padding: 1rem 2rem;
  border-radius: 8px;
  margin-left: 2rem;
}

.welcome-banner {
  background-color: var(--primary-color);
  color: white;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.banner-text {
  font-size: 1.2rem;
  font-weight: 500;
}

.administration-title {
  font-size: 1.5rem;
  color: var(--primary-color);
  margin-bottom: 1rem;
}

.individual-report-cards {
  background-color: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.administration-selector {
  background-color: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

@media (max-width: 768px) {
  .student-info {
    margin-left: 0;
    margin-top: 1rem;
  }

  .welcome-banner {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
