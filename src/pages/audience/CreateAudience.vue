<template>
  <main class="container main">
    <section class="main-body">
      <div class="flex flex-column mb-5">
        <div class="flex justify-content-between mb-2">
          <div class="flex align-items-center gap-3">
            <i class="pi pi-sliders-h text-gray-400 rounded" style="font-size: 1.6rem" />
            <div class="admin-page-header">Create a new Audience</div>
          </div>
        </div>
        <div class="text-md text-gray-500 ml-6">Use this form to create a new Audience.</div>
      </div>

      <PvDivider />
      <div class="bg-gray-100 rounded p-4">
        <div class="grid column-gap-3 mt-5 rounded">
          <div class="col-12 md:col-6 lg:col-3 xl:col-3">
            <PvFloatLabel>
              <PvSelect
                v-model="orgType"
                input-id="org-type"
                :options="orgTypes"
                show-clear
                option-label="label"
                class="w-full"
                data-cy="dropdown-org-type"
              />
              <label for="org-type">Org Type<span id="requiredgroupHasParentOrg-asterisk">*</span></label>
            </PvFloatLabel>
          </div>
        </div>

        <div v-if="orgType?.singular === 'group'" class="flex flex-row align-items-center justify-content-start gap-2">
          <PvCheckbox v-model="groupHasParentOrg" input-id="chbx-group-parent-org" :binary="true" />
          <label for="chbx-group-parent-org">Belongs to an Audience</label>
        </div>

        <OrgPicker
          v-if="groupHasParentOrg && orgType?.singular === 'group'"
          :for-parent-org="true"
          class="mt-4"
          @selection="selection($event)"
        />

        <div v-if="parentOrgRequired" class="grid mt-4">
          <div class="col-12 md:col-6 lg:col-4">
            <PvFloatLabel>
              <PvSelect
                v-model="state.parentDistrict"
                input-id="parent-district"
                :options="districts"
                show-clear
                option-label="name"
                :loading="isLoadingDistricts"
                class="w-full"
                data-cy="dropdown-parent-district"
              />
              <label for="parent-district">Site<span id="required-asterisk">*</span></label>
              <small v-if="v$.parentDistrict.$invalid && submitted" class="p-error"> Please select a site. </small>
            </PvFloatLabel>
          </div>

          <div v-if="orgType.singular === 'class'" class="col-12 md:col-6 lg:col-4">
            <PvFloatLabel>
              <PvSelect
                v-model="state.parentSchool"
                input-id="parent-school"
                :options="schools"
                show-clear
                option-label="name"
                :loading="!schoolDropdownEnabled"
                class="w-full"
                data-cy="dropdown-parent-school"
              />
              <label for="parent-school">School<span id="required-asterisk">*</span></label>
              <small v-if="v$.parentSchool.$invalid && submitted" class="p-error"> Please select a district. </small>
            </PvFloatLabel>
          </div>
        </div>

        <div class="grid mt-3">
          <div class="col-12 md:col-6 lg:col-4 mt-3">
            <PvFloatLabel>
              <PvInputText id="org-name" v-model="state.orgName" class="w-full" data-cy="input-org-name" />
              <label for="org-name">{{ orgTypeLabel }} Name<span id="required-asterisk">*</span></label>
              <small v-if="v$.orgName.$invalid && submitted" class="p-error">Please supply a name</small>
            </PvFloatLabel>
          </div>

          <div class="col-12 md:col-6 lg:col-4 mt-3">
            <PvFloatLabel>
              <PvInputText id="org-initial" v-model="state.orgInitials" class="w-full" data-cy="input-org-initials" />
              <label for="org-initial">{{ orgTypeLabel }} Abbreviation<span id="required-asterisk">*</span></label>
              <small v-if="v$.orgInitials.$invalid && submitted" class="p-error">Please supply an abbreviation</small>
            </PvFloatLabel>
          </div>
        </div>

        <div class="mt-5 mb-0 pb-0">Optional fields:</div>

        <div class="grid mt-3">
          <div class="col-12 md:col-6 lg:col-4 mt-3" data-cy="div-auto-complete">
            <PvFloatLabel>
              <PvAutoComplete
                v-model="state.tags"
                multiple
                dropdown
                :options="allTags"
                :suggestions="tagSuggestions"
                name="tags"
                class="w-full"
                data-cy="input-autocomplete"
                @complete="searchTags"
              />
              <label for="tags">Tags</label>
            </PvFloatLabel>
          </div>
        </div>
        <div v-if="!isLevante" class="flex flex-row align-items-center justify-content-stagap-2 flex-order-0 my-3">
          <div class="flex flex-row align-items-center">
            <PvCheckbox v-model="isDemoData" input-id="chbx-demodata" :binary="true" />
            <label class="ml-1 mr-3" for="chbx-demodata">Mark as <b>Demo Organization</b></label>
          </div>
          <div class="flex flex-row align-items-center">
            <PvCheckbox v-model="isTestData" input-id="chbx-testdata" :binary="true" />
            <label class="ml-1 mr-3" for="chbx-testdata">Mark as <b>Test Organization</b></label>
          </div>
        </div>

        <PvDivider />

        <div class="grid">
          <div class="col-12">
            <PvButton
              :label="submitted ? `Creating ${orgTypeLabel}` : `Create ${orgTypeLabel}`"
              :disabled="orgTypeLabel === 'Org' || v$.$invalid || submitted"
              :icon="submitted ? 'pi pi-spin pi-spinner' : ''"
              class="bg-primary text-white border-none border-round h-3rem w-3 hover:bg-red-900"
              data-cy="button-create-org"
              @click="submit"
            />
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, reactive, ref, toRaw, onMounted, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { storeToRefs } from 'pinia';
import _capitalize from 'lodash/capitalize';
import _union from 'lodash/union';
import _without from 'lodash/without';
import { useQueryClient } from '@tanstack/vue-query';
import { useVuelidate } from '@vuelidate/core';
import { required, requiredIf } from '@vuelidate/validators';
import PvAutoComplete from 'primevue/autocomplete';
import PvButton from 'primevue/button';
import PvCheckbox from 'primevue/checkbox';
import PvDivider from 'primevue/divider';
import PvSelect from 'primevue/select';
import PvInputText from 'primevue/inputtext';
import PvFloatLabel from 'primevue/floatlabel';
import { useAuthStore } from '@/store/auth';
import useDistrictsListQuery from '@/composables/queries/useDistrictsListQuery';
import useDistrictSchoolsQuery from '@/composables/queries/useDistrictSchoolsQuery';
import useSchoolClassesQuery from '@/composables/queries/useSchoolClassesQuery';
import useGroupsListQuery from '@/composables/queries/useGroupsListQuery';
import { isLevante } from '@/helpers';
import OrgPicker from '@/components/OrgPicker.vue';
import _toPairs from 'lodash/toPairs';

