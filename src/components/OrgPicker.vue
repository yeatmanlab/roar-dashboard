<template>
  <div class="grid">
    <div class="col-12 md:col-6">
      <PvPanel class="m-0 p-0" header="Select organizations here">
        <PvTabView v-if="claimsLoaded" v-model:activeIndex="activeIndex" class="m-0 p-0" lazy>
          <PvTabPanel v-for="orgType in orgHeaders" :key="orgType" :header="orgType.header">
            <div class="grid column-gap-3">
              <div
                v-if="activeOrgType === 'schools' || activeOrgType === 'classes'"
                class="col-6 md:col-5 lg:col-5 xl:col-5 mt-3"
              >
                <span class="p-float-label">
                  <PvDropdown
                    id="district"
                    v-model="selectedDistrict"
                    input-id="district"
                    :options="allDistricts"
                    option-label="name"
                    option-value="id"
                    :placeholder="districtPlaceholder"
                    :loading="isLoadingDistricts"
                    class="w-full"
                    data-cy="dropdown-selected-district"
                  />
                  <label for="district">Select from district</label>
                </span>
              </div>
              <div v-if="orgType.id === 'classes'" class="col-6 md:col-5 lg:col-5 xl:col-5 mt-3">
                <span class="p-float-label">
                  <PvDropdown
                    id="school"
                    v-model="selectedSchool"
                    input-id="school"
                    :options="allSchools"
                    option-label="name"
                    option-value="id"
                    :placeholder="schoolPlaceholder"
                    :loading="isLoadingSchools"
                    class="w-full"
                    data-cy="dropdown-selected-school"
                  />
                  <label for="school">Select from school</label>
                </span>
              </div>
            </div>
            <div class="card flex justify-content-center">
              <PvListbox
                v-model="selectedOrgs[activeOrgType]"
                :options="orgData"
                multiple
                :meta-key-selection="false"
                option-label="name"
                class="w-full"
                list-style="max-height:20rem"
              >
                <template #option="slotProps">
                  <div class="flex align-items-center">
                    <PvCheckbox :binary="true" :model-value="isSelected(activeOrgType, slotProps.option.id)" />
                    <div class="ml-2">{{ slotProps.option.name }}</div>
                  </div>
                </template>
              </PvListbox>
            </div>
          </PvTabPanel>
        </PvTabView>
      </PvPanel>
    </div>
    <div class="col-12 md:col-6">
      <PvPanel class="h-full" header="Selected organizations">
        <PvScrollPanel style="width: 100%; height: 26rem">
          <div v-for="orgKey in Object.keys(selectedOrgs)" :key="orgKey">
            <div v-if="selectedOrgs[orgKey].length > 0">
              <b>{{ _capitalize(orgKey) }}:</b>
              <PvChip
                v-for="org in selectedOrgs[orgKey]"
                :key="org.id"
                class="m-1 surface-200 p-2 text-black border-round"
                removable
                :label="org.name"
                @remove="remove(org, orgKey)"
              />
            </div>
          </div>
        </PvScrollPanel>
      </PvPanel>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import _capitalize from 'lodash/capitalize';
import _get from 'lodash/get';
import _head from 'lodash/head';
import { useAuthStore } from '@/store/auth';
import { orgFetcher, orgFetchAll } from '@/helpers/query/orgs';
import { fetchDocById, orderByDefault } from '@/helpers/query/utils';

const initialized = ref(false);
const authStore = useAuthStore();
const { roarfirekit, uid } = storeToRefs(authStore);

const selectedDistrict = ref(undefined);
const selectedSchool = ref(undefined);

const props = defineProps({
  orgs: {
    type: Object,
    required: false,
    default: () => {
      return {
        districts: [],
        schools: [],
        classes: [],
        groups: [],
        families: [],
      };
    },
  },
});

const selectedOrgs = reactive({
  districts: [],
  schools: [],
  classes: [],
  groups: [],
  families: [],
});

// Declare computed property to watch for changes in props.orgs
const computedOrgsProp = computed(() => {
  return props.orgs ?? {};
});

