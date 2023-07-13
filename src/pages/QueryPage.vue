<template>
  <div>
    <div v-if="authStore.homepageReady">
      <div v-if="authStore.isUserAuthed()">
        <Accordion v-if="authStore.canRead" v-model:activeIndex="activeTab" class="accordion-custom">
          <AccordionTab v-focustrap>
            <template #header>
              <i class="pi pi-filter mr-2"></i>
              <span>Query Filters</span>
            </template>
            <QueryRuns />
          </AccordionTab>
          <AccordionTab>
            <template #header>
              <i class="pi pi-table mr-2"></i>
              <Badge v-if="queryStore.runsReady" class="mr-2" :value="queryStore.nRuns" />
              <span>Runs</span>
            </template>
            <TableRunResults />
          </AccordionTab>
        </Accordion>
        <RequestPermission v-else />
      </div>
      <div v-else class="col-full text-center">
        <p>You are not yet logged in. Click below to log in.</p>
        <router-link :to="{ name: 'Login' }">
          <Button label="Log In" icon="pi pi-sign-in" />
        </router-link>
      </div>
    </div>
    <AppSpinner v-else />
  </div>
</template>

<script setup>
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/store/auth";
import { useQueryStore } from "@/store/query";
import QueryRuns from '@/components/query/QueryRuns.vue';
import TableRunResults from '@/components/query/TableRunResults.vue';
import RequestPermission from '@/components/auth/RequestPermission.vue';

const authStore = useAuthStore();
const queryStore = useQueryStore();

const { activeTab } = storeToRefs(queryStore);
</script>

<style scoped>

</style>
