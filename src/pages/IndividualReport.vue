<template>

  <div v-if="!studentData" class="flex flex-column justify-content-center align-items-center loading-container">
    <AppSpinner style="margin-bottom: 1rem" />
    <span>Loading Your Individual Roar Score Report...</span>
  </div>

  <div v-else class="container">

    <div class="flex flex-column md:flex-row align-items-center p-4 gap-4">

      <div class="student-name text-center md:text-left">
        <h1 class="text-6xl lg:ml-2">
          <strong>{{ studentFirstName }} {{ studentLastName }}</strong>
        </h1>
        <h2 class="md:ml-4 lg:ml-6">Welcome to your ROAR Score Report!</h2>
      </div>

      <div class="student-info">
        <p>
          <strong>Grade:</strong> {{ getGradeWithSuffix(studentData.studentData.grade) }}
        </p>
        <p>
          <strong>Class:</strong> { Placeholder }
        </p>
        <p>
          <strong>Administration:</strong> {{ administrationData.name }}
        </p>
      </div>

    </div>

    <div v-if="taskData.length === 0" class="flex flex-column align-items-center mt-8">
      <div class="p-4">
        It looks like {{ studentFirstName }} is still working on completing their assigned games!
      </div>

      <h3>{{ studentFirstName }}'s individual score report will be built when the student has completed at least one assessment.</h3>
    </div>

    <div v-else class="p-4">
      The Rapid Online Assessment of Reading (ROAR)
      assesses students across a range of foundational reading skills.
      {{ studentFirstName }} completed the following games:
      <ul class="inline-flex p-0" style="list-style-type:none">
        <li>
          <strong>{{ formattedTasks }}</strong>
        </li>
      </ul>
      In this report, you will find {{ studentFirstName }}’s scoring at the time of testing,
      as well as ways you can support {{ studentFirstName }} in
      their path to reading fluency!
    </div>


    <div>
      <individual-score-report-task :student-data="studentData" :task-data="taskData" :raw-task-data="rawTaskData"/>
    </div>
</div>
</template>

<script setup>
import { fetchDocById } from "../helpers/query/utils";
import { runPageFetcher } from "../helpers/query/runs";
import {useQuery} from "@tanstack/vue-query";
import {computed, onMounted, ref} from "vue";
import {storeToRefs} from "pinia";
import {useAuthStore} from "../store/auth";
import IndividualScoreReportTask from "../components/reports/IndividualScoreReportTask.vue";
import AppSpinner from "../components/AppSpinner.vue";
import {getGrade} from "@bdelab/roar-utils";

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

const {data: studentData } = useQuery({
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

const { data: taskData } = useQuery( {
  queryKey: ['runs', props.administrationId, props.userId],
  queryFn: () => runPageFetcher({
  administrationId: props.administrationId,
  userId: props.userId,
  select: ['scores.computed.composite', 'taskId'],
  scoreKey: 'scores.computed.composite',
  paginate: false}),
  enabled: initialized,
  keepPreviousData: true,
  staleTime: 5 * 60 * 1000,
})

const { data: rawTaskData } = useQuery( {
  queryKey: ['runs', props.administrationId, props.userId],
  queryFn: () => runPageFetcher({
  administrationId: props.administrationId,
  userId: props.userId,
  select: ['scores.computed', 'taskId'],
  scoreKey: 'scores.computed',
  paginate: false}),
  enabled: initialized,
  keepPreviousData: true,
  staleTime: 5 * 60 * 1000,
})


const {data: administrationData } = useQuery({
  queryKey: ['administrations', props.administrationId],
  queryFn: () => fetchDocById('administrations', props.administrationId),
  enabled: initialized,
  keepPreviousData: true,
  staleTime: 5 * 60 * 1000,
})


const tasks = computed(() => taskData.value.map((assignment) => assignment.taskId));

const formattedTasks = computed(() => {
  return tasks.value.map(taskId => extendedTaskTitle[taskId]).join(', ') + '.';
});

const studentFirstName = computed(() => {
  if (!studentData.value.name) return studentData.value.username;
  return studentData.value.name.first;
});

const studentLastName = computed ( () => {
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
  if (roarfirekit.value.restConfig){
    refresh()
  }
});



</script>

<style scoped>

.student-name {
  flex: 2;
  background: linear-gradient(to right, var(--red-200), white);
  border-radius: 12px;
  padding: .5rem;
}

.student-info {
  flex: 1;
  background: linear-gradient(to right, white, var(--blue-200));
  border-radius: 12px;
  padding: .5rem;
}

@media (min-width: 768px) {
  .container {
    max-width: 768px;
    margin: 0 auto;
  }
}

@media (min-width: 992px) {
  .container {
    max-width: 992px;
    margin: 0 auto;
  }
}

@media (min-width: 1200px) {
  .container {
    max-width: 1800px;
    margin: 0 auto;
  }
}
</style>
