<template>
  <div v-if="!studentData" class="flex flex-column justify-content-center align-items-center loading-container">
    <AppSpinner style="margin-bottom: 1rem" />
    <span>Loading Your Individual Roar Score Report...</span>
  </div>

  <div v-else ref="IndividualReportDownload" class="container flex flex-column align-items-around">
    <div class="flex flex-column md:flex-row align-items-center my-2">
      <div class="student-name text-center md:text-left my-3">
        <div class="text-lg uppercase text-gray-400">
          Individual Score Report
        </div>
        <div class="text-5xl">
          <strong>{{ studentFirstName }} {{ studentLastName }}</strong>
        </div>
      </div>

      <div class="student-info bg-gray-200">
        <p v-if="studentData?.studentData?.grade">
          <strong>Grade:</strong> {{ getGradeWithSuffix(studentData.studentData.grade) }}
        </p>
        <!-- TODO: Get Student Class -->
        <p v-if="studentData?.studentData?.class">
          <strong>Class:</strong> { Placeholder }
        </p>
        <p v-if="administrationData?.name">
          <strong>Administration:</strong> {{ administrationData?.name }}
        </p>
      </div>

    </div>

    <div v-if="taskData?.length === 0" class="flex flex-column align-items-center mt-8">
      <div class="p-4">
        It looks like {{ studentFirstName }} is still working on completing their assigned games!
      </div>

      <h3>{{ studentFirstName }}'s individual score report will be built when the student has completed at least one
        assessment.</h3>
    </div>

    <div v-else class="welcome-card mt-2 mb-4">
      <div class="welcome-banner">
        <div class="banner-text">Welcome to your ROAR Score Report</div>
        <div class="flex">
          <PvButton
outlined class="text-white" :label="!expanded ? 'Expand All Sections' : 'Collapse All Sections'"
            :icon="!expanded ? 'pi pi-plus' : 'pi pi-minus'"
            icon-pos="right" data-html2canvas-ignore="true" @click="setExpand" />
          <PvButton
outlined class="text-white" label="Export to PDF" icon="pi pi-download"
            icon-pos="right" data-html2canvas-ignore="true" @click="printDownload" />
        </div>
        <!-- </PvButton> -->
      </div>
      <div class="p-3 ">
        The Rapid Online Assessment of Reading (ROAR)
        assesses students across a range of foundational reading skills.
        <div class="mt-2">
          {{ studentFirstName }} completed the following games:
        </div>
        <ul class="inline-flex p-0" style="list-style-type:none">
          <li>
            <strong>{{ formattedTasks }}</strong>
          </li>
        </ul>
        <div>
          In this report, you will find {{ studentFirstName }}’s scoring at the time of testing,
          as well as ways you can support {{ studentFirstName }} in
          their path to reading fluency!
        </div>
      </div>
    </div>


    <div class="individual-report-wrapper gap-4">
      <individual-score-report-task
:student-data="studentData" :task-data="taskData" :raw-task-data="rawTaskData"
        :expanded="expanded" />
    </div>
    <PvAccordion class="my-5 w-full" :active-index="expanded ? 0 : null">
      <PvAccordionTab header="Next Steps">
        <div style="">
          This score report provides a broad overview of your student’s reading development. Understand that a
          student’s
          progress may not be linear, and their scores are not fixed- everyone has room to grow and learn.

          To learn more about any given test or subskill, click here.
        </div>
      </PvAccordionTab>
    </PvAccordion>
  </div>
</template>

<script setup>
import { fetchDocById } from "../helpers/query/utils";
import { runPageFetcher } from "../helpers/query/runs";
import { useQuery } from "@tanstack/vue-query";
import { computed, onMounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { useAuthStore } from "../store/auth";
import IndividualScoreReportTask from "../components/reports/IndividualScoreReportTask.vue";
import AppSpinner from "../components/AppSpinner.vue";
import { getGrade } from "@bdelab/roar-utils";
import html2pdf from "html2pdf.js"

// const administrationId = '5vaxicYXnpsNXeq1mUJK';
// const userId = '00w7xNIlq9gG1uxhmRTiv9NdOys2';

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
});


const initialized = ref(false);

const { data: studentData } = useQuery({
  queryKey: ['users', props.userId],
  queryFn: () => fetchDocById('users', props.userId),
  enabled: initialized,
  keepPreviousData: true,
  staleTime: 5 * 60 * 1000,
})

// const {data: classData } = useQuery({
//   queryKey: ['classes', props.userId],
//   queryFn: () => fetchDocById('classes', studentData.value.classes.current[0]),
//   enabled: studentData.value !== undefined,
//   keepPreviousData: true,
//   staleTime: 5 * 60 * 1000,
// })

const { data: taskData } = useQuery({
  queryKey: ['runs', props.administrationId, props.userId],
  queryFn: () => runPageFetcher({
    administrationId: props.administrationId,
    userId: props.userId,
    select: ['scores.computed.composite', 'taskId'],
    scoreKey: 'scores.computed.composite',
    paginate: false
  }),
  enabled: initialized,
  keepPreviousData: true,
  staleTime: 5 * 60 * 1000,
})

const { data: rawTaskData } = useQuery({
  queryKey: ['runs', props.administrationId, props.userId],
  queryFn: () => runPageFetcher({
    administrationId: props.administrationId,
    userId: props.userId,
    select: ['scores.computed', 'taskId'],
    scoreKey: 'scores.computed',
    paginate: false
  }),
  enabled: initialized,
  keepPreviousData: true,
  staleTime: 5 * 60 * 1000,
})


const { data: administrationData } = useQuery({
  queryKey: ['administrations', props.administrationId],
  queryFn: () => fetchDocById('administrations', props.administrationId),
  enabled: initialized,
  keepPreviousData: true,
  staleTime: 5 * 60 * 1000,
})

const expanded = ref(false);

const setExpand = () => {
  console.log("expand called")
  expanded.value = !expanded.value;
}

const IndividualReportDownload = ref(null);

function printDownload() {
  const doc = IndividualReportDownload.value

  const opt = {
    margin: 0.2,
    filename: `IndividualScoreReport_${studentFirstName.value}${studentLastName.value}.pdf`,
    html2canvas: { width: 1200, },
    jsPDF: {
      format: 'letter', orientation: 'p',
    }
  };
  html2pdf().set(opt).from(doc).save()

}

const tasks = computed(() => taskData?.value?.map((assignment) => assignment.taskId));

const formattedTasks = computed(() => {
  return tasks?.value?.map(taskId => extendedTaskTitle[taskId] ? extendedTaskTitle[taskId] : taskId).join(', ') + '.';
});

const studentFirstName = computed(() => {
  if (studentData.value.name.first == undefined) return studentData.value.username;
  return studentData.value.name.first;
});

const studentLastName = computed(() => {
  if (!studentData.value.name) return "";
  return studentData.value.name.last;
});


const extendedTaskTitle = {
  "swr": "ROAR-Word",
  "swr-es": "ROAR-Palabra",
  "pa": "ROAR-Phoneme",
  "sre": "ROAR-Sentence",
  "vocab": "ROAR-Picture Vocabulary ",
  "multichoice": "ROAR-Multiple Choice",
  "morph": "ROAR-Morphology",
  "cva": "ROAR-Written Vocabulary",
  "letter": "ROAR-Letter",
  "comp": "ROAR-Comprehension",
  "syntax": "ROAR-Syntax",
  "fluency": "ROAM-Fluency",
}

function getGradeWithSuffix(grade) {
  if (getGrade(grade) < 1) {
    return grade;
  } else if (getGrade(grade) === 1) {
    return grade + 'st';
  } else if (getGrade(grade) === 2) {
    return grade + 'nd';
  } else if (getGrade(grade) === 3) {
    return grade + 'rd';
  } else if (getGrade(grade) >= 4 && getGrade(grade) <= 12) {
    return grade + 'th';
  } else {
    return "Invalid grade";
  }
}

// function getMatchingClasses(studentData, administrationData) {
//   // Check if the necessary properties exist
//   // if (!studentData?.classes || !studentData?.classes?.current || !administrationData?.classes) {
//   //   throw new Error('Invalid class data');
//   // }
//
//   // Use the filter method to find matching elements
//   const matchingClasses = studentData.classes.current.filter(className =>
//     administrationData?.classes.includes(className)
//   );
//   classId.value = matchingClasses;
//   classMatched.value = true;
//   return matchingClasses;
// }


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
    refresh()
  }
});



</script>

<style scoped>
.individual-report-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  align-items: center;
  justify-content: space-around;
}

.welcome-card {
  outline: 1px solid rgb(188, 188, 188);
  border-radius: 0.2rem 0.2rem 0.5rem 0.5rem;
}

.welcome-banner {
  display: flex;
  background-color: var(--primary-color);
  padding: .8rem 1rem;
  border-radius: .5rem;
  color: white;
  justify-content: space-between;
  align-items: center;
  ;
  border-radius: .2rem .2rem 0rem 0rem;
}

.banner-text {
  color: white;
  font-weight: bold;
  font-size: 1rem;
}

.student-name {
  flex: 2;
  border-radius: 12px;
}

.student-info {
  flex: 1;
  font-size: 1rem;
  border-radius: 12px;
  padding: .35rem .75rem;
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
