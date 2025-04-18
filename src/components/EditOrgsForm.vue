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
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import type { Ref } from 'vue';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import { fetchDocById } from '@/helpers/query/utils';
import { useQuery } from '@tanstack/vue-query';
import type { UseQueryResult } from '@tanstack/vue-query';
import PvChips from 'primevue/chips';
import PvCheckbox from 'primevue/checkbox';
import PvInputText from 'primevue/inputtext';
import _isEmpty from 'lodash/isEmpty';

// Interfaces
interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface Address {
  addressComponents?: AddressComponent[];
  formattedAddress?: string;
  googlePlacesId?: string;
  googleMapsUrl?: string;
}

interface OrgData {
  id?: string; // Assuming an ID might exist
  name: string | null;
  abbreviation: string | null;
  address: Address | null;
  ncesId: string | null;
  tags: string[];
  testData: boolean;
  demoData: boolean;
}

interface Props {
  orgType: string;
  orgId: string;
  editMode?: boolean;
}

// Define Props with defaults
const props = withDefaults(defineProps<Props>(), {
  editMode: true,
});

// +------------+
// | Initialize |
// +------------+
const initialized: Ref<boolean> = ref(false);
const authStore = useAuthStore(); // Assuming useAuthStore returns typed store or needs assertion
const { roarfirekit } = storeToRefs(authStore);

const emit = defineEmits<{ (e: 'modalClosed'): void; (e: 'update:orgData', orgData: OrgData): void }>();

// +----------------------------+
// | Query for existing orgData |
// +----------------------------+
// Specify the expected return type for useQuery
const { data: serverOrgData }: UseQueryResult<OrgData, Error> = useQuery({
  queryKey: ['org', props.orgType, props.orgId],
  queryFn: () => fetchDocById<OrgData>(props.orgType, props.orgId), // Assume fetchDocById is generic
  keepPreviousData: true,
  enabled: initialized, // Query runs when initialized becomes true
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// +-------------+
// | Local State |
// +-------------+
const localOrgData: Ref<OrgData> = ref({
  name: null,
  abbreviation: null,
  address: null,
  ncesId: null,
  tags: [],
  testData: false,
  demoData: false,
});

// Explicitly type the orgData parameter
const setupOrgData = (orgData: OrgData | null | undefined): void => {
  // Ensure we handle null/undefined gracefully
  const defaultOrg: OrgData = {
    name: '',
    abbreviation: '',
    address: null,
    ncesId: '',
    tags: [],
    testData: false,
    demoData: false,
  };
  localOrgData.value = {
    name: orgData?.name ?? defaultOrg.name,
    abbreviation: orgData?.abbreviation ?? defaultOrg.abbreviation,
    address: orgData?.address ?? defaultOrg.address,
    ncesId: orgData?.ncesId ?? defaultOrg.ncesId,
    tags: orgData?.tags ?? defaultOrg.tags,
    testData: orgData?.testData ?? defaultOrg.testData,
    demoData: orgData?.demoData ?? defaultOrg.demoData,
  };
};

// Type the place parameter (assuming structure from Google Places API)
interface PlaceResult {
  address_components?: AddressComponent[];
  formatted_address?: string;
  place_id?: string;
  url?: string;
}

const setAddress = (place: PlaceResult): void => {
  localOrgData.value.address = {
    addressComponents: place.address_components || [],
    formattedAddress: place.formatted_address,
    googlePlacesId: place.place_id,
    googleMapsUrl: place.url,
  };
};

// Watcher for server data changes
watch(
  serverOrgData, // Directly watch the ref returned by useQuery
  (newOrgData) => {
    if (!_isEmpty(newOrgData)) {
      setupOrgData(newOrgData);
    }
  },
  { deep: true, immediate: false }, // immediate might be needed if setupOrgData should run on mount
);

// +--------------------+
// | Initialize firekit |
// +--------------------+
let unsubscribe: (() => void) | undefined;
const init = (): void => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

// Use type assertion for potentially untyped store state
unsubscribe = authStore.$subscribe((mutation, state) => {
  if ((state as any).roarfirekit?.restConfig) init();
});

onMounted(() => {
  // Use type assertion for potentially untyped ref value
  if ((roarfirekit.value as any)?.restConfig) init();
  // Run setupOrgData on mount if data is already available
  if (!_isEmpty(serverOrgData.value)) {
      setupOrgData(serverOrgData.value);
  }
});

// +---------------------+
// | Handle update event |
// +---------------------+
watch(
  localOrgData, // Watch the ref directly
  (newOrgData) => {
    // Emit the value of the ref
    emit('update:orgData', newOrgData);
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
