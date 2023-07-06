<template>
  <div class="tabs-container">
    <ParticipantSidebar :total-games="gamesTotal" :completed-games="gamesCompleted" :student-info="studentInfo" />
    <AppSpinner v-if="loadingGames" />
    <GameTabs v-else :games="assessments" />
  </div>
</template>

<script setup>
import { toValue, onBeforeMount, onMounted, ref, watch } from "vue";
import GameTabs from "../components/GameTabs.vue";
import ParticipantSidebar from "../components/ParticipantSidebar.vue";
import _filter from 'lodash/filter'
import _head from 'lodash/head'
import _get from 'lodash/get'
import { useAuthStore } from "@/store/auth";
import { storeToRefs } from 'pinia';
import AppSpinner from "../components/AppSpinner.vue";
import { connectFirestoreEmulator } from "firebase/firestore";
// const authStore = useAuthStore();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const loadingGames = ref(true)

let assessments = ref([]);
const testData = ref([
  {
    id: "id-1",
    title: "Game 1",
    description: "Tell the difference between the magical language of Lexicality and English to reach the gate back to Earth!",
    imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
    metadata: {
      version: "1.2.3",
      coins: "4"
    },
    completed: true
  },
  {
    id: "id-2",
    title: "Game 2",
    description: "Tell the difference between the magical language of Lexicality and English to reach the gate back to Earth!",
    imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
    metadata: {
      version: "1.2.3",
      coins: "32K"
    },
    completed: true
  },
  {
    id: "id-3",
    title: "Game 3",
    description: "Tell the difference between the magical language of Lexicality and English to reach the gate back to Earth!",
    imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
    metadata: {
      version: "1.2.3",
      coins: "1M"
    },
    completed: false
  },
  {
    id: "id-4",
    title: "Game 4",
    description: "Tell the difference between the magical language of Lexicality and English to reach the gate back to Earth!",
    imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
    metadata: {
      version: "1.2.3",
      coins: "4M"
    },
    completed: false
  },
  {
    id: "id-5",
    title: "Game 5",
    description: "Tell the difference between the magical language of Lexicality and English to reach the gate back to Earth!",
    imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
    metadata: {
      version: "1.2.3",
      coins: "4M"
    },
    completed: false
  },
  {
    id: "id-6",
    title: "Game 6",
    description: "Tell the difference between the magical language of Lexicality and English to reach the gate back to Earth!",
    imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
    metadata: {
      version: "1.2.3",
      coins: "4M"
    },
    completed: false
  },
]);
// Calculate user's age in years from date of birth 
let ageYears = null;
const dob = _get(roarfirekit.value, 'userData.studentData.dob');
if(dob){
  console.log('dob:', dob)
  const age = Date.now() - dob.toDate();
  const ageDate = new Date(age); // miliseconds from epoch
  ageYears = Math.abs(ageDate.getUTCFullYear() - 1970);
}
// Set up studentInfo for sidebar
const studentInfo = ref({
  age: ageYears,
  grade: _get(roarfirekit.value, 'userData.studentData.grade'),
})
const numCompleted = _filter(testData.value, game => {
  return _get(game, 'completed')
}).length
const gamesTotal = ref(testData.value.length)
const gamesCompleted = ref(numCompleted)

onBeforeMount(async () => {
  const assignedAssignments = _get(authStore, 'currentAssignments.assigned')
  console.log('assignedAssignments', assignedAssignments)
  const assignmentInfo = await roarfirekit.value.getAssignments(assignedAssignments)
  console.log('assignmentInfo', assignmentInfo)
  // console.log('head of assignment info', _head(assignmentInfo))
  // console.log('getting assessments', _head(assignmentInfo).assessments)
  // console.log('is Array?', Array.isArray(_get(_head(assignmentInfo), 'assessments')))
  console.log('regular array', [1,2,3])
  // console.log('assessments', _get(_head(assignmentInfo), 'assessments'))
  // console.log('about to push to assessments:', _get(_head(assignmentInfo), 'assessments'))
  console.log('length', _get(_head(assignmentInfo), 'assessments').length)
  const assessmentInfo = _get(_head(assignmentInfo), 'assessments')
  console.log('assessments (should be array)', assessmentInfo)
  // console.log('first element', assessmentInfo[0])
  assessments.value = assessmentInfo
  // console.log('after (ref)', assessments)
  // console.log('after (val)', assessments.value)
  // const startedAssignments = _get(authStore, 'currentAssignments.started')
})
watch(assessments, (newValue, oldValue) => {
  console.log('oldVal', oldValue)
  console.log('new val', newValue)
  console.log('assessments watcher', assessments)
  loadingGames.value = false
})
</script>
<style scoped>
.tabs-container {
  display: flex;
  flex-direction: row;
  padding: 2rem;
  gap: 2rem;
}
@media screen and (max-width: 1100px) {
  .tabs-container {
    flex-direction: column;
  }
}

</style>