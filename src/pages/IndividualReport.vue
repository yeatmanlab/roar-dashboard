<template>
  <div v-if="!studentData" class="flex flex-column justify-content-center align-items-center loading-container">
    <AppSpinner style="margin-bottom: 1rem" />
    <span>Loading Your Individual Roar Score Report...</span>
  </div>

  <div v-else class="container flex flex-column align-items-around">
    <div id="individual-report-header" class="flex flex-column md:flex-row align-items-center my-2">
      <div class="student-name text-center md:text-left my-3">
        <div class="text-lg uppercase text-gray-400">Individual Score Report</div>
        <div class="text-5xl">
          <strong>{{ studentFirstName }} {{ studentLastName }}</strong>
        </div>
      </div>

      <div class="student-info bg-gray-200">
        <p v-if="studentData?.studentData?.grade">
          <strong>Grade:</strong> {{ getGradeWithSuffix(studentData.studentData.grade) }}
        </p>
        <!-- TODO: Get Student Class -->
        <p v-if="studentData?.studentData?.class"><strong>Class:</strong> { Placeholder }</p>
        <p v-if="administrationData?.name"><strong>Administration:</strong> {{ administrationData?.name }}</p>
      </div>
    </div>
    <div class="welcome-banner">
      <div class="banner-text">Welcome to your ROAR Score Report</div>
      <div class="flex gap-2">
        <PvButton
          outlined
          class="text-white"
          :label="!expanded ? 'Expand All Sections' : 'Collapse All Sections'"
          :icon="!expanded ? 'pi pi-plus' : 'pi pi-minus'"
          icon-pos="right"
          data-html2canvas-ignore="true"
          @click="setExpand"
        />
        <PvButton
          outlined
          class="text-white"
          label="Export to PDF"
          :icon="exportLoading ? 'pi pi-spin pi-spinner' : 'pi pi-download'"
          :disabled="exportLoading"
          icon-pos="right"
          data-html2canvas-ignore="true"
          @click="exportToPdf"
        />
      </div>
    </div>

    <div v-if="taskData?.length === 0" class="flex flex-column align-items-center py-6 bg-gray-100">
      <div class="my-2 text-2xl font-bold text-gray-600">
        It looks like {{ studentFirstName }} is still working on completing their assigned games!
      </div>
      <div class="text-md font-light">
        {{ studentFirstName }}'s individual score report will be built when the student has completed at least one
        assessment.
      </div>
    </div>

    <div v-else id="individual-report-banner" class="welcome-card mt-2 mb-4">
      <div class="p-3 text-lg">
        The Rapid Online Assessment of Reading (ROAR) assesses students across a range of foundational reading skills.
        <div class="mt-2">{{ studentFirstName }} completed the following games:</div>
        <ul class="inline-flex p-0" style="list-style-type: none">
          <li>
            <strong>{{ formattedTasks }}</strong>
          </li>
        </ul>
        <div>
          In this report, you will find {{ studentFirstName }}’s scoring at the time of testing, as well as ways you can
          support {{ studentFirstName }} in their path to reading fluency and comprehension!
        </div>
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
        <PvAccordionTab header="Understanding the Scores">
          <div class="flex flex-column align-items-center text-lg">
            <img v-if="!(studentData?.studentData?.grade >= 6)" src="../assets/support-distribution.png" width="650" />
            <div class="text-xl font-bold mt-2">The ROAR assessments return these kinds of scores:</div>
            <ul>
              <li>
                <b>Standard Score: </b>A <b>standard score </b>is a way of showing how your child's test performance
                compares to other kids of the same age or grade. Standard Scores have a range of 0-180. The standard
                score is comparable within a grade level, but not across grade levels or over time.
              </li>
              <li v-if="!(studentData?.studentData?.grade >= 6)">
                <b>Percentile:</b> The <b>percentile</b> refers to a student's rank within their grade level on the
                given skill. The percentile is the number of students out of 100 who have lower scores for that skill.
                For example, students in the 50th percentile would score higher than 50 out of 100 students in the same
                grade.
              </li>
              <li>
                <b>Raw Score: </b>A <b>raw score</b> is the basic measure of a student’s performance on the test.
                Depending on the test, the raw score is based on a number of factors. These may include the number of
                items a student answered correctly or incorrectly, and the difficulty of the items. The raw score is
                comparable across grade levels and over time.
              </li>
            </ul>
            <div v-if="studentData?.studentData?.grade >= 6">
              <b>ROAR</b> assesses foundational reading skills that are ideally in place before 5th grade.
              <br />
              <br />
              In Grades 6–12, skills that <span class="text-pink-600 font-bold">need extra support (pink) </span>are at
              or below a 3rd-grade level. Students with this support level likely need additional systematic, intensive
              instruction on this skill in order to access grade-level reading.
              <br />
              <br />
              Skills that are <span class="text-yellow-600 font-bold"> developing (yellow) </span> are between a 3rd-
              and 5th-grade level. Students with this support level may need additional instruction on this skill in
              order to access grade-level reading.
              <br />
              <br />
              Skills that have been <span class="text-green-600 font-bold"> achieved (green) </span>are above a
              5th-grade level. Students who have achieved this skill likely do not require intervention on this skill to
              access grade-level reading.
              <br />
              <br />
              If a reader has achieved all of these skills, it is likely that foundational reading skills are
              sufficient. If they are still struggling with reading comprehension, other skills such as vocabulary,
              syntax, or comprehension strategies may be holding them back.
            </div>
          </div>
        </PvAccordionTab>
      </PvAccordion>
      <div data-html2canvas-ignore="true" class="w-full">
        <PvAccordion class="my-2 w-full" :active-index="expanded ? 0 : null">
          <PvAccordionTab header="Next Steps">
            <div class="text-lg">
              This score report provides a broad overview of your student’s reading development. Understand that a
              student’s progress may not be linear, and their scores are not fixed- everyone has room to grow and learn.
              To learn more about any given test or subskill, and to find more resources for supporting your student
              <a :href="NextSteps" class="hover:text-red-700" data-html2canvas-ignore="true" target="_blank"
                >click here.</a
              >
            </div>
          </PvAccordionTab>
        </PvAccordion>
      </div>
    </div>
  </div>
