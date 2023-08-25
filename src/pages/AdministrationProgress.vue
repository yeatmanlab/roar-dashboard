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

        <RoarDataTable v-else :data="tableData" :columns="columns" />
      </Panel>
    </section>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import _capitalize from 'lodash/capitalize';
import { useAuthStore } from '@/store/auth';
import { useQueryStore } from '@/store/query';
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import { getSidebarActions } from "@/router/sidebarActions";

const authStore = useAuthStore();
const queryStore = useQueryStore();

const { getAdministrationInfo, getOrgInfo } = storeToRefs(queryStore);
const orgInfo = ref(getOrgInfo.value(props.orgType, props.orgId));
const administrationInfo = ref(getAdministrationInfo.value(props.administrationId));

const sidebarActions = ref(getSidebarActions(authStore.isUserSuperAdmin(), true));

const props = defineProps({
  administrationId: String,
  orgType: String,
  orgId: String,
});

const refreshing = ref(true);
const spinIcon = computed(() => {
  if (refreshing.value) return "pi pi-spin pi-spinner";
  return "pi pi-refresh";
});

const assignmentData = ref([]);

const columns = computed(() => {
  const tableColumns = [
    { field: "user.name.first", header: "First Name", dataType: "text" },
    { field: "user.name.last", header: "Last Name", dataType: "text" },
    { field: "user.assessmentPid", header: "PID", dataType: "text" },
  ];

  if (tableData.value.length > 0) {
    for (const taskId of Object.keys(tableData.value[0].status)) {
      tableColumns.push({
        field: `status.${taskId}.value`,
        header: taskId.toUpperCase(),
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
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.getUsersByAssignment && state.roarfirekit.isAdmin()) {
    await refresh();
  }
});

</script>

<style>
.p-button {
  margin: 0px 8px;
}
</style>