const initialized = ref(false);
const isTestData = ref(false);
const isDemoData = ref(false);
const toast = useToast();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const queryClient = useQueryClient();
const groupHasParentOrg = ref(false);

watch(groupHasParentOrg, () => {
  console.log('groupHasParentOrg: ', groupHasParentOrg.value);
});

const state = reactive({
  orgName: '',
  orgInitials: '',
  parentDistrict: undefined,
  parentSchool: undefined,
  tags: [],
});

const groupParentOrgs = reactive({
  districts: [],
  schools: [],
  classes: [],
  groups: [],
});

let unsubscribe;
const initTable = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) initTable();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) initTable();
});

const { isLoading: isLoadingDistricts, data: districts } = useDistrictsListQuery({
  enabled: initialized,
});

const { data: groups } = useGroupsListQuery({
  enabled: initialized,
});

const schoolQueryEnabled = computed(() => {
  return initialized.value && state.parentDistrict !== undefined;
});

const selectedDistrict = computed(() => state.parentDistrict?.id);

const { isFetching: isFetchingSchools, data: schools } = useDistrictSchoolsQuery(selectedDistrict, {
  enabled: schoolQueryEnabled,
});

const classQueryEnabled = computed(() => {
  return initialized.value && state.parentSchool !== undefined;
});

const schoolDropdownEnabled = computed(() => {
  return state.parentDistrict && !isFetchingSchools.value;
});

const selectedSchool = computed(() => state.parentSchool?.id);

const { data: classes } = useSchoolClassesQuery(selectedSchool, {
  enabled: classQueryEnabled,
});

const rules = {
  orgName: { required },
  orgInitials: { required },
  parentDistrict: { required: requiredIf(() => ['school', 'class'].includes(orgType.value.singular)) },
  parentSchool: { required: requiredIf(() => orgType.value.singular === 'class') },
};

const v$ = useVuelidate(rules, state);
const submitted = ref(false);

const orgTypes = [
  { firestoreCollection: 'districts', singular: 'district', label: 'Site' },
  { firestoreCollection: 'schools', singular: 'school', label: 'School' },
  { firestoreCollection: 'classes', singular: 'class', label: 'Class' },
  { firestoreCollection: 'groups', singular: 'group', label: 'Group' },
];

const orgType = ref();

// To hide the org picker when the org type is cleared (can't control the clear button)
watch(orgType, () => {
  if (!orgType.value) {
    groupHasParentOrg.value = false;
  }
});

const orgTypeLabel = computed(() => {
  if (orgType.value) {
    return _capitalize(orgType.value.label);
  }
  return 'Org';
});

const parentOrgRequired = computed(() => ['school', 'class'].includes(orgType.value?.singular));

const selection = (selected) => {
  for (const [key, value] of _toPairs(toRaw(selected))) {
    groupParentOrgs[key] = value;
  }
};

