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
      <div class="administration-selector my-4">
        <h3>{{ $t('scoreReports.selectAdministrations') }}</h3>
        <PvMultiSelect
          v-model="selectedAdministrations"
          :options="availableAdministrations"
          option-label="name"
          :placeholder="$t('scoreReports.selectPlaceholder')"
          class="w-full md:w-20rem"
          @change="handleAdministrationChange"
        />
      </div>

      <div v-for="administration in selectedAdministrations" :key="administration.id" class="mb-4">
        <h3 class="administration-title">{{ administration.name }}</h3>
        <div class="individual-report-cards">
          <individual-score-report-task
            v-if="administrationData[administration.id]?.length"
            :student-data="studentData"
            :task-data="administrationData[administration.id]"
            :expanded="expanded"
          />
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
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import useUserRunPageQuery from '@/composables/queries/useUserRunPageQuery';
import { startCase as _startCase, uniq as _uniq } from 'lodash';
import IndividualScoreReportTask from '@/components/reports/IndividualScoreReportTask.vue';
import AppSpinner from '@/components/AppSpinner.vue';
import { getGradeWithSuffix } from '@/helpers/reports.js';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import PvButton from 'primevue/button';
import PvMultiSelect from 'primevue/multiselect';
import PvAccordion from 'primevue/accordion';
import PvAccordionTab from 'primevue/accordiontab';

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
const selectedAdministrations = ref([]);
const administrationData = ref({});

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

const availableAdministrations = computed(() => {
  if (!taskData.value) return [];
  return _uniq(
    taskData.value.map((task) => ({
      id: task.administrationId,
      name: task.administrationName,
    })),
  );
});

const hasAnyData = computed(() => {
  return Object.values(administrationData.value).some((data) => data && data.length > 0);
});

const setExpand = () => {
  expanded.value = !expanded.value;
};

const { data: taskData } = useUserRunPageQuery(props.userId, null, props.orgType, props.orgId, {
  enabled: initialized,
});

const handleAdministrationChange = () => {
  if (!taskData.value) return;

  for (const admin of selectedAdministrations.value) {
    if (!administrationData.value[admin.id]) {
      // Filter tasks for this administration
      const adminTasks = taskData.value.filter((task) => task.administrationId === admin.id);

      administrationData.value[admin.id] = adminTasks.map((task) => ({
        ...task,
        administrationId: task.administrationId,
        administrationName: task.administrationName,
      }));
    }
  }
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
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.loading-container {
  min-height: 400px;
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
