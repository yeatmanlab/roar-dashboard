<template>
  <div v-if="isLoading" class="flex flex-column justify-content-center align-items-center loading-container">
    <AppSpinner style="margin-bottom: 1rem" />
    <span>{{ $t('scoreReports.loading') }}</span>
  </div>

  <div v-else class="container flex flex-column align-items-around">
    <div id="individual-report-header" class="flex flex-column md:flex-row align-items-center my-2">
      <div class="student-name text-center md:text-left my-3">
        <div class="text-lg uppercase text-gray-400">{{ $t('scoreReports.pageTitle') }}</div>
        <div class="text-5xl">
          <strong>{{ studentFirstName }} {{ studentLastName }}</strong>
        </div>
      </div>

      <div class="student-info bg-gray-200">
        <p v-if="studentData?.studentData?.grade">
          <strong>{{ $t('scoreReports.grade') }}:</strong> {{ getGradeWithSuffix(studentData.studentData.grade) }}
        </p>
        <!-- TODO: Get Student Class -->
        <p v-if="studentData?.studentData?.class">
          <strong>{{ $t('scoreReports.class') }}:</strong> { Placeholder }
        </p>
        <p v-if="administrationData?.name">
          <strong>{{ $t('scoreReports.administration') }}:</strong> {{ administrationData?.name }}
        </p>
      </div>
    </div>
    <div class="welcome-banner">
      <div class="banner-text">{{ $t('scoreReports.welcome') }}</div>
      <div class="flex gap-2">
        <PvButton
          outlined
          class="text-white bg-primary border-white border-1 border-round h-3rem p-3 hover:bg-red-900"
          :label="!expanded ? $t('scoreReports.expandSections') : $t('scoreReports.collapseSections')"
          :icon="!expanded ? 'pi pi-plus ml-2' : 'pi pi-minus ml-2'"
          icon-pos="right"
          data-html2canvas-ignore="true"
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

    <div v-if="taskData?.length === 0" class="flex flex-column align-items-center py-6 bg-gray-100">
      <i18n-t keypath="scoreReports.stillWorking" tag="div" class="my-2 text-2xl font-bold text-gray-600">
        <template #firstName>
          {{ studentFirstName }}
        </template>
      </i18n-t>
      <i18n-t keypath="scoreReports.needOneComplete" tag="div" class="text-md font-light">
        <template #firstName>
          {{ studentFirstName }}
        </template>
      </i18n-t>
    </div>

    <div v-else id="individual-report-banner" class="welcome-card mt-2 mb-4">
      <div class="p-3 text-lg">
        {{ $t('scoreReports.roarSummery') }}
        <i18n-t keypath="scoreReports.completedTasks" tag="div" class="mt-2">
          <template #firstName>
            {{ studentFirstName }}
          </template>
        </i18n-t>
        <ul class="inline-flex p-0" style="list-style-type: none">
          <li>
            <strong>{{ formattedTasks }}</strong>
          </li>
        </ul>
        <i18n-t keypath="scoreReports.summery" tag="div">
          <template #firstName>
            {{ studentFirstName }}
          </template>
        </i18n-t>
      </div>
    </div>
    <div id="individual-report-cards" class="individual-report-wrapper gap-4">
      <individual-score-report-task
        v-if="taskData?.length"
        :student-data="studentData"
        :task-data="taskData"
        :expanded="expanded"
      />
    </div>
    <div id="support-graphic" class="support-wrapper">
      <PvAccordion class="my-2 w-full" :active-index="expanded ? 0 : null">
        <PvAccordionTab :header="$t('scoreReports.taskTabHeader')">
          <div class="flex flex-column align-items-center text-lg">
            <img v-if="!(studentData?.studentData?.grade >= 6)" src="../assets/support-distribution.png" width="650" />
            <div class="text-xl font-bold mt-2">{{ $t('scoreReports.taskIntro') }}</div>
            <ul>
              <i18n-t keypath="scoreReports.standardScoreDescription" tag="li">
                <template #taskTitle>
                  <b>{{ _startCase($t('scoreReports.standardScore')) }}</b
                  >: A <b>{{ $t('scoreReports.standardScore') }}</b>
                </template>
              </i18n-t>
              <i18n-t
                v-if="!(studentData?.studentData?.grade >= 6)"
                keypath="scoreReports.percentileScoreDescription"
                tag="li"
              >
                <template #taskTitle>
                  <b>{{ _startCase($t('scoreReports.percentileScore')) }}</b
                  >: A <b>{{ $t('scoreReports.percentileScore') }}</b>
                </template>
              </i18n-t>
              <i18n-t keypath="scoreReports.rawScoreDescription" tag="li">
                <template #taskTitle>
                  <b>{{ _startCase($t('scoreReports.rawScore')) }}</b
                  >: A <b>{{ $t('scoreReports.rawScore') }}</b>
                </template>
              </i18n-t>
            </ul>
            <div v-if="studentData?.studentData?.grade >= 6">
              <i18n-t keypath="scoreReports.roarDescription" tag="span">
                <template #roar>
                  <b>ROAR</b>
                </template>
              </i18n-t>
              <br />
              <br />
              <i18n-t keypath="scoreReports.extraSupportDescription" tag="span">
                <template #supportCategory>
                  <span class="text-pink-600 font-bold">{{ $t('scoreReports.extraSupport') }}</span>
                </template>
              </i18n-t>
              <br />
              <br />
              <i18n-t keypath="scoreReports.developingDescription" tag="span">
                <template #supportCategory>
                  <span class="text-yellow-600 font-bold">{{ $t('scoreReports.developing') }}</span>
                </template>
              </i18n-t>
              <br />
              <br />
              <i18n-t keypath="scoreReports.achievedDescription" tag="span">
                <template #supportCategory>
                  <span class="text-green-600 font-bold">{{ $t('scoreReports.achieved') }}</span>
                </template>
              </i18n-t>
              <br />
              <br />
              {{ $t('scoreReports.skillsDescription') }}
            </div>
          </div>
        </PvAccordionTab>
      </PvAccordion>
      <div data-html2canvas-ignore="true" class="w-full mb-7">
        <PvAccordion class="my-2 w-full" :active-index="expanded ? 0 : null">
          <PvAccordionTab :header="$t('scoreReports.nextStepsTabHeader')">
            <i18n-t keypath="scoreReports.nextSteps" tag="div" class="text-lg">
              <template #link>
                <a :href="NextSteps" class="hover:text-red-700" data-html2canvas-ignore="true" target="_blank"
                  >click here.</a
                >
              </template>
            </i18n-t>
          </PvAccordionTab>
        </PvAccordion>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import jsPDF from 'jspdf';
