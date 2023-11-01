<template>
  <div>
    {{ authStore.uid }}
    <div v-if="!noGamesAvailable || consentSpinner">
      <div v-if="loadingGames || consentSpinner" class="loading-container">
        <AppSpinner style="margin-bottom: 1rem;" />
        <span>Loading Assignments</span>
      </div>
      <div v-else>
        <div v-if="allAdminInfoQ.length > 1" class="p-float-label dropdown-container">
          <Dropdown :options="allAdminInfoQ" v-model="selectedAdmin" optionLabel="name" optionValue="id"
            inputId="dd-assignment" />
          <label for="dd-assignment">Select an assignment</label>
        </div>
        <div class="tabs-container">
          <ParticipantSidebar :total-games="totalGames" :completed-games="completeGames" :student-info="studentInfo" />
          <GameTabs :games="assessments" :sequential="isSequential" />
        </div>
      </div>
    </div>
    <div v-else>
      <div class="col-full text-center">
        <h1>You have no assignments!</h1>
        <p class="text-center">Please contact your administrator to get added to an assignment.</p>
        <router-link :to="{ name: 'SignOut' }">
          <Button label="Sign out" icon="pi pi-sign-out" />
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch, toRaw, computed } from "vue";
import GameTabs from "../components/GameTabs.vue";
import ParticipantSidebar from "../components/ParticipantSidebar.vue";
import _filter from 'lodash/filter'
import _get from 'lodash/get'
import _map from 'lodash/map'
import _head from 'lodash/head'
import _find from 'lodash/find'
import _isEmpty from 'lodash/isEmpty'
import _isEqual from 'lodash/isEqual'
import _intersectionWith from 'lodash/intersectionWith'
import { useAuthStore } from "@/store/auth";
import { useGameStore } from "@/store/game";
import { storeToRefs } from 'pinia';
import { useQuery } from '@tanstack/vue-query';
import { fetchDocById, fetchDocsById } from "../helpers/query/utils";
import { getUserAssignments } from "../helpers/query/assignments";

const authStore = useAuthStore();
const { isFirekitInit, firekitUserData, roarfirekit, consentSpinner } = storeToRefs(authStore);

let assignmentInfo = ref([]);
let allAdminInfo = ref([]);

const loadingGames = ref(true)
const noGamesAvailable = ref(false)

const { isLoading: isLoadingUserData, isFetching: isFetchingUserData, data: userDataQ } = 
  useQuery({
    queryKey: ['userData', 'self'],
    queryFn: () => fetchDocById('users', authStore.uid),
    keepPreviousData: true,
    enabled: true,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })

const { isLoading: isLoadingAssignments, isFetching: isFetchingAssignments, data: assignmentInfoQ } = 
  useQuery({
    queryKey: ['assignments', authStore.uid],
    queryFn: () => getUserAssignments(authStore.uid),
    keepPreviousData: true,
    enabled: true,
    staleTime: 5 * 60 * 1000 // 5 min
  })
const { isLoading: isLoadingAdmins, isFetching: isFetchingAdmins, data: allAdminInfoQ } =
  useQuery({
    queryKey: ['administrations'],
    queryFn: () => fetchDocsById(assignmentInfoQ.value.map((assignment) => {
      const assignmentId = assignment.id;
      console.log('adminid:', assignmentId)
      return {
        collection: 'administrations',
        docId: assignmentId,
        select: ['name', 'sequential']
      }
    })),
    keepPreviousData: true,
    enabled: true,
    staleTime: 5 * 60 * 1000,
  })

// Assessments to populate the game tabs.
//   Generated based on the current selected admin Id
let assessments = computed(() => {
  const gameAssessments = _get(_find(assignmentInfoQ.value, assignment => {
    console.log('assessments current', assignment)
    return assignment.id === selectedAdmin.value
  }), 'assessments') ?? []


  // This logic should be rewritten later where selectedAdmin has the assessments so we don't need to find it again.
  const fullAdmin = allAdminInfo.value.find(admin => admin.id === selectedAdmin.value)

  if (fullAdmin) {
    const assessmentsWithVariantParams = fullAdmin.assessments

    // cross check gameAssessments id with assessmentsWithVariantParams id and add variantURL to gameAssessments object
    _intersectionWith(gameAssessments, assessmentsWithVariantParams, (a, b) => {
      if (a.taskId === b.taskId) {
        a.taskData.variantURL = b.params?.variantURL || ""
      }
    })
  }

  return gameAssessments
});


// Grab the sequential key from the current admin's data object
const isSequential = computed(() => {
  return _get(_find(allAdminInfoQ.value, admin => {
    return admin.id === selectedAdmin.value
  }), 'sequential') ?? true
})

// Total games completed from the current list of assessments
let totalGames = computed(() => {
  return assessments.value.length ?? 0
});

// Total games included in the current assessment
let completeGames = computed(() => {
  return _filter(assessments.value, (task) => task.completedOn).length ?? 0
});

// Set up studentInfo for sidebar
const studentInfo = ref({
  grade: _get(roarfirekit.value, 'userData.studentData.grade') || _get(firekitUserData.value, 'studentData.grade'),
});

const gameStore = useGameStore();
const { selectedAdmin } = storeToRefs(gameStore);

let unsubscribe;
async function setUpAssignments(assignedAssignments, useUnsubscribe = false) {
  noGamesAvailable.value = false;
  loadingGames.value = true;
  if (useUnsubscribe && unsubscribe) {
    unsubscribe();
  }

  try {
    // This if statement is important to prevent overwriting the session storage cache.
    if (assignedAssignments.length > 0) {
      assignmentInfo.value = await authStore.getAssignments(assignedAssignments);
      allAdminInfo.value = await authStore.getAdministration(assignedAssignments);
      const assignmentOptions = _map(assignedAssignments, adminId => {
        return {
          label: _get(_find(allAdminInfo.value, admin => admin.id === adminId), 'name'),
          value: adminId,
        }
      })

      // If the selectedAdmin that we retrieved from storeToRefs is empty or not
      // in the list of available administrations, pick a new one.
      if (selectedAdmin.value === "" || !assignedAssignments.includes(selectedAdmin.value)) {
        selectedAdmin.value = _head(assignmentOptions).value
      }
    }
  } catch (e) {
    // Could not grab data from live roarfirekit, user cached firekit.
    if (authStore.firekitAssignments) {
      assignmentInfo.value = authStore.firekitAssignments
      allAdminInfo.value = authStore.firekitAdminInfo
      const assignmentOptions = _map(authStore.firekitAssignmentIds, adminId => {
        return {
          label: _get(_find(allAdminInfo.value, admin => admin.id === adminId), 'name'),
          value: adminId,
        }
      })

      // Likewise, if the selectedAdmin that we retrieved from storeToRefs is empty or not
      // in the list of available administrations, pick a new one.
      if (selectedAdmin.value === "" || !authStore.firekitAssignmentIds.includes(selectedAdmin.value)) {
        selectedAdmin.value = _head(assignmentOptions).value
      }
    } else {
      noGamesAvailable.value = true;
    }
  }
  if (assignmentInfo.value.length > 0) {
    studentInfo.value.grade = (
      _get(roarfirekit.value, 'userData.studentData.grade')
      || _get(firekitUserData.value, 'studentData.grade')
    );
    noGamesAvailable.value = false;
  } else {
    noGamesAvailable.value = true
  }
  loadingGames.value = false;
}

onMounted(async () => {
  if (isFirekitInit.value) {
    // const assignedAssignments = _get(roarfirekit.value, "currentAssignments.assigned");
    // const assignedAssignments = await getUserAssignments(userDataQ.value.id);
    const assignedAssignments = await getUserAssignments(authStore.uid);
    // assignmentInfo.value = assignedAssignments
    allAdminInfo.value = assignedAssignments
    console.log('found assignments', assignedAssignments)
    await setUpAssignments(assignedAssignments);
  }
})

watch(isFirekitInit, async (newValue, oldValue) => {
  // const assignmentsAssigned = getUserAssignments(userDataQ.id);
  // console.log('found assignments', assignedAssignments)
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

.dropdown-container {
  margin-top: 2rem;
  margin-left: 2rem;
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