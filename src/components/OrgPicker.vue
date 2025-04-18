<template>
  <div class="grid">
    <div class="col-12 md:col-8">
      <PvPanel class="m-0 p-0 h-full" :header="`Select ${forParentOrg ? 'Parent Audience' : 'Audience'}`">
        <PvTabView v-if="claimsLoaded" v-model:activeIndex="activeIndex" class="m-0 p-0 org-tabs" lazy>
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
                    :loading="isLoadingSchools"
                    class="w-full"
                    data-cy="dropdown-selected-school"
                  />
                  <label for="school">Select from school</label>
                </PvFloatLabel>
              </div>
            </div>
            <div class="card flex justify-content-center">
              <PvListbox
                v-if="activeOrgType"
                v-model="selectedOrgs[activeOrgType]"
                :options="orgData"
                :multiple="!forParentOrg"
                :meta-key-selection="false"
                option-label="name"
                class="w-full"
                list-style="max-height:20rem"
                checkmark
              >
              </PvListbox>
              <div v-else class="p-4 text-center">Select a tab to view organizations.</div>
            </div>
          </PvTabPanel>
        </PvTabView>
      </PvPanel>
    </div>
    <div v-if="!forParentOrg" class="col-12 md:col-4">
      <PvPanel class="h-full" header="Selected audience">
        <PvScrollPanel style="width: 100%; height: 26rem">
          <div v-for="orgKey in Object.keys(selectedOrgs)" :key="orgKey">
            <div v-if="selectedOrgs[orgKey as OrgType]?.length > 0">
              <b>{{ _capitalize(orgKey) }}:</b>
              <PvChip
                v-for="org in selectedOrgs[orgKey as OrgType]"
                :key="org.id"
                class="m-1 surface-200 p-2 text-black border-round"
                removable
                :label="org.name"
                @remove="remove(org, orgKey as OrgType)"
              />
            </div>
          </div>
        </PvScrollPanel>
      </PvPanel>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted, watch, toRaw } from 'vue';
import type { Ref, ComputedRef, Reactive } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { UseQueryReturnType } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import _capitalize from 'lodash/capitalize';
import _get from 'lodash/get';
import _head from 'lodash/head';
import PvChip from 'primevue/chip';
import PvSelect from 'primevue/select';
import PvListbox from 'primevue/listbox';
import PvPanel from 'primevue/panel';
import PvScrollPanel from 'primevue/scrollpanel';
import PvTabPanel from 'primevue/tabpanel';
import PvTabView from 'primevue/tabview';
import { useAuthStore } from '@/store/auth';
import { orgFetcher, orgFetchAll } from '@/helpers/query/orgs';
import { orderByDefault } from '@/helpers/query/utils';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import useDistrictsListQuery from '@/composables/queries/useDistrictsListQuery';
import PvFloatLabel from 'primevue/floatlabel';

// Interfaces
interface Org {
  id: string;
  name: string;
  districtId?: string;
  schoolId?: string;
  // Add other potential fields if needed
}

type OrgType = 'districts' | 'schools' | 'classes' | 'groups' | 'families';

type SelectedOrgs = {
  [key in OrgType]?: Org[]; // Make org arrays optional initially
};

interface Props {
  orgs?: Partial<SelectedOrgs>; // Make orgs structure partial
  forParentOrg?: boolean;
}

interface OrgHeader {
  header: string;
  id: OrgType;
}

interface MinimalAdminOrgs {
  districts?: string[];
  schools?: string[];
  classes?: string[];
  groups?: string[];
}

interface UserClaimsData {
  claims?: {
    super_admin?: boolean;
    minimalAdminOrgs?: MinimalAdminOrgs;
  };
}

const initialized: Ref<boolean> = ref(false);
const authStore = useAuthStore(); // Needs assertion if store is not typed
const { roarfirekit } = storeToRefs(authStore); // Needs assertion if store is not typed

const selectedDistrict: Ref<string | undefined> = ref(undefined);
const selectedSchool: Ref<string | undefined> = ref(undefined);