</template>

<script setup>
import { fetchDocById } from '../helpers/query/utils';
import { runPageFetcher } from '../helpers/query/runs';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '../store/auth';
import { taskDisplayNames, addElementToPdf } from '@/helpers/reports';
import IndividualScoreReportTask from '../components/reports/IndividualScoreReportTask.vue';
import AppSpinner from '../components/AppSpinner.vue';
import { getGrade } from '@bdelab/roar-utils';
import NextSteps from '@/assets/NextSteps.pdf';
import jsPDF from 'jspdf';

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

const { data: studentData } = useQuery({
  queryKey: ['users', authStore.uid, props.userId],
  queryFn: () => fetchDocById('users', props.userId),
  enabled: initialized,
  keepPreviousData: true,
  staleTime: 5 * 60 * 1000,
});

const { data: assignmentData } = useQuery({
  queryKey: ['assignments', authStore.uid, props.userId, props.administrationId],
  queryFn: () => fetchDocById('users', `${props.userId}/assignments/${props.administrationId}`),
  enabled: initialized,
  keepPreviousData: true,
  staleTime: 5 * 60 * 1000,
});

const { data: taskData } = useQuery({
  queryKey: ['runs', authStore.uid, props.administrationId, props.userId, props.orgType, props.orgId],
  queryFn: () =>
    runPageFetcher({
      administrationId: props.administrationId,
      orgType: props.orgType,
      orgId: props.orgId,
      userId: props.userId,
      select: ['scores.computed', 'taskId', 'reliable', 'engagementFlags', 'optional'],
      scoreKey: 'scores.computed',
      paginate: false,
    }),
  enabled: initialized,
  keepPreviousData: true,
  staleTime: 5 * 60 * 1000,
});

const { data: administrationData } = useQuery({
  queryKey: ['administrations', authStore.uid, props.administrationId],
  queryFn: () => fetchDocById('administrations', props.administrationId),
  enabled: initialized,
  keepPreviousData: true,
  staleTime: 5 * 60 * 1000,
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

const optionalAssessments = computed(() => {
  return assignmentData?.value?.assessments.filter((assessment) => assessment.optional);
});

// Calling the query client to update the cached taskData with the new optional tasks
const queryClient = useQueryClient();

const updateTaskData = () => {
  const updatedTasks = taskData?.value?.map((task) => {
    const isOptional = optionalAssessments?.value?.some((assessment) => assessment.taskId === task.taskId);
    return isOptional ? { ...task, optional: true } : task;
  });

  queryClient.setQueryData(['runs', props.administrationId, props.userId, props.orgType, props.orgId], updatedTasks);
};

// Watch for changes in taskData and update the taskData with the new optional tasks
watch(
  () => taskData.value,
  () => {
    updateTaskData();
  },
  { deep: true },
);

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
      .map((task) => (taskDisplayNames[task] ? taskDisplayNames[task].extendedName : task))
      .join(', ') + '.'
  );
});

const studentFirstName = computed(() => {
  // Using == instead of === to catch both undefined and null values
  if (studentData.value.name?.first == undefined) return studentData.value.username;
  return studentData.value.name.first;
});

const studentLastName = computed(() => {
  if (!studentData.value.name) return '';
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
  updateTaskData();
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
