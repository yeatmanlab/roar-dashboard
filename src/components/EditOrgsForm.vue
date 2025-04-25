<template>
  <div class="flex flex-column gap-3">
    <div class="form-container">
      <div class="form-field w-full">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">Name</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ serverOrgData.name ?? 'None' }}</div>
        <PvInputText v-else v-model="localOrgData.name" />
      </div>
      <div class="form-field w-full">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">Abbreviation</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ serverOrgData.abbreviation ?? 'None' }}</div>
        <PvInputText v-else v-model="localOrgData.abbreviation" />
      </div>
    </div>
    <div class="form-field">
      <label :class="{ 'font-light uppercase text-sm': !editMode }">Address</label>
      <div class="p-inputgroup">
        <span class="p-inputgroup-addon">
          <i class="pi pi-map"></i>
        </span>
        <GMapAutocomplete
          :placeholder="localOrgData.address?.formattedAddress ?? 'Enter an address'"
          :options="{
            fields: ['address_components', 'formatted_address', 'place_id', 'url'],
          }"
          class="p-inputtext p-component w-full"
          data-cy="input-address"
          @place_changed="setAddress"
        >
        </GMapAutocomplete>
      </div>
    </div>
    <div v-if="orgType === 'districts'" class="form-field">
      <label :class="{ 'font-light uppercase text-sm': !editMode }">NCES ID</label>
      <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ serverOrgData.ncesId ?? 'None' }}</div>
      <PvInputText v-else v-model="localOrgData.ncesId" />
    </div>
    <div class="form-field">
      <label :class="{ 'font-light uppercase text-sm': !editMode }">Tags</label>
      <PvChips v-model="localOrgData.tags" />
    </div>
    <div>
      <PvCheckbox v-model="localOrgData.testData" binary />
      <label class="ml-1">Test Data</label>
    </div>
    <div>
      <PvCheckbox v-model="localOrgData.demoData" binary />
      <label class="ml-1">Demo Data</label>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted, watch } from 'vue';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import { fetchDocById } from '@/helpers/query/utils';
import { useQuery } from '@tanstack/vue-query';
import PvChips from 'primevue/chips';
import PvCheckbox from 'primevue/checkbox';
import PvInputText from 'primevue/inputtext';
import _isEmpty from 'lodash/isEmpty';

// NOT BEING USED

const props = defineProps({
  orgType: { type: String, required: true },
  orgId: { type: String, required: true },
  editMode: { type: Boolean, default: true },
});

// +------------+
// | Initialize |
// +------------+
const initialized = ref(false);
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const emit = defineEmits(['modalClosed', 'update:orgData']);

// +----------------------------+
// | Query for existing orgData |
// +----------------------------+
const { data: serverOrgData } = useQuery({
  queryKey: ['org', props.orgType, props.orgId],
  queryFn: () => fetchDocById(props.orgType, props.orgId),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// +-------------+
// | Local State |
// +-------------+
const localOrgData = ref({
  name: null,
  abbreviation: null,
  address: null,
  ncesId: null,
  tags: [],
  testData: false,
  demoData: false,
});

const setupOrgData = (orgData) => {
  let org = {
    name: orgData?.name ?? '',
    abbreviation: orgData?.abbreviation ?? '',
    address: orgData?.address ?? '',
    ncesId: orgData?.ncesId ?? '',
    tags: orgData?.tags ?? [],
    testData: orgData?.testData ?? false,
    demoData: orgData?.demoData ?? false,
  };
  localOrgData.value = org;
};

const setAddress = (place) => {
  localOrgData.value.address = {
    addressComponents: place.address_components || [],
    formattedAddress: place.formatted_address,
    googlePlacesId: place.place_id,
    googleMapsUrl: place.url,
  };
};

watch(
  () => serverOrgData,
  (orgData) => {
    if (!_isEmpty(orgData)) {
      setupOrgData(orgData.value);
    }
  },
  { deep: true, immediate: false },
);

// +--------------------+
// | Initialize firekit |
// +--------------------+
let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit?.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value?.restConfig) init();
  if (!_isEmpty(serverOrgData.value)) setupOrgData(serverOrgData.value);
});

// +---------------------+
// | Handle update event |
// +---------------------+
watch(
  () => localOrgData,
  (orgData) => {
    emit('update:orgData', orgData.value);
  },
  { deep: true, immediate: false },
);
</script>
<style>
.form-container {
  display: flex;
  flex-direction: row;
  gap: 1rem;
  width: 100%;
}
.form-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}
.form-field {
  display: flex;
  flex-direction: column;
}
/* Styles for PvChips */
.p-chips > ul {
  width: 100%;
}

.p-chips-token {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  background: var(--primary-color);
  padding: 0.25rem;
  border-radius: 0.35rem;
  color: white;
  margin: 0.05rem;
}

.p-chips-token-icon,
g {
  margin-left: 0.5rem;
  color: white;
}

/*
  Puts the google places autocomplete dropdown results above modal.
  Modal: 1101, Google places autocomplete: 1150
*/
.pac-container {
  z-index: 1150 !important;
}
</style>