// Define Props with defaults
const props = withDefaults(defineProps<Props>(), {
  orgs: () => ({}), // Default to empty object
  forParentOrg: false,
});

// Define Emits
const emit = defineEmits<{ (e: 'update:selectedOrgs', orgs: SelectedOrgs): void }>();

// Ensure all keys exist in reactive state, even if initially undefined
const selectedOrgs: Reactive<SelectedOrgs> = reactive({
  districts: undefined,
  schools: undefined,
  classes: undefined,
  groups: undefined,
  families: undefined,
});

// Computed property watching props.orgs
const computedOrgsProp: ComputedRef<Partial<SelectedOrgs>> = computed(() => {
  return props.orgs ?? {};
});

// Watch for changes in computedOrgsProp and update selectedOrgs
watch(
  computedOrgsProp,
  (orgs) => {
    (Object.keys(selectedOrgs) as OrgType[]).forEach((key) => {
      selectedOrgs[key] = orgs[key] ?? []; // Default to empty array if undefined
    });
  },
  { immediate: true, deep: true },
);

// User Claims Query - Use type assertion for the hook
const { isLoading: isLoadingClaims, data: userClaims }: UseQueryReturnType<UserClaimsData, Error> = (useUserClaimsQuery as any)({
  enabled: initialized,
});

const isSuperAdmin: ComputedRef<boolean> = computed(() => Boolean(userClaims.value?.claims?.super_admin));
const adminOrgs: ComputedRef<MinimalAdminOrgs | undefined> = computed(() => userClaims.value?.claims?.minimalAdminOrgs);

// Org Headers Computed
const orgHeaders: ComputedRef<{ [key: string]: OrgHeader }> = computed(() => {
  const headers: { [key: string]: OrgHeader } = {
    districts: { header: 'Sites', id: 'districts' },
    schools: { header: 'Schools', id: 'schools' },
    classes: { header: 'Classes', id: 'classes' },
    groups: { header: 'Groups', id: 'groups' },
  };

  if (isSuperAdmin.value) return headers; // Return all if super admin

  const result: { [key: string]: OrgHeader } = {};

  if (props.forParentOrg) {
    result.districts = { header: 'Districts', id: 'districts' };
    result.groups = { header: 'Groups', id: 'groups' };
    return result;
  }

  const adminOrgData = adminOrgs.value ?? {};
  if ((adminOrgData.districts ?? []).length > 0) {
    result.districts = { header: 'Districts', id: 'districts' };
    result.schools = { header: 'Schools', id: 'schools' };
    result.classes = { header: 'Classes', id: 'classes' };
  }
  if ((adminOrgData.schools ?? []).length > 0) {
    // Only add if not already added by district admin
    if (!result.schools) result.schools = { header: 'Schools', id: 'schools' };
    if (!result.classes) result.classes = { header: 'Classes', id: 'classes' };
  }
  if ((adminOrgData.classes ?? []).length > 0) {
    if (!result.classes) result.classes = { header: 'Classes', id: 'classes' };
  }
  if ((adminOrgData.groups ?? []).length > 0) {
    result.groups = { header: 'Groups', id: 'groups' };
  }
  return result;
});

const activeIndex: Ref<number> = ref(0);
const activeOrgType: ComputedRef<OrgType | undefined> = computed(() => {
  const keys = Object.keys(orgHeaders.value) as OrgType[];
  return keys[activeIndex.value];
});

const claimsLoaded: ComputedRef<boolean> = computed(() => initialized.value && !isLoadingClaims.value);

// Districts Query - Use type assertion for the hook
const { isLoading: isLoadingDistricts, data: allDistricts }: UseQueryReturnType<Org[], Error> = (useDistrictsListQuery as any)({
  enabled: claimsLoaded,
});

// Schools Query
const schoolQueryEnabled: ComputedRef<boolean> = computed(() => {
  return claimsLoaded.value && selectedDistrict.value !== undefined;
});

