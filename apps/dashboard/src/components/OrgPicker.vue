<template>
  <div class="grid">
    <div class="col-12 md:col-6">
      <PvPanel class="m-0 p-0 h-full" header="Select organizations here">
        <PvTabView v-model:active-index="activeIndex" class="m-0 p-0" lazy>
          <PvTabPanel v-for="orgType in orgHeaders" :key="orgType.id" :header="orgType.header">
            <div class="grid column-gap-3">
              <div
                v-if="activeOrgType === 'schools' || activeOrgType === 'classes'"
                class="col-6 md:col-5 lg:col-5 xl:col-5 mt-3"
              >
                <PvFloatLabel>
                  <PvSelect
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
                </PvFloatLabel>
              </div>
              <div v-if="orgType.id === 'classes'" class="col-6 md:col-5 lg:col-5 xl:col-5 mt-3">
                <PvFloatLabel>
                  <PvSelect
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
                </PvFloatLabel>
              </div>
            </div>
            <div v-if="error" role="alert" class="p-3">
              Unable to load organizations.
              <PvButton label="Retry" text @click="retry" />
            </div>
            <p v-else-if="isLoading || isFetching" role="status" class="p-3">Loading organizations...</p>
            <p v-else-if="!orgData.length" role="status" class="p-3">No organizations available.</p>
            <div v-else class="card flex justify-content-center">
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
                    <PvCheckbox v-model="slotProps.selected" binary />
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
import { reactive, computed, watch } from 'vue';
import _capitalize from 'lodash/capitalize';
import PvButton from 'primevue/button';
import PvFloatLabel from 'primevue/floatlabel';
import PvCheckbox from 'primevue/checkbox';
import PvChip from 'primevue/chip';
import PvSelect from 'primevue/select';
import PvListbox from 'primevue/listbox';
import PvPanel from 'primevue/panel';
import PvScrollPanel from 'primevue/scrollpanel';
import PvTabPanel from 'primevue/tabpanel';
import PvTabView from 'primevue/tabview';
import useOrgBrowser from '@/composables/useOrgBrowser';

const {
  orgHeaders,
  activeIndex,
  activeOrgType,
  selectedDistrict,
  selectedSchool,
  allDistricts,
  allSchools,
  isLoadingDistricts,
  isLoadingSchools,
  orgData,
  isLoading,
  isFetching,
  error,
  retry,
} = useOrgBrowser();

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

const filteredOrgData = (orgData, orgType) => {
  if (!orgData) return [];
  // return object that only has id, name, and schools or classes based on orgType
  return orgData.map((org) => {
    const filteredOrg = {
      id: org.id,
      name: org.name,
    };
    if (orgType === 'districts') {
      filteredOrg.schools = org.schools;
    }
    if (orgType === 'schools') {
      filteredOrg.classes = org.classes;
    }
    return filteredOrg;
  });
};
// Watch for changes in computedOrgsProp and update selectedOrgs
watch(
  () => computedOrgsProp.value,
  (orgs) => {
    selectedOrgs.districts = filteredOrgData(orgs.districts, 'districts');
    selectedOrgs.schools = filteredOrgData(orgs.schools, 'schools');
    selectedOrgs.classes = filteredOrgData(orgs.classes, 'classes');
    selectedOrgs.groups = filteredOrgData(orgs.groups, 'groups');
    selectedOrgs.families = filteredOrgData(orgs.families, 'families');
  },
  { immediate: true, deep: true },
);

const districtPlaceholder = computed(() => {
  if (isLoadingDistricts.value) {
    return 'Loading...';
  }
  return '';
});

const schoolPlaceholder = computed(() => {
  if (isLoadingSchools.value) {
    return 'Loading...';
  }
  return '';
});

const remove = (org, orgKey) => {
  selectedOrgs[orgKey] = selectedOrgs[orgKey].filter((_org) => _org.id !== org.id);
};

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