const allTags = computed(() => {
  const districtTags = (districts.value ?? []).map((org) => org.tags);
  const schoolTags = (districts.value ?? []).map((org) => org.tags);
  const classTags = (classes.value ?? []).map((org) => org.tags);
  const groupTags = (groups.value ?? []).map((org) => org.tags);
  return _without(_union(...districtTags, ...schoolTags, ...classTags, ...groupTags), undefined) || [];
});

const tagSuggestions = ref([]);
const searchTags = (event) => {
  const query = event.query.toLowerCase();
  let filteredOptions = allTags.value.filter((opt) => opt.toLowerCase().includes(query));
  if (filteredOptions.length === 0 && query) {
    filteredOptions.push(query);
  } else {
    filteredOptions = filteredOptions.map((opt) => opt);
  }
  tagSuggestions.value = filteredOptions;
};

const submit = async () => {
  submitted.value = true;
  const isFormValid = await v$.value.$validate();

  if (isFormValid) {
    let orgData = {
      name: state.orgName,
      abbreviation: state.orgInitials,
    };

    if (groupHasParentOrg.value) {
      const singularMap = {
        districts: 'district',
        schools: 'school',
        classes: 'class',
        groups: 'group',
        families: 'family',
      };
      const rawParentOrgs = toRaw(groupParentOrgs);
      let parentOrg;
      let parentOrgKey;
      // Find first key with non-empty array or object value
      parentOrgKey = Object.keys(rawParentOrgs).find(key => {
        const value = rawParentOrgs[key];
        return (Array.isArray(value) && value.length > 0) || 
               (!Array.isArray(value) && typeof value === 'object' && value !== null);
      });
      if (parentOrgKey) {
        const value = rawParentOrgs[parentOrgKey];
        parentOrg = Array.isArray(value) ? value[0] : value;
      }
      if (!parentOrg || !parentOrgKey) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Please select a parent organization', life: 3000 });
        submitted.value = false;
        return;
      }
      orgData.parentOrgId = parentOrg.id;
      orgData.parentOrgType = singularMap[parentOrgKey];
    }

    if (state.tags.length > 0) orgData.tags = state.tags;

    if (orgType.value?.singular === 'class') {
      orgData.schoolId = toRaw(state.parentSchool).id;
      orgData.districtId = toRaw(state.parentDistrict).id;
    } else if (orgType.value?.singular === 'school') {
      orgData.districtId = toRaw(state.parentDistrict).id;
    }

    await roarfirekit.value
      .upsertOrg({type: orgType.value.firestoreCollection, ...orgData})
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['orgs'], exact: false });
        toast.add({ severity: 'success', summary: 'Success', detail: 'Audience created', life: 3000 });
        submitted.value = false;
        resetForm();
      })
      .catch((error) => {
        toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        console.error('Error creating org:', error);
        submitted.value = false;
      });
  } else {
    // TODO: Add error handling
    console.error('Form is invalid');
  }
};

const resetForm = () => {
  state.orgName = '';
  state.orgInitials = '';
  state.tags = [];
};
</script>

<style lang="scss">
.return-button {
  display: block;
  margin: 1rem 1.75rem;
}

.p-checkbox-box.p-highlight {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.p-inputgroup {
  display: flex;
  align-items: stretch;
  
  .p-inputgroup-addon {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 2.5rem;
    height: auto;
  }
  
  .p-inputtext {
    flex: 1 1 auto;
  }
}

.p-autocomplete-panel {
  background: var(--surface-a);
  color: var(--text-color);
  border: 0 none;
  border-radius: var(--border-radius);
  box-shadow:
    0 0 #0000,
    0 0 #0000,
    0 10px 15px -3px #0000001a,
    0 4px 6px -2px #0000000d;
}

.p-autocomplete-panel .p-autocomplete-items .p-autocomplete-item {
  margin: 0;
  padding: var(--inline-spacing-larger) 1rem;
  border: 0 none;
  color: var(--text-color);
  background: transparent;
  transition: none;
  border-radius: 0;
}

.p-autocomplete-panel .p-autocomplete-items .p-autocomplete-item:hover {
  background-color: gainsboro;
}

button.p-button.p-component.p-button-icon-only.p-autocomplete-dropdown {
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 20%;
  width: 3rem;
}

button.p-autocomplete-dropdown {
  margin-left: 0.3rem;
}

#rectangle {
  background: #fcfcfc;
  border-radius: 0.3125rem;
  border-style: solid;
  border-width: 0.0625rem;
  border-color: #e5e5e5;
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
    border-color: #e5e5e5;
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

  ::placeholder {
    font-family: 'Source Sans Pro', sans-serif;
    color: #c4c4c4;
  }

  .hide {
    display: none;
  }
}

.p-autocomplete-token {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  background: var(--primary-color);
  padding: 0.25rem;
  border-radius: 0.35rem;
  color: white;
  margin: 0.05rem;
}

.p-autocomplete-token-icon,
g {
  margin-left: 0.5rem;
  color: white;
}

#required-asterisk {
  color: #ff0000;
}
</style>