// Replace keepPreviousData with placeholderData
const { isLoading: isLoadingSchools, data: allSchools }: UseQueryReturnType<Org[], Error> = useQuery({
  queryKey: ['schools', selectedDistrict],
  queryFn: () => (orgFetcher as any)('schools', selectedDistrict, isSuperAdmin, adminOrgs), // Use 'as any' for JS helper
  placeholderData: (previousData) => previousData, // Use placeholderData
  enabled: schoolQueryEnabled,
  staleTime: 5 * 60 * 1000,
});

// Main Org Data Query
// Replace keepPreviousData with placeholderData
const { data: orgData }: UseQueryReturnType<Org[], Error> = useQuery({
  queryKey: ['orgs', activeOrgType, selectedDistrict, selectedSchool],
  queryFn: () => {
    if (!activeOrgType.value) return Promise.resolve([]);
    // Use 'as any' for JS helper
    return (orgFetchAll as any)(
        activeOrgType.value, // Pass value directly
        selectedDistrict,
        selectedSchool,
        ref(orderByDefault), // Assuming orderByDefault is compatible
        isSuperAdmin,
        adminOrgs, // Pass computed ref directly if function expects it
        ['id', 'name', 'districtId', 'schoolId', 'schools', 'classes']
    );
  },
  placeholderData: (previousData) => previousData, // Use placeholderData
  enabled: claimsLoaded,
  staleTime: 5 * 60 * 1000,
});

// Watch activeOrgType to reset selections if forParentOrg
watch(activeOrgType, (newActiveType) => {
  if (props.forParentOrg && newActiveType) {
    (Object.keys(selectedOrgs) as OrgType[]).forEach((key) => {
      selectedOrgs[key] = []; // Reset to empty array
    });
  }
});

// Function to remove a selected org
const remove = (orgToRemove: Org, orgKey: OrgType): void => {
  // Ensure the array exists before filtering
  if (selectedOrgs[orgKey]) {
      selectedOrgs[orgKey] = selectedOrgs[orgKey]?.filter((org) => org.id !== orgToRemove.id);
  }
};

// Emit updates when selectedOrgs changes
watch(
  selectedOrgs,
  (newSelectedOrgs) => {
    // Filter out undefined values before emitting if necessary
    const validOrgs: SelectedOrgs = {};
    for (const key in newSelectedOrgs) {
        if (newSelectedOrgs[key as OrgType] !== undefined) {
            validOrgs[key as OrgType] = newSelectedOrgs[key as OrgType];
        }
    }
    emit('update:selectedOrgs', toRaw(validOrgs));
  },
  { deep: true },
);

// Initialization Logic
let unsubscribe: (() => void) | undefined;
const init = (): void => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

// Use type assertion for potentially untyped store state
unsubscribe = (authStore as any).$subscribe((mutation: any, state: any) => {
  if (state.roarfirekit?.restConfig) init();
});

onMounted(() => {
  // Use type assertion for potentially untyped ref value
  if ((roarfirekit.value as any)?.restConfig) {
      init();
  }
  // Initialize selectedOrgs from props on mount, defaulting to empty arrays
  (Object.keys(selectedOrgs) as OrgType[]).forEach((key) => {
      selectedOrgs[key] = props.orgs?.[key] ?? [];
  });
});

// Watch for changes in 'allSchools' and update selectedSchool
watch(allSchools, (newValue) => {
    // Handle potential undefined from _head
    const firstSchool = _head(newValue);
    if (firstSchool) {
        selectedSchool.value = _get(firstSchool, 'id');
    } else {
        selectedSchool.value = undefined; // Reset if no schools
    }
});

// Watch for changes in 'allDistricts' and update selectedDistrict
watch(allDistricts, (newValue) => {
    // Handle potential undefined from _head
    const firstDistrict = _head(newValue);
    if (firstDistrict) {
        selectedDistrict.value = _get(firstDistrict, 'id');
    } else {
        selectedDistrict.value = undefined; // Reset if no districts
    }
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

.org-tabs .p-tabview-nav {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
}

.org-tabs .p-tabview-nav li {
  flex: 0 0 auto;
  min-width: fit-content;
}
</style>