import _startCase from 'lodash/startCase';
import { getGrade } from '@bdelab/roar-utils';
import { useAuthStore } from '@/store/auth';
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import useAdministrationsQuery from '@/composables/queries/useAdministrationsQuery';
import useUserRunPageQuery from '@/composables/queries/useUserRunPageQuery';
import useTasksDictionaryQuery from '@/composables/queries/useTasksDictionaryQuery';
import { taskDisplayNames, addElementToPdf } from '@/helpers/reports';
import IndividualScoreReportTask from '@/components/reports/IndividualScoreReportTask.vue'; // @TODO: Not used?
import AppSpinner from '@/components/AppSpinner.vue';
import NextSteps from '@/assets/NextSteps.pdf';

const authStore = useAuthStore();

const { roarfirekit } = storeToRefs(authStore);

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

const initialized = ref(false);

const isLoading = computed(() => isLoadingStudentData.value || isLoadingTasksDictionary.value);

const { data: studentData, isLoading: isLoadingStudentData } = useUserDataQuery(props.userId, {
  enabled: initialized,
});

const { data: administrationData } = useAdministrationsQuery([props.administrationId], {
  enabled: initialized,
  select: (data) => data[0],
});

const { data: taskData } = useUserRunPageQuery(props.userId, props.administrationId, props.orgType, props.orgId, {
  enabled: initialized,
});

const { data: tasksDictionary, isLoading: isLoadingTasksDictionary } = useTasksDictionaryQuery({
  enabled: initialized,
});

const expanded = ref(false);
const exportLoading = ref(false);

const setExpand = () => {
  expanded.value = !expanded.value;
};

