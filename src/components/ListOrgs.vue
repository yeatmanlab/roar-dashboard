<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :actions="sidebarActions" />
    </aside>
    <section class="main-body">
      <Panel header="Your organizations">
        <template #icons>
          <button class="p-panel-header-icon p-link mr-2" @click="refresh">
            <span :class="spinIcon"></span>
          </button>
        </template>

        <TreeTable :value="hierarchicalAdminOrgs" scrollable :rowHover="true" tableStyle="min-width: 50rem"
          sortMode="multiple" removableSort resizableColumns :paginator="true" :alwaysShowPaginator="false" :rows="10"
          :rowsPerPageOptions="[5, 10, 25]">
          <Column field="name" header="Name" sortable expander></Column>
          <Column field="orgType" header="Type" sortable></Column>
          <Column field="abbreviation" header="Abbreviation" sortable></Column>
          <Column field="ncesId" header="NCES ID" sortable></Column>
          <Column field="address.formattedAddress" header="Address" sortable></Column>
          <Column field="grade" header="Grade" sortable style="width: 7rem;"></Column>
          <Column field="tags" header="Tags" style="min-width: 10rem;">
            <template #body="{ node }">
              <Chip v-for="(tag, index) in node.data.tags" :label="tag" :key="index" icon="pi pi-tag" class="m-1" />
            </template>
          </Column>
          <Column field="" header="" #body="{ node }">
            <router-link :to="{ name: 'ListUsers', params: { orgType: node.data.orgType, orgId: node.data.id } }">
              <Button label="View users" />
            </router-link>
          </Column>
        </TreeTable>
      </Panel>
    </section>
  </main>
</template>

<script setup>
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { useQueryStore } from "@/store/query";
import { useAuthStore } from "@/store/auth";
import _isEmpty from "lodash/isEmpty";
import _union from "lodash/union";
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import { getSidebarActions } from "../router/sidebarActions";

const queryStore = useQueryStore();
const authStore = useAuthStore();
const { adminOrgs, hierarchicalAdminOrgs } = storeToRefs(queryStore);

const sidebarActions = ref(getSidebarActions(authStore.isUserSuperAdmin(), true));

const refreshing = ref(false);
const spinIcon = computed(() => {
  if (refreshing.value) return "pi pi-spin pi-spinner";
  return "pi pi-refresh";
});

let unsubscribe;

const refresh = async () => {
  refreshing.value = true;
  if (unsubscribe) unsubscribe();
  queryStore.getAdminOrgs().then(() => {
    refreshing.value = false;
  });
}

if (_isEmpty(_union(...Object.values(adminOrgs.value)))) {
  unsubscribe = authStore.$subscribe(async (mutation, state) => {
    if (state.roarfirekit.getOrgs && state.roarfirekit.isAdmin()) {
      await refresh();
    }
  });
}
</script> 

<style lang="scss">
.hide {
  display: none;
}
</style>
