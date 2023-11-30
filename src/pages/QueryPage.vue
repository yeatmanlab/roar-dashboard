<template>
  <div>
    <div v-if="authStore.isAuthenticated">
      <PvAccordion v-if="authStore.canRead" v-model:activeIndex="activeTab" class="accordion-custom">
        <PvAccordionTab v-focustrap>
          <template #header>
            <i class="pi pi-filter mr-2"></i>
            <span>Query Filters</span>
          </template>
          <QueryRuns />
        </PvAccordionTab>
        <PvAccordionTab>
          <template #header>
            <i class="pi pi-table mr-2"></i>
            <PvBadge v-if="queryStore.runsReady" class="mr-2" :value="queryStore.nRuns" />
            <span>Runs</span>
          </template>
          <TableRunResults />
        </PvAccordionTab>
      </PvAccordion>
      <RequestPermission v-else />
    </div>
    <div v-else class="col-full text-center">
      <p>You are not yet logged in. Click below to log in.</p>
      <router-link :to="{ name: 'Login' }">
        <PvButton label="Log In" icon="pi pi-sign-in" />
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { useQueryStore } from '@/store/query';
import QueryRuns from '@/components/query/QueryRuns.vue';
import TableRunResults from '@/components/query/TableRunResults.vue';
import RequestPermission from '@/components/auth/RequestPermission.vue';

const authStore = useAuthStore();
const queryStore = useQueryStore();

const { activeTab } = storeToRefs(queryStore);
</script>

<style scoped></style>
