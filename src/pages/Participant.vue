<template>
  <div>
    <AppSpinner v-if="loadingGames" />
    <div v-else class="tabs-container">
      <ParticipantSidebar :total-games="totalGames" :completed-games="completeGames" :student-info="studentInfo" />
      <GameTabs :games="assessments" />
    </div>
    
    
  </div>
</template>

<script setup>
import { toRaw, onBeforeMount, onMounted, ref, watch } from "vue";
import GameTabs from "../components/GameTabs.vue";
import ParticipantSidebar from "../components/ParticipantSidebar.vue";
import _filter from 'lodash/filter'
import _head from 'lodash/head'
import _get from 'lodash/get'
import { useAuthStore } from "@/store/auth";
import { storeToRefs } from 'pinia';
import AppSpinner from "../components/AppSpinner.vue";

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const loadingGames = ref(true)
let assessments = ref([]);
let totalGames = ref(0);
let completeGames = ref(0);

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
// const gamesTotal = ref(testData.value.length)
// const gamesCompleted = ref(numCompleted)

onBeforeMount(async () => {
  const assignedAssignments = toRaw(authStore.assignedAssignments);
  const assignmentInfo = await authStore.getAssignments(assignedAssignments);
  const assessmentInfo = _get(_head(assignmentInfo), 'assessments');
  assessments.value = assessmentInfo;

  const completedTasks = _filter(assessmentInfo, (task) => task.completedOn)
  console.log('completed', completedTasks.length)
  totalGames.value = assessmentInfo.length;
  completeGames.value = completedTasks.length;
})
watch(assessments, (newValue, oldValue) => {
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