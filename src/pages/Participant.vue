<template>
  <div>
    <div v-if="!noGamesAvailable || consentSpinner">
      <div v-if="loadingGames || consentSpinner" class="loading-container">
        <AppSpinner style="margin-bottom: 1rem;" />
        <span>Loading Assignments</span>
      </div>
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

const authStore = useAuthStore();
const { isFirekitInit, firekitUserData, roarfirekit, consentSpinner } = storeToRefs(authStore);

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
async function setUpAssignments(assignedAssignments, useUnsubscribe = false) {
  noGamesAvailable.value = false;
  loadingGames.value = true;
  if (useUnsubscribe && unsubscribe) {
    unsubscribe();
  }

  // const assignedAssignments = _get(roarfirekit.value, "currentAssignments.assigned");
  let assignmentInfo = [];
  let allAdminInfo = [];
  try {
    // This if statement is important to prevent overwriting the session storage cache.
    if (assignedAssignments.length > 0) {
      assignmentInfo = await authStore.getAssignments(assignedAssignments);
      allAdminInfo = await authStore.getAdministration(assignedAssignments);
    }
  } catch (e) {
    // Could not grab data from live roarfirekit, user cached firekit.
    if (authStore.firekitAssignments) {
      assignmentInfo = authStore.firekitAssignments
      allAdminInfo = authStore.firekitAdminInfo
    } else {
      noGamesAvailable.value = true;
    }
  }
  if (assignmentInfo.length > 0) {
    const assessmentInfo = _get(_head(assignmentInfo), 'assessments');
    assessments.value = assessmentInfo;

    const adminInfo = _head(toRaw(allAdminInfo))
    isSequential.value = _get(adminInfo, 'sequential')
    studentInfo.value.grade = (
      _get(roarfirekit.value, 'userData.studentData.grade')
      || _get(firekitUserData.value, 'studentData.grade')
    );

    const completedTasks = _filter(assessmentInfo, (task) => task.completedOn)
    totalGames.value = assessmentInfo.length;
    completeGames.value = completedTasks.length;
    noGamesAvailable.value = false;
  } else {
    // authStore.firekitAssignmentIds = assignedAssignments;
    noGamesAvailable.value = true
  }
  loadingGames.value = false;
}

onMounted(async () => {
  if (isFirekitInit.value) {
    const assignedAssignments = _get(roarfirekit.value, "currentAssignments.assigned");
    await setUpAssignments(assignedAssignments);
  }
})

watch(isFirekitInit, async (newValue, oldValue) => {
  await setUpAssignments(authStore.roarfirekit.currentAssignments?.assigned);
})

watch(assessments, (newValue, oldValue) => {
  loadingGames.value = false
})

unsubscribe = watch(() => roarfirekit.value, async (newValue) => {
  const newCurrentAssignments = toRaw(newValue.currentAssignments)?.assigned;
  const oldCurrentAssignments = toRaw(authStore.firekitAssignmentIds);
  if (newCurrentAssignments && !_isEqual(newCurrentAssignments, oldCurrentAssignments)) {
    await setUpAssignments(newCurrentAssignments, true);
  }
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

.loading-container {
  width: 100%;
  text-align: center;
}
</style>