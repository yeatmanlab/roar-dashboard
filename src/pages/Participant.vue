<template>
  <div>
    <div v-if="!noGamesAvailable">
      <AppSpinner v-if="loadingGames" />
      <div v-else class="tabs-container">
        <ParticipantSidebar :total-games="totalGames" :completed-games="completeGames" :student-info="studentInfo" />
        <GameTabs :games="assessments" :sequential="isSequential" />
      </div>
    </div>
    <div v-else>
      <div class="col-full text-center">
        <h1>You have no assigments!</h1>
        <p class="text-center">Please contact your administrator to get added to an assignment.</p>
        <router-link :to="{ name: 'SignOut' }">
          <Button label="Sign out" icon="pi pi-sign-out" />
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch, toRaw } from "vue";
import GameTabs from "../components/GameTabs.vue";
import ParticipantSidebar from "../components/ParticipantSidebar.vue";
import _filter from 'lodash/filter'
import _get from 'lodash/get'
import _head from 'lodash/head'
import _isEmpty from 'lodash/isEmpty'
import _isEqual from 'lodash/isEqual'
import { useAuthStore } from "@/store/auth";
import { storeToRefs } from 'pinia';
import AppSpinner from "../components/AppSpinner.vue";

const authStore = useAuthStore();
const { isFirekitInit, firekitUserData, roarfirekit } = storeToRefs(authStore);

const loadingGames = ref(true)
const noGamesAvailable = ref(false)
let assessments = ref([]);
let isSequential = ref(true)
let totalGames = ref(0);
let completeGames = ref(0);

// Set up studentInfo for sidebar
const studentInfo = ref({
  grade: _get(roarfirekit.value, 'userData.studentData.grade') || _get(firekitUserData.value, 'studentData.grade'),
});

let unsubscribe;
async function setUpAssignments(assignedAssignments = [], useUnsubscribe = false) {
  if (useUnsubscribe && unsubscribe) {
    console.log("[watch] unsubscribing");
    unsubscribe();
  }

  // const assignedAssignments = _get(roarfirekit.value, "currentAssignments.assigned");
  console.log("assignedAssignments input: ", assignedAssignments);
  let assignmentInfo = [];
  let allAdminInfo = [];
  try {
    console.log("trying to get assignmentInfo from roarfirekit.");
    // This if statement is important to prevent overwriting the session storage cache.
    if (assignedAssignments.length > 0) {
      console.log("roarfirekit has assigned assignments.", assignedAssignments);
      assignmentInfo = await authStore.getAssignments(assignedAssignments);
      allAdminInfo = await authStore.getAdministration(assignedAssignments);
    }
  } catch (e) {
    console.log("in catch block of authStore.getAssignments()");
    // Could not grab data from live roarfirekit, user cached firekit.
    if (authStore.firekitAssignments) {
      console.log("roarfirekit has cached firekit assignments.");
      assignmentInfo = authStore.firekitAssignments
      allAdminInfo = authStore.firekitAdminInfo
      console.log("assignmentInfo from authStore.firekitAssignments: ", assignmentInfo);
    } else {
      console.log("roarfirekit has no cached firekit assignments.");
      noGamesAvailable.value = true;
    }
  }
  if (assignmentInfo.length > 0) {
    console.log("got through try/catch and assignmentInfo has length")
    const assessmentInfo = _get(_head(assignmentInfo), 'assessments');
    assessments.value = assessmentInfo;

    const adminInfo = _head(toRaw(allAdminInfo))
    isSequential.value = _get(adminInfo, 'sequential')
    // studentInfo.value.grade = (
    //   _get(roarfirekit.value, 'userData.studentData.grade')
    //   || _get(firekitUserData.value, 'studentData.grade')
    // );

    const completedTasks = _filter(assessmentInfo, (task) => task.completedOn)
    totalGames.value = assessmentInfo.length;
    completeGames.value = completedTasks.length;
    noGamesAvailable.value = false;
  } else {
    console.log("got through try/catch and assignmentInfo has length == 0")
    // authStore.firekitAssignmentIds = assignedAssignments;
    noGamesAvailable.value = true
  }
}

onMounted(async () => {
  if (isFirekitInit.value) {
    const assignedAssignments = _get(roarfirekit.value, "currentAssignments.assigned");
    await setUpAssignments(assignedAssignments);
  } else {
    console.log('[onMounted] firekit isnt ready!')
  }
})

watch(isFirekitInit, async (newValue, oldValue) => {
  await setUpAssignments(authStore.roarfirekit.currentAssignments?.assigned);
})

watch(assessments, (newValue, oldValue) => {
  loadingGames.value = false
})

unsubscribe = watch(() => roarfirekit.value, async (newValue) => {
  // const oldCurrentAssignments = toRaw(oldValue.currentAssignments).assigned;
  const newCurrentAssignments = toRaw(newValue.currentAssignments)?.assigned;
  const oldCurrentAssignments = toRaw(authStore.firekitAssignmentIds);
  console.log("[watch] roarfirekit has changed", JSON.stringify({
    newCurrentAssignments,
    oldCurrentAssignments,
  }, null, 2));
  if (!_isEqual(newCurrentAssignments, oldCurrentAssignments)) {
    console.log('[watch] roarfirekit.currentAssignments changed')
    await setUpAssignments(newCurrentAssignments, true);
  }
  // console.log("[subscription]: ", { mutation, state });
  // const currentAssignments = state.roarfirekit.currentAssignments?.assigned;
  // console.log("[subscription] outside condition, currentAssignments: ", JSON.stringify({
  //   roarfirekit: state.roarfirekit,
  //   currentAssignments: state.roarfirekit.currentAssignments,
  //   assigned: currentAssignments,
  // }, null, 2));
  // if (!_isEmpty(currentAssignments)) {
  //   console.log("[subscription] assignments has length.", currentAssignments);
  //   await setUpAssignments(currentAssignments, true);
  // }
}, { deep: true });

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