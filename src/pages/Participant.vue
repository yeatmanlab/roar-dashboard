<template>
  <div>
    <div v-if="!noGamesAvailable">
      <AppSpinner v-if="loadingGames" />
      <div v-else class="tabs-container">
        <ParticipantSidebar :total-games="totalGames" :completed-games="completeGames" :student-info="studentInfo" />
        <GameTabs :games="assessments" />
      </div>
    </div>
    <div v-else>
      <div class="col-full text-center">
        <h1>You have no assigments!</h1>
        <p>Please contact your administrator to get added to an assignment.</p>
        <router-link :to="{ name: 'SignOut' }">
          <Button label="Sign out" icon="pi pi-sign-out" />
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { toRaw, onMounted, ref, watch, onBeforeUpdate } from "vue";
import GameTabs from "../components/GameTabs.vue";
import ParticipantSidebar from "../components/ParticipantSidebar.vue";
import _filter from 'lodash/filter'
import _head from 'lodash/head'
import _get from 'lodash/get'
import { useAuthStore } from "@/store/auth";
import { storeToRefs } from 'pinia';
import AppSpinner from "../components/AppSpinner.vue";

const authStore = useAuthStore();
const { isFirekitInit, userData, firekitUserData } = storeToRefs(authStore);

const loadingGames = ref(true)
const noGamesAvailable = ref(false)
let assessments = ref([]);
let totalGames = ref(0);
let completeGames = ref(0);

// Set up studentInfo for sidebar
const studentInfo = ref({
  grade: _get(userData.value, 'studentData.grade') || _get(firekitUserData.value, 'studentData.grade'),
})

async function setUpAssignments() {
  const assignedAssignments = toRaw(authStore.assignedAssignments);
  let assignmentInfo = []
    try {
      if(assignedAssignments.length > 0){
        assignmentInfo = await authStore.getAssignments(assignedAssignments);
      }
    } catch(e) {
      // Could not grab data from live roarfirekit, user cached firekit.
      if(authStore.firekitAssignments){
        assignmentInfo = authStore.firekitAssignments
      } else {
        noGamesAvailable.value = true;
      }
    }
    if(assignmentInfo.length > 0){
      const assessmentInfo = _get(_head(assignmentInfo), 'assessments');
      assessments.value = assessmentInfo;

      const completedTasks = _filter(assessmentInfo, (task) => task.completedOn)
      totalGames.value = assessmentInfo.length;
      completeGames.value = completedTasks.length;
    } else {
      noGamesAvailable.value = true
    }
    

}

onMounted(async () => {
  if(isFirekitInit.value){
    await setUpAssignments();
  } else {
    console.log('[onMounted] firekit isnt ready!')
  }
})
watch(isFirekitInit, async (newValue, oldValue) => {
  await setUpAssignments();
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