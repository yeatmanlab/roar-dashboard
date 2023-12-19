<template>
  <div>
    <div v-if="!noGamesAvailable || consentSpinner">
      <div v-if="isFetching || consentSpinner" class="loading-container">
        <AppSpinner style="margin-bottom: 1rem" />
        <span>Loading Assignments</span>
      </div>
      <div v-else>
        <div v-if="adminInfo?.length > 1" class="p-float-label dropdown-container">
          <PvDropdown v-model="selectedAdmin" :options="adminInfo ?? []" option-label="name" input-id="dd-assignment" />
          <label for="dd-assignment">Select an assignment</label>
        </div>
        <div class="tabs-container">
          <ParticipantSidebar :total-games="totalGames" :completed-games="completeGames" :student-info="studentInfo" />
          <GameTabs :games="assessments" :sequential="isSequential" :user-data="userData" />
        </div>
      </div>
    </div>
    <div v-else>
      <div class="col-full text-center">
        <h1>You have no assignments!</h1>
        <p class="text-center">Please contact your administrator to get added to an assignment.</p>
        <router-link :to="{ name: 'SignOut' }">
          <PvButton label="Sign out" icon="pi pi-sign-out" />
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch, computed } from 'vue';
import GameTabs from '../components/GameTabs.vue';
import ParticipantSidebar from '../components/ParticipantSidebar.vue';
import _filter from 'lodash/filter';
import _get from 'lodash/get';
import _head from 'lodash/head';
import _find from 'lodash/find';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import { storeToRefs } from 'pinia';
import { useQuery } from '@tanstack/vue-query';
import { fetchDocById, fetchDocsById } from '../helpers/query/utils';
import { getUserAssignments } from '../helpers/query/assignments';

let unsubscribe;
const initialized = ref(false);
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

const authStore = useAuthStore();
const { roarfirekit, consentSpinner } = storeToRefs(authStore);

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) init();
  // Find and remove the injected style tag based on its content
  
});

const gameStore = useGameStore();
const { selectedAdmin } = storeToRefs(gameStore);

const {
  isLoading: isLoadingUserData,
  isFetching: isFetchingUserData,
  data: userData,
} = useQuery({
  queryKey: ['userData', authStore.uid, authStore.userQueryKeyIndex],
  queryFn: () => fetchDocById('users', authStore.uid),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const {
  isLoading: isLoadingAssignments,
  isFetching: isFetchingAssignments,
  data: assignmentInfo,
} = useQuery({
  queryKey: ['assignments', authStore.uid, authStore.assignmentQueryKeyIndex],
  queryFn: () => getUserAssignments(authStore.uid),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 min
});

const administrationIds = computed(() => (assignmentInfo.value ?? []).map((assignment) => assignment.id));
const administrationQueryEnabled = computed(() => !isLoadingAssignments.value);

const {
  isLoading: isLoadingAdmins,
  isFetching: isFetchingAdmins,
  data: adminInfo,
} = useQuery({
  queryKey: ['administrations', administrationIds],
  queryFn: () =>
    fetchDocsById(
      administrationIds.value.map((administrationId) => {
        return {
          collection: 'administrations',
          docId: administrationId,
          select: ['name', 'sequential', 'assessments'],
        };
      }),
    ),
  keepPreviousData: true,
  enabled: administrationQueryEnabled,
  staleTime: 5 * 60 * 1000,
});

const taskIds = computed(() => (selectedAdmin.value?.assessments ?? []).map((assessment) => assessment.taskId));

const {
  isLoading: isLoadingTasks,
  isFetching: isFetchingTasks,
  data: taskInfo,
} = useQuery({
  queryKey: ['tasks', taskIds],
  queryFn: () =>
    fetchDocsById(
      taskIds.value.map((taskId) => ({
        collection: 'tasks',
        docId: taskId,
      })),
      'app',
    ),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000,
});

const isLoading = computed(() => {
  return isLoadingUserData.value || isLoadingAssignments.value || isLoadingAdmins.value || isLoadingTasks.value;
});

const isFetching = computed(() => {
  return isFetchingUserData.value || isFetchingAssignments.value || isFetchingAdmins.value || isFetchingTasks.value;
});

const noGamesAvailable = computed(() => {
  if (isFetching.value || isLoading.value) return false;
  return assessments.value.length === 0;
});

// Assessments to populate the game tabs.
// Generated based on the current selected admin Id
const assessments = computed(() => {
  console.log('Recomputing assessments');
  if (!isFetching.value && selectedAdmin.value && (taskInfo.value ?? []).length > 0) {
    console.log('Using map to combine assessment data');
    return selectedAdmin.value.assessments.map((assessment) => {
      // Get the matching assessment from assignmentInfo
      const matchingAssignment = _find(assignmentInfo.value, { id: selectedAdmin.value.id });
      const matchingAssessments = matchingAssignment?.assessments ?? [];
      const matchingAssessment = _find(matchingAssessments, { taskId: assessment.taskId });
      const combinedAssessment = {
        ...matchingAssessment,
        ...assessment,
        taskData: {
          ..._find(taskInfo.value ?? [], { id: assessment.taskId }),
          variantURL: _get(assessment, 'params.variantURL'),
        },
      };
      console.log('combinedAssessment', combinedAssessment);
      return combinedAssessment;
    });
  }
  console.log('No assessments found');
  return [];
});

// Grab the sequential key from the current admin's data object
const isSequential = computed(() => {
  return (
    _get(
      _find(adminInfo.value, (admin) => {
        return admin.id === selectedAdmin.value.id;
      }),
      'sequential',
    ) ?? true
  );
});

// Total games completed from the current list of assessments
let totalGames = computed(() => {
  return assessments.value.length ?? 0;
});

// Total games included in the current assessment
let completeGames = computed(() => {
  return _filter(assessments.value, (task) => task.completedOn).length ?? 0;
});

// Set up studentInfo for sidebar
const studentInfo = computed(() => ({ grade: _get(userData.value, 'studentData.grade') }));

watch(adminInfo, () => {
  const selectedAdminId = selectedAdmin.value?.id;
  const allAdminIds = (adminInfo.value ?? []).map((admin) => admin.id);
  // If there is no selected admin or if the selected admin is not in the list
  // of all administrations choose the first one from adminInfo
  if (allAdminIds.length > 0 && (!selectedAdminId || !allAdminIds.includes(selectedAdminId))) {
    selectedAdmin.value = _head(adminInfo.value);
  }
});
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
