<template>
  <main class="container main">
    <section class="main-body">
      <div class="flex flex-column mb-5">
        <div class="flex justify-content-between mb-2">
          <div class="flex align-items-center gap-3">
            <i class="pi pi-sliders-h text-gray-400 rounded" style="font-size: 1.6rem" />
            <div class="admin-page-header">Create a new Group</div>
          </div>
        </div>
        <div class="text-md text-gray-500 ml-6">Use this form to create a new Group.</div>
      </div>

      <PvDivider />
      <div class="bg-gray-100 rounded p-4">
        <p class="text-sm text-gray-500 text-right">required <span class="text-red-500">*</span></p>
        <div class="grid column-gap-3 mt-1 rounded">
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
              <label for="org-type">Group Type<span id="required-asterisk">*</span></label>
            </PvFloatLabel>
          </div>
        </div>

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

        <PvDivider />

        <div class="grid">
          <div class="col-12">
            <PvButton
              :label="isSubmittingOrg ? `Creating ${orgTypeLabel}` : `Create ${orgTypeLabel}`"
              :disabled="orgTypeLabel === 'Org' || v$.$invalid || isSubmittingOrg"
              :icon="isSubmittingOrg ? 'pi pi-spin pi-spinner' : ''"
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
import { computed, reactive, ref, toRaw, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { storeToRefs } from 'pinia';
import _capitalize from 'lodash/capitalize';
import _union from 'lodash/union';
import _without from 'lodash/without';
import { useVuelidate } from '@vuelidate/core';
import { required, requiredIf } from '@vuelidate/validators';
import PvAutoComplete from 'primevue/autocomplete';
import PvButton from 'primevue/button';
import PvDivider from 'primevue/divider';
import PvSelect from 'primevue/select';
import PvInputText from 'primevue/inputtext';
import PvFloatLabel from 'primevue/floatlabel';
import { useAuthStore } from '@/store/auth';
import useDistrictsListQuery from '@/composables/queries/useDistrictsListQuery';
import useDistrictSchoolsQuery from '@/composables/queries/useDistrictSchoolsQuery';
import useSchoolClassesQuery from '@/composables/queries/useSchoolClassesQuery';
import useGroupsListQuery from '@/composables/queries/useGroupsListQuery';
import useUpsertOrgMutation from '@/composables/mutations/useUpsertOrgMutation';
import { TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';
const initialized = ref(false);
const toast = useToast();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const state = reactive({
  orgName: '',
  parentDistrict: undefined,
  parentSchool: undefined,
  tags: [],
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

// All districts belonging to user
const { isLoading: isLoadingDistricts, data: districts } = useDistrictsListQuery({
  enabled: initialized,
});

// All groups belonging to user
const { data: groups } = useGroupsListQuery({
  enabled: initialized,
});

const schoolQueryEnabled = computed(() => {
  return initialized.value && state.parentDistrict !== undefined;
});

const selectedDistrict = computed(() => state.parentDistrict?.id);

// The schools of a given district
const { isFetching: isFetchingSchools, data: schools } = useDistrictSchoolsQuery(selectedDistrict, {
  enabled: schoolQueryEnabled,
});

const classQueryEnabled = computed(() => {
  return initialized.value && state.parentSchool !== undefined;
});

const selectedSchool = computed(() => state.parentSchool?.id);

// The classes of a given school
const { data: classes } = useSchoolClassesQuery(selectedSchool, {
  enabled: classQueryEnabled,
});

const { mutate: upsertOrg, isPending: isSubmittingOrg, error: upsertOrgError } = useUpsertOrgMutation();

const schoolDropdownEnabled = computed(() => {
  return state.parentDistrict && !isFetchingSchools.value;
});

const rules = {
  orgName: { required },
  parentDistrict: { required: requiredIf(() => ['school', 'class', 'group'].includes(orgType.value.singular)) },
  parentSchool: { required: requiredIf(() => orgType.value.singular === 'class') },
};

const v$ = useVuelidate(rules, state);
const submitted = ref(false);

const orgTypes = [
  { firestoreCollection: 'districts', singular: 'district', label: 'Site' },
  { firestoreCollection: 'schools', singular: 'school', label: 'School' },
  { firestoreCollection: 'classes', singular: 'class', label: 'Class' },
  { firestoreCollection: 'groups', singular: 'group', label: 'Cohort' },
];

const orgType = ref();


const orgTypeLabel = computed(() => {
  if (orgType.value) {
    return _capitalize(orgType.value.label);
  }
  return 'Group';
});

const parentOrgRequired = computed(() => ['school', 'class', 'group'].includes(orgType.value?.singular));


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
  const isFormValid = await v$.value.$validate();

  if (isFormValid) {
    let orgDataToSubmit = {
      name: state.orgName,
      abbreviation: state.orgInitials,
      type: orgType.value.firestoreCollection,
    };

    if (state.tags.length > 0) orgDataToSubmit.tags = state.tags;

    if (orgType.value?.singular === 'class') {
      orgDataToSubmit.schoolId = toRaw(state.parentSchool).id;
      orgDataToSubmit.districtId = toRaw(state.parentDistrict).id;
    } else if (orgType.value?.singular === 'school') {
      orgDataToSubmit.districtId = toRaw(state.parentDistrict).id;
    } else if (orgType.value?.singular === 'group') {
      orgDataToSubmit.parentOrgId = toRaw(state.parentDistrict).id;
    }

    upsertOrg(orgDataToSubmit, {
      onSuccess: () => {
        toast.add({ severity: 'success', summary: 'Success', detail: `Group created`, life: TOAST_DEFAULT_LIFE_DURATION });
        resetForm();
        v$.value.$reset();
      },
      onError: (error) => {
        toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: TOAST_DEFAULT_LIFE_DURATION });
        console.error(`Error creating Group:`, error);
      },
    });
  } else {
    toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'Please check the form for errors.', life: TOAST_DEFAULT_LIFE_DURATION });
  }
};

const resetForm = () => {
  state.orgName = '';
  state.tags = [];
  state.parentDistrict = undefined;
  state.parentSchool = undefined;
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
