<template>
  <div class="flex flex-column gap-3">
    <div class="form-container">
      <div class="form-field w-full">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">Name</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ serverOrgData?.name ?? 'None' }}</div>
        <PvInputText v-else v-model="localOrgData.name" />
      </div>
      <div v-if="showAbbreviation" class="form-field w-full">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">Abbreviation</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ serverOrgData?.abbreviation ?? 'None' }}</div>
        <PvInputText v-else v-model="localOrgData.abbreviation" />
      </div>
    </div>
    <div class="form-field">
      <label :class="{ 'font-light uppercase text-sm': !editMode }">
        <span> <i class="pi pi-map"></i></span> Address
      </label>
      <div class="p-inputgroup">
        <GMapAutocomplete
          :placeholder="addressPlaceholder"
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
    <div v-if="showNcesId" class="form-field">
      <label :class="{ 'font-light uppercase text-sm': !editMode }">NCES ID</label>
      <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ serverOrgData?.ncesId ?? 'None' }}</div>
      <PvInputText v-else v-model="localOrgData.ncesId" />
    </div>
  </div>
</template>
<script setup>
import { ref, computed, watch } from 'vue';
import PvInputText from 'primevue/inputtext';
import _isEmpty from 'lodash/isEmpty';
import useOrgQuery from '@/composables/queries/useOrgQuery';
import { singularizeFirestoreCollection } from '@/helpers';
import { ORG_TYPES } from '@/constants/orgTypes';

const props = defineProps({
  orgType: { type: String, required: true },
  orgId: { type: String, required: true },
  editMode: { type: Boolean, default: true },
});

const emit = defineEmits(['modalClosed', 'update:orgData']);

// +----------------------------+
// | Query for existing orgData |
// +----------------------------+
// Read the org through the migrated by-id composable (ts-rest backend) rather
// than Firestore. `useOrgQuery` dispatches by the SINGULAR org type, while this
// component receives the PLURAL type from OrgsList's active tab. The composable
// gates internally on `authStore.accessToken`, so no firekit/init machinery is
// needed here. We select the single org out of the returned array.
const singularOrgType = computed(() => singularizeFirestoreCollection(props.orgType));
const orgIds = computed(() => [props.orgId]);

const { data: serverOrgData } = useOrgQuery(singularOrgType.value, orgIds, {
  select: (data) => data?.[0],
});

// Per-org-type fields. Classes have no `abbreviation` (their update schema omits
// it), so the input is hidden for them. NCES ID is surfaced for districts only,
// matching the legacy form.
const showAbbreviation = computed(() => props.orgType !== ORG_TYPES.CLASSES);
const showNcesId = computed(() => props.orgType === ORG_TYPES.DISTRICTS);

// +-------------+
// | Local State |
// +-------------+
// `address` starts null and is only populated when the user picks a new place
// via `setAddress`. The current address is shown via the autocomplete
// placeholder (`addressPlaceholder`), built from the org's structured location.
const localOrgData = ref({
  name: null,
  abbreviation: null,
  address: null,
  ncesId: null,
});

// Human-readable rendering of the org's current structured location, used as
// the autocomplete placeholder so the existing address is visible. The backend
// org (via `mapOrg`) flattens `location` to top-level fields, so we read those.
const addressPlaceholder = computed(() => {
  const org = serverOrgData.value;
  const display = [org?.addressLine1, org?.city, org?.stateProvince, org?.postalCode].filter(Boolean).join(', ');
  return display || 'Enter an address';
});

const setupOrgData = (orgData) => {
  localOrgData.value = {
    name: orgData?.name ?? '',
    abbreviation: orgData?.abbreviation ?? '',
    address: null,
    ncesId: orgData?.ncesId ?? '',
  };
};

const setAddress = (place) => {
  localOrgData.value.address = {
    addressComponents: place.address_components || [],
    formattedAddress: place.formatted_address,
    googlePlacesId: place.place_id,
    googleMapsUrl: place.url,
  };
};

// Seed the editable fields from the org once it loads (and on subsequent
// refetches). `immediate` covers the case where the query already has data.
watch(
  serverOrgData,
  (orgData) => {
    if (!_isEmpty(orgData)) {
      setupOrgData(orgData);
    }
  },
  { immediate: true },
);

// +---------------------+
// | Handle update event |
// +---------------------+
watch(
  localOrgData,
  (orgData) => {
    emit('update:orgData', orgData);
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

/*
  Puts the google places autocomplete dropdown results above modal.
  Modal: 1101, Google places autocomplete: 1150
*/
.pac-container {
  z-index: 1150 !important;
}
</style>
