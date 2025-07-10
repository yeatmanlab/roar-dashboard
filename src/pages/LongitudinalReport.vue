<template>
  <div v-if="isLoading" class="flex flex-column justify-content-center align-items-center loading-container">
    <AppSpinner style="margin-bottom: 1rem" />
    <span>{{ $t('scoreReports.loading') }}</span>
  </div>

  <div v-else class="container flex flex-column align-items-around">
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
      <div v-for="admin in availableAdministrations" :key="admin.id" class="administration-section mb-4">
        <h2 class="text-2xl font-bold mb-3">{{ admin.name }}</h2>

        <div class="welcome-card mt-2 mb-4">
          <div class="p-3 text-lg">
            <i18n-t keypath="scoreReports.completedTasks" tag="div" class="mt-2">
              <template #firstName>
                {{ studentFirstName }}
              </template>
            </i18n-t>

            <div class="task-section">
              <IndividualScoreReportTask
                :task-data="tasksByAdministration[admin.id]"
                :student-first-name="studentFirstName"
                :student-grade="studentData?.studentData?.grade"
                :expanded="expanded"
              />
            </div>
          </div>
        </div>
      </div>

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
import { useI18n } from 'vue-i18n';
import useUserRunPageQuery from '@/composables/queries/useUserRunPageQuery';
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import { uniq as _uniq, startCase as _startCase } from 'lodash';
import PvButton from 'primevue/button';
import PvAccordion from 'primevue/accordion';
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

const initialized = ref(false);
const exportLoading = ref(false);
const isLoading = computed(() => isLoadingStudentData.value);
const expanded = ref(false);

const { data: studentData, isLoading: isLoadingStudentData } = useUserDataQuery(props.userId, {
  enabled: initialized,
});

const studentFirstName = computed(() => {
  if (!studentData?.value) return '';
  return studentData.value.name?.first || studentData.value.username;
});

const studentLastName = computed(() => {
  if (!studentData?.value?.name) return '';
  return studentData.value.name.last;
});

const { data: taskData } = useUserRunPageQuery(props.userId, null, props.orgType, props.orgId, {
  enabled: initialized,
});

const availableAdministrations = computed(() => {
  if (!taskData.value) return [];
  return _uniq(
    taskData.value.map((task) => ({
      id: task.administrationId,
      name: task.administrationName,
    })),
  ).sort((a, b) => a.name.localeCompare(b.name));
});

const tasksByAdministration = computed(() => {
  if (!taskData.value) return {};
  return taskData.value.reduce((acc, task) => {
    const adminId = task.administrationId;
    if (!acc[adminId]) {
      acc[adminId] = [];
    }
    acc[adminId].push(task);
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
    const element = document.querySelector('.container');
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      ignoreElements: (element) => {
        return element.hasAttribute('data-html2canvas-ignore');
      },
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
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
