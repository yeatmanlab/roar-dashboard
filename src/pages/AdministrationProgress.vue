<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :actions="sidebarActions" />
    </aside>
    <section class="main-body">
      <Panel header="Administration Progress">
        <template #icons>
          <button class="p-panel-header-icon p-link mr-2" @click="refresh">
            <span :class="spinIcon"></span>
          </button>
        </template>

        <div>
          <p v-if="orgInfo">{{ _capitalize(props.orgType) }}: {{ orgInfo.name }}</p>
          <p v-if="administrationInfo">Administration: {{ administrationInfo.name }}</p>
        </div>

        <div v-if="refreshing" class="loading-container">
          <AppSpinner style="margin-bottom: 1rem;" />
          <span>Loading Administration Data</span>
        </div>

        <RoarDataTable v-else-if="assignmentData?.length ?? 0 > 0" :data="tableData" :columns="columns" />
      </Panel>
    </section>
  </main>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import _capitalize from 'lodash/capitalize';
import _get from 'lodash/get';
import { useAuthStore } from '@/store/auth';
import { useQueryStore } from '@/store/query';
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import { getSidebarActions } from "@/router/sidebarActions";

const authStore = useAuthStore();
const queryStore = useQueryStore();

const { getAdministrationInfo, getOrgInfo } = storeToRefs(queryStore);
const orgInfo = ref(queryStore.orgInfo[props.orgId]);
const administrationInfo = ref(queryStore.administrationInfo[props.administrationId]);
const assignmentData = ref(queryStore.assignmentData[props.administrationId]);

const sidebarActions = ref(getSidebarActions(authStore.isUserSuperAdmin(), true));

const props = defineProps({
  administrationId: String,
  orgType: String,
  orgId: String,
});

const refreshing = ref(false);
const spinIcon = computed(() => {
  if (refreshing.value) return "pi pi-spin pi-spinner";
  return "pi pi-refresh";
});

const displayNames = {
  "swr": { name: "Word", order: 3 },
  "swr-es": { name: "Palabra", order: 4 },
  "pa": { name: "Phoneme", order: 2 },
  "sre": { name: "Sentence", order: 5 },
  "letter": { name: "Letter", order: 1 },
}

const columns = computed(() => {
  if (assignmentData.value === undefined) return [];

  const tableColumns = [
    { field: "user.username", header: "Username", dataType: "text", pinned: true },
    { field: "user.name.first", header: "First Name", dataType: "text" },
    { field: "user.name.last", header: "Last Name", dataType: "text" },
    { field: "user.studentData.grade", header: "Grade", dataType: "text" },
  ];

  if(props.orgType === 'district') {
    tableColumns.push({ field: "user.schoolName", header: "School", dataType: "text" });
  }
  
  if(props.orgType === 'district' || props.orgType === 'school') {
    tableColumns.push({ field: "user.className", header: "Class", dataType: "text" })
  }

  if (authStore.isUserSuperAdmin()) {
    tableColumns.push({ field: "user.assessmentPid", header: "PID", dataType: "text" });
  }

  if (tableData.value.length > 0) {
    const sortedTasks = Object.keys(tableData.value[0].status).sort((p1, p2) => {
      return displayNames[p1].order - displayNames[p2].order
    })
    for (const taskId of sortedTasks) {
      tableColumns.push({
        field: `status.${taskId}.value`,
        header: displayNames[taskId].name,
        dataType: "text",
        tag: true,
        severityField: `status.${taskId}.severity`,
        iconField: `status.${taskId}.icon`
      });
    }
  }
  return tableColumns;
});

const tableData = computed(() => {
  if (assignmentData.value === undefined) return [];

  return assignmentData.value.map(({ user, assignment }) => {
    const status = {};
    for (const assessment of (assignment?.assessments || [])) {
      if (assessment.completedOn !== undefined) {
        status[assessment.taskId] = {
          value: "completed",
          icon: "pi pi-check",
          severity: "success",
        };
      } else if (assessment.startedOn !== undefined) {
        status[assessment.taskId] = {
          value: "started",
          icon: "pi pi-exclamation-triangle",
          severity: "warning",
        };
      } else {
        status[assessment.taskId] = {
          value: "assigned",
          icon: "pi pi-times",
          severity: "danger",
        };
      }
    }
    if(props.orgType === 'district'){
      // Grab user's school list
      const currentSchools = _get(user, 'schools.current')
      if(currentSchools.length) {
        // If there is one valid school, 
        const schoolId = currentSchools[0]
        let schoolInfo;
        if(queryStore.orgInfo[schoolId]) {
          schoolInfo = queryStore.orgInfo[schoolId]
        } else {
          schoolInfo = getOrgInfo.value('school', schoolId)
          queryStore.orgInfo[schoolId] = schoolInfo
        }
        user['schoolName'] = schoolInfo.name
      }
    }
    if (props.orgType === 'district' || props.orgType === 'school') {
      const currentClasses = _get(user, 'classes.current');
      let className;
      if(currentClasses.length) {
        if(currentClasses.length === 1) {
          // If there's only one class, grab the info and save it to user doc
          const classId = currentClasses[0];
          if(queryStore.orgInfo[classId]) {
            const classInfo = queryStore.orgInfo[classId];
            className = _get(classInfo, 'name');
          } else {
            const classInfo = getOrgInfo.value('class', classId);
            queryStore.orgInfo[classId] = classInfo;
            className = _get(classInfo, 'name');
          }
        } else {
          // More than 1 current class listed
          className = '2+ classes';
        }
        user['className'] = className;
      }
    }
    return {
      user,
      assignment,
      status,
    }
  });
})

let unsubscribe;

const refresh = async () => {
  refreshing.value = true;
  if (unsubscribe) unsubscribe();

  assignmentData.value = await queryStore.getUsersByAssignment(
    props.administrationId, props.orgType, props.orgId, false
  );

  if (!orgInfo.value) {
    queryStore.getAdminOrgs();
    orgInfo.value = getOrgInfo.value(props.orgType, props.orgId);
  }
  if (!administrationInfo.value) {
    administrationInfo.value = getAdministrationInfo.value(props.administrationId);
  }
  refreshing.value = false;

  queryStore.assignmentData[props.administrationId] = assignmentData.value;
  queryStore.administrationInfo[props.administrationId] = administrationInfo.value;
  queryStore.orgInfo[props.orgId] = orgInfo.value;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.getUsersByAssignment && state.roarfirekit.isAdmin()) {
    await refresh();
  }
});

const { roarfirekit } = storeToRefs(authStore);
onMounted(async () => {
  if (roarfirekit.value.getUsersByAssignment && roarfirekit.value.isAdmin()) {
    await refresh()
  }
})
</script>

<style>
.p-button {
  margin: 0px 8px;
}
</style>