// Watch for changes in computedOrgsProp and update selectedOrgs
watch(
  () => computedOrgsProp.value,
  (orgs) => {
    selectedOrgs.districts = orgs.districts ?? [];
    selectedOrgs.schools = orgs.schools ?? [];
    selectedOrgs.classes = orgs.classes ?? [];
    selectedOrgs.groups = orgs.groups ?? [];
    selectedOrgs.families = orgs.families ?? [];
  },
  { immediate: true, deep: true },
);

const { isLoading: isLoadingClaims, data: userClaims } = useQuery({
  queryKey: ['userClaims', uid],
  queryFn: () => fetchDocById('userClaims', uid.value),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));
const adminOrgs = computed(() => userClaims.value?.claims?.minimalAdminOrgs);

const orgHeaders = computed(() => {
  const headers = {
    districts: { header: 'Districts', id: 'districts' },
    schools: { header: 'Schools', id: 'schools' },
    classes: { header: 'Classes', id: 'classes' },
    groups: { header: 'Groups', id: 'groups' },
  };

  if (isSuperAdmin.value) return headers;

  const result = {};
  if ((adminOrgs.value?.districts ?? []).length > 0) {
    result.districts = { header: 'Districts', id: 'districts' };
    result.schools = { header: 'Schools', id: 'schools' };
    result.classes = { header: 'Classes', id: 'classes' };
  }
  if ((adminOrgs.value?.schools ?? []).length > 0) {
    result.schools = { header: 'Schools', id: 'schools' };
    result.classes = { header: 'Classes', id: 'classes' };
  }
  if ((adminOrgs.value?.classes ?? []).length > 0) {
    result.classes = { header: 'Classes', id: 'classes' };
  }
  if ((adminOrgs.value?.groups ?? []).length > 0) {
    result.groups = { header: 'Groups', id: 'groups' };
  }
  return result;
});

const districtPlaceholder = computed(() => {
  if (isLoadingDistricts.value) {
    return 'Loading...';
  }
  return 'Select a district';
});

const schoolPlaceholder = computed(() => {
  if (isLoadingSchools.value) {
    return 'Loading...';
  }
  return 'Select a school';
});

const activeIndex = ref(0);
const activeOrgType = computed(() => {
  return Object.keys(orgHeaders.value)[activeIndex.value];
});

const claimsLoaded = computed(() => !isLoadingClaims.value);

const { isLoading: isLoadingDistricts, data: allDistricts } = useQuery({
  queryKey: ['districts'],
  queryFn: () => orgFetcher('districts', undefined, isSuperAdmin, adminOrgs),
  keepPreviousData: true,
  enabled: claimsLoaded,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const schoolQueryEnabled = computed(() => {
  return claimsLoaded.value && selectedDistrict.value !== undefined;
});

const { isLoading: isLoadingSchools, data: allSchools } = useQuery({
  queryKey: ['schools', selectedDistrict],
  queryFn: () => orgFetcher('schools', selectedDistrict, isSuperAdmin, adminOrgs),
  keepPreviousData: true,
  enabled: schoolQueryEnabled,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const { data: orgData } = useQuery({
  queryKey: ['orgs', activeOrgType, selectedDistrict, selectedSchool],
  queryFn: () =>
    orgFetchAll(activeOrgType, selectedDistrict, selectedSchool, ref(orderByDefault), isSuperAdmin, adminOrgs, [
      'id',
      'name',
      'districtId',
      'schoolId',
      'schools',
      'classes',
    ]),
  keepPreviousData: true,
  enabled: claimsLoaded,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const isSelected = (orgType, orgId) => {
  return selectedOrgs[orgType].map((org) => org.id).includes(orgId);
};

const remove = (org, orgKey) => {
  selectedOrgs[orgKey] = selectedOrgs[orgKey].filter((_org) => _org.id !== org.id);
};

let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) init();
});

watch(allDistricts, (newValue) => {
  selectedDistrict.value = _get(_head(newValue), 'id');
});

watch(allSchools, (newValue) => {
  selectedSchool.value = _get(_head(newValue), 'id');
});

const emit = defineEmits(['selection']);

watch(selectedOrgs, (newValue) => {
  emit('selection', newValue);
});
</script>

<style>
.p-checkbox-box.p-highlight {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

g {
  color: black;
}
.p-icon.p-chip-remove-icon {
  margin-left: 0.5rem;
}
</style>
