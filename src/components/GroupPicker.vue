<template>
  <div class="flex gap-3 w-full">
    <PvPanel class="w-full">
      <template #header>
        <div class="flex align-items-center font-bold">
          Select Group(s)
          <span class="required-asterisk ml-1">*</span>
        </div>
      </template>

      <PvTabs v-model:value="activeHeader">
        <PvTabList>
          <PvTab v-for="header in orgHeaders" :key="header.value" :value="header.value">{{ header.label }}</PvTab>
        </PvTabList>

        <PvTabPanels>
          <PvTabPanel v-for="header in orgHeaders" :key="header.value" :value="header.value" class="mt-3">
            <div v-if="header.value === 'classes'" class="mb-3">
              <PvFloatLabel>
                <PvSelect
                  v-model="selectedSchool"
                  :loading="isLoadingSchoolsData"
                  :options="schoolsData"
                  class="w-full"
                  data-cy="dropdown-selected-school"
                  input-id="school"
                  option-label="name"
                  option-value="id"
                  showClear
                />
                <label for="school">Select school</label>
              </PvFloatLabel>
            </div>

            <PvListbox
              v-model="selectedOrgs[activeHeader]"
              checkmark
              multiple
              option-label="name"
              :empty-message="isLoadingOrgsData ? 'Loading options...' : 'No available options'"
              :options="orgsData"
            />
          </PvTabPanel>
        </PvTabPanels>
      </PvTabs>
    </PvPanel>

    <PvPanel class="w-full">
      <template #header>
        <div class="flex align-items-center font-bold">
          Selected Group(s)
          <span class="required-asterisk ml-1">*</span>
        </div>
      </template>

      <PvScrollPanel class="selected-groups-scroll-panel w-full">
        <div v-for="orgHeader in Object.keys(selectedOrgs)" :key="orgHeader">
          <div
            v-if="selectedOrgs[orgHeader] && selectedOrgs[orgHeader].length > 0"
            class="flex align-items-center flex-wrap gap-2 w-full mb-2"
          >
            <b>{{ _capitalize(convertToGroupName(orgHeader)) }}:</b>
            <PvChip
              v-for="selectedOrg in selectedOrgs[orgHeader]"
              :key="selectedOrg.id"
              :label="selectedOrg.name"
              removable
              class="text-sm"
              @remove="removeSelectedOrg(orgHeader, selectedOrg)"
            />
          </div>
        </div>
      </PvScrollPanel>
    </PvPanel>
  </div>
</template>

<script setup lang="ts">
import _useSchoolsQuery from '@/composables/queries/_useSchoolsQuery';
import useOrgsTableQuery from '@/composables/queries/useOrgsTableQuery';
import { convertToGroupName } from '@/helpers';
import { orderByDefault } from '@/helpers/query/utils';
import { useAuthStore } from '@/store/auth';
import _capitalize from 'lodash/capitalize';
import { storeToRefs } from 'pinia';
import PvChip from 'primevue/chip';
import PvFloatLabel from 'primevue/floatlabel';
import PvListbox from 'primevue/listbox';
import PvPanel from 'primevue/panel';
import PvScrollPanel from 'primevue/scrollpanel';
import PvSelect from 'primevue/select';
import PvTab from 'primevue/tab';
import PvTabList from 'primevue/tablist';
import PvTabPanel from 'primevue/tabpanel';
import PvTabPanels from 'primevue/tabpanels';
import PvTabs from 'primevue/tabs';
import { computed, reactive, ref, toRaw, watch } from 'vue';

interface OrgItem {
  id: string;
  name: string;
  districtId?: string;
  schoolId?: string;
  schools?: any[];
  classes?: any[];
}

interface OrgCollection {
  districts: OrgItem[];
  schools: OrgItem[];
  classes: OrgItem[];
  groups: OrgItem[];
  [key: string]: OrgItem[];
}

interface Props {
  orgs?: Partial<OrgCollection>;
}

interface Emits {
  selection: [orgs: OrgCollection];
}

const authStore = useAuthStore();
const { currentSite } = storeToRefs(authStore);

const emit = defineEmits<Emits>();
const props = defineProps<Props>();

const activeHeader = ref('districts');
const orderBy = ref(orderByDefault);
const selectedSchool = ref<string | undefined>(undefined);
const selectedOrgs = reactive<OrgCollection>({
  districts: [],
  schools: [],
  classes: [],
  groups: [],
  families: [],
});

const orgHeaders = computed(() => [
  { value: 'districts', label: 'Sites' },
  { value: 'schools', label: 'Schools' },
  { value: 'classes', label: 'Classes' },
  { value: 'groups', label: 'Cohorts' },
]);

const { data: orgsData, isLoading: isLoadingOrgsData } = useOrgsTableQuery(
  activeHeader,
  currentSite,
  selectedSchool,
  orderBy,
  false, // includeCreators = false for GroupPicker
);

const { isLoading: isLoadingSchoolsData, data: schoolsData } = _useSchoolsQuery(currentSite);

const removeSelectedOrg = (orgHeader: string, selectedOrg: OrgItem) => {
  const rawSelectedOrgs = toRaw(selectedOrgs);

  if (Array.isArray(rawSelectedOrgs[orgHeader])) {
    selectedOrgs[orgHeader] = (selectedOrgs[orgHeader] ?? []).filter((org) => org.id !== selectedOrg.id);
  } else {
    selectedOrgs[orgHeader] = [];
  }
};

const syncSelectedOrgsWithOrgData = (orgType: string, options: OrgItem[] | undefined) => {
  if (!options?.length) return;

  const key = orgType as keyof OrgCollection;
  const currentSelected = selectedOrgs[key];

  if (!currentSelected?.length) return;

  const optionMap = new Map(options.map((option: OrgItem) => [option.id, option]));
  const shouldPreserveOrg = key === 'classes' && selectedSchool.value;

  selectedOrgs[key] = currentSelected
    .map((org: OrgItem) => (shouldPreserveOrg && org.schoolId !== selectedSchool.value ? org : optionMap.get(org.id)))
    .filter((org): org is OrgItem => org !== undefined);
};

watch(
  () => [orgsData.value, activeHeader.value] as const,
  ([options, orgType]) => {
    syncSelectedOrgsWithOrgData(orgType, options);
  },
);

watch(
  () => props.orgs,
  (newOrgs) => {
    if (newOrgs) {
      if (newOrgs.districts) selectedOrgs.districts = [...(newOrgs.districts ?? [])];
      if (newOrgs.schools) selectedOrgs.schools = [...(newOrgs.schools ?? [])];
      if (newOrgs.classes) selectedOrgs.classes = [...(newOrgs.classes ?? [])];
      if (newOrgs.groups) selectedOrgs.groups = [...(newOrgs.groups ?? [])];
      if (activeHeader.value && orgsData.value) {
        syncSelectedOrgsWithOrgData(activeHeader.value, orgsData.value);
      }
    }
  },
  { immediate: true, deep: true },
);

watch(selectedOrgs, (newSelectedOrgs) => {
  emit('selection', newSelectedOrgs || selectedOrgs);
});
</script>

<style lang="scss">
.selected-groups-scroll-panel {
  height: 20rem;
}
</style>
