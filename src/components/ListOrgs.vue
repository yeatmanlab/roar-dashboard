<template>
  <router-link :to="{ name: 'Home' }" class="return-button">
    <Button icon="pi pi-angle-left" label="Return to Dashboard" />
  </router-link>
  <div class="card mb-4" id="rectangle">
    <div class="flex flex-row justify-content-between align-items-start">
      <div>
        <span id="heading">Your organizations</span>
      </div>
      <Button class="mr-4" icon="pi pi-refresh" severity="secondary" aria-label="Refresh" @click="getOrgs" />
    </div>

    <hr>

    <TreeTable :value="hierarchicalAdminOrgs" :paginator="true" :rows="5" :rowsPerPageOptions="[5, 10, 25]">
      <Column field="name" header="Name" expander></Column>
      <Column field="orgType" header="Type"></Column>
      <Column field="abbreviation" header="Abbreviation"></Column>
      <Column field="grade" header="Grade"></Column>
    </TreeTable>
  </div>
</template>

<script setup>
import { storeToRefs } from "pinia";
import { useQueryStore } from "@/store/query";
import { useAuthStore } from "@/store/auth";
import _isEmpty from "lodash/isEmpty";
import _union from "lodash/union";

const queryStore = useQueryStore();
const authStore = useAuthStore();
const { adminOrgs, hierarchicalAdminOrgs } = storeToRefs(queryStore);

let unsubscribe;

const getOrgs = async () => {
  if (unsubscribe) unsubscribe();
  queryStore.getAdminOrgs();
}

if (_isEmpty(_union(...Object.values(adminOrgs.value)))) {
  unsubscribe = authStore.$subscribe(async (mutation, state) => {
    if (state.roarfirekit.getOrgs && state.roarfirekit.isAdmin()) {
      await getOrgs();
    }
  });
}
</script> 

<style lang="scss">
.return-button {
  display: block;
  margin: 1rem 1.75rem;
}

#rectangle {
  background: #FCFCFC;
  border-radius: 0.3125rem;
  border-style: solid;
  border-width: 0.0625rem;
  border-color: #E5E5E5;
  margin: 0 1.75rem;
  padding-top: 1.75rem;
  padding-left: 1.875rem;
  text-align: left;
  overflow: hidden;

  hr {
    margin-top: 2rem;
    margin-left: -1.875rem;
  }

  #heading {
    font-family: 'Source Sans Pro', sans-serif;
    font-weight: 400;
    color: #000000;
    font-size: 1.625rem;
    line-height: 2.0425rem;
  }

  #section-heading {
    font-family: 'Source Sans Pro', sans-serif;
    font-weight: 400;
    font-size: 1.125rem;
    line-height: 1.5681rem;
    color: #525252;
  }

  #administration-name {
    height: 100%;
    border-radius: 0.3125rem;
    border-width: 0.0625rem;
    border-color: #E5E5E5;
  }

  #section {
    margin-top: 1.375rem;
  }

  #section-content {
    font-family: 'Source Sans Pro', sans-serif;
    font-weight: 400;
    font-size: 0.875rem;
    line-height: 1.22rem;
    color: #525252;
    margin: 0.625rem 0rem;
  }

  // .p-dropdown-label {
  //   font-family: 'Source Sans Pro', sans-serif;
  //   color: #C4C4C4;
  // }

  ::placeholder {
    font-family: 'Source Sans Pro', sans-serif;
    color: #C4C4C4;
  }

  // .p-button {
  //   width: 11.5625rem;
  //   height: 2.25rem;
  //   border-radius: 3.9375rem;
  //   margin: 1.5rem 0rem;
  //   margin-right: 1.375rem;
  //   float: right;
  // }

  .hide {
    display: none;
  }

}
</style>