const exportToPdf = async () => {
  exportLoading.value = true; // Set loading icon in button to prevent multiple clicks
  if (!expanded.value) {
    setExpand();
  }
  await new Promise((resolve) => setTimeout(resolve, 250));

  const doc = new jsPDF();
  let yCounter = 5; // yCounter tracks the y position in the PDF

  // Add At a Glance Charts and report header to the PDF
  const individualReportHeader = document.getElementById('individual-report-header');
  if (individualReportHeader !== null) {
    yCounter = await addElementToPdf(individualReportHeader, doc, yCounter);
  }
  const individualReportBanner = document.getElementById('individual-report-banner');
  if (individualReportBanner !== null) {
    yCounter = await addElementToPdf(individualReportBanner, doc, yCounter);
  }
  const individualReportCards = document.getElementById('individual-report-cards');
  if (individualReportCards !== null) {
    yCounter = await addElementToPdf(individualReportCards, doc, yCounter);
  }
  const supportGraphic = document.getElementById('support-graphic');
  if (supportGraphic !== null) {
    yCounter = await addElementToPdf(supportGraphic, doc, yCounter);
  }

  yCounter += 10;
  doc.setFontSize(12);
  doc.text(
    'This score report provides a broad overview of your student’s reading development. Understand that a student’s progress may not be linear, and their scores are not fixed - everyone has room to grow and learn. To learn more about any given test or subskill, and to find more resources for supporting your student, click the following link. ',
    15,
    yCounter,
    { maxWidth: 180 },
  );
  yCounter += 25;
  doc.setTextColor(0, 0, 255);
  doc.textWithLink('Next Steps', 15, yCounter, {
    url: 'https://roar.education/assets/NextSteps-a446d6a7.pdf',
    color: 'blue',
  });

  doc.save(`IndividualScoreReport_${studentFirstName.value}${studentLastName.value}.pdf`),
    (exportLoading.value = false);
};

const tasks = computed(() => taskData?.value?.map((assignment) => assignment.taskId));

const formattedTasks = computed(() => {
  return (
    // eslint-disable-next-line vue/no-side-effects-in-computed-properties
    (tasks?.value ?? [])
      .sort((a, b) => {
        if (Object.keys(taskDisplayNames).includes(a) && Object.keys(taskDisplayNames).includes(b)) {
          return taskDisplayNames[a].order - taskDisplayNames[b].order;
        } else {
          return -1;
        }
      })
      .map((task) => tasksDictionary.value[task]?.technicalName ?? task)
      .join(', ') + '.'
  );
});

const studentFirstName = computed(() => {
  if (!studentData?.value) return '';
  // Using == instead of === to catch both undefined and null values
  if (studentData.value.name?.first == undefined) return studentData.value.username;
  return studentData.value.name.first;
});

const studentLastName = computed(() => {
  if (!studentData?.value?.name) return '';
  return studentData.value.name.last;
});

function getGradeWithSuffix(grade) {
  if (getGrade(grade) < 1) {
    return grade;
  } else if (getGrade(grade) === 1) {
    return grade + 'st';
  } else if (getGrade(grade) === 2) {
    return grade + 'nd';
  } else if (getGrade(grade) === 3) {
    return grade + 'rd';
  } else if (getGrade(grade) >= 4 && getGrade(grade) <= 13) {
    return grade + 'th';
  } else {
    return 'Invalid grade';
  }
}

const refreshing = ref(false);
let unsubscribe;

const refresh = () => {
  refreshing.value = true;
  if (unsubscribe) unsubscribe();

  refreshing.value = false;
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) refresh();
});

onMounted(async () => {
  if (roarfirekit.value.restConfig) {
    refresh();
  }
});
</script>

<style scoped>
.individual-report-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: start;
  justify-content: space-around;
}

.welcome-card {
  outline: 1px solid rgb(188, 188, 188);
  border-radius: 0.2rem 0.2rem 0.5rem 0.5rem;
}

.welcome-banner {
  display: flex;
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

@media (min-width: 768px) {
  .container {
    max-width: 768px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
}

@media (min-width: 992px) {
  .container {
    max-width: 992px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
}

@media (min-width: 1200px) {
  .container {
    max-width: 1200px;
    /* margin: 0 2rem; */
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
}
</style>
