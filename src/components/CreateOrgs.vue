<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :actions="sidebarActions" />
    </aside>
    <section class="main-body">
      <Panel header="Create a new organization">
        Use this form to create a new organization.

        <Divider />

        <div class="grid column-gap-3 mt-5">
          <div class="col-12 md:col-6 lg:col-3 xl:col-3">
            <span class="p-float-label">
              <Dropdown v-model="orgType" inputId="org-type" :options="orgTypes" showClear optionLabel="singular"
                placeholder="Select an org type" class="w-full" />
              <label for="org-type">Org Type</label>
            </span>
          </div>
        </div>

        <!-- TODO: Edit this section to include two separate dropdowns, one for districts and one for schools. -->
        <!-- TODO: The one for districts should be populated by ``districts`` and the one for schools should be populated by ``schools``. -->
        <!-- TODO: The v-model for districts should be ``selectedDistrict`` and the v-model for schools should be ``selectedSchool``. -->
        <!-- TODO: If ``isLoadingSchools`` is true, show the schools dropdown in a loading state. See: https://primevue.org/dropdown/#loadingstate -->
        <!-- TODO: This will also require changing ``state.parentOrg`` into two variables: ``state.parentDistrict`` and ``state.parentSchool``. -->
        <div v-if="parentOrgRequired" class="grid mt-4">
          <p id="section-heading">Assign this {{ orgTypeLabel.toLowerCase() }} to:</p>
          <div v-if="(districts ?? []).length === 1" class="col-12 md:col-6 lg:col-4">
            <p id="section-heading">
              District {{ districts[0].name }}.
            </p>
          </div>
          <div v-else class="col-12 md:col-6 lg:col-4">
            <span class="p-float-label">
              <Dropdown v-model="state.parentDistrict" inputId="parent-district" :options="districts" showClear
                optionLabel="name" placeholder="Select a district" :loading="isLoadingDistricts" class="w-full" />
              <label for="parent-district">District</label>
              <small v-if="v$.parentDistrict.$invalid && submitted" class="p-error">
                Please select a district.
              </small>
            </span>
          </div>

          <div v-if="orgType.singular === 'class'" class="col-12 md:col-6 lg:col-4">
            <div v-if="(schools ?? []).length === 1">
              <p id="section-heading">
                School {{ schools[0].name }}.
              </p>
            </div>

            <div v-else>
              <span class="p-float-label">
                <Dropdown v-model="state.parentSchool" inputId="parent-school" :options="schools" showClear
                  optionLabel="name"
                  :placeholder="schoolDropdownEnabled ? 'Select a school' : 'Please select a district first'"
                  :loading="!schoolDropdownEnabled" class="w-full" />
                <label for="parent-school">School</label>
                <small v-if="v$.parentSchool.$invalid && submitted" class="p-error">
                  Please select a district.
                </small>
              </span>
            </div>
          </div>
        </div>

        <div class="grid mt-3">
          <div class="col-12 md:col-6 lg:col-4 mt-3">
            <span class="p-float-label">
              <InputText id="org-name" v-model="state.orgName" class="w-full" />
              <label for="org-name">{{ orgTypeLabel }} Name</label>
              <small v-if="v$.orgName.$invalid && submitted" class="p-error">Please supply a name</small>
            </span>
          </div>

          <div class="col-12 md:col-6 lg:col-4 mt-3">
            <span class="p-float-label">
              <InputText id="org-initial" v-model="state.orgInitials" class="w-full" />
              <label for="org-initial">{{ orgTypeLabel }} Abbreviation</label>
              <small v-if="v$.orgInitials.$invalid && submitted" class="p-error">Please supply an abbreviation</small>
            </span>
          </div>

          <div class="col-12 md:col-6 lg:col-4 mt-3" v-if="orgType?.singular === 'class'">
            <span class="p-float-label">
              <Dropdown v-model="state.grade" inputId="grade" :options="grades" showClear optionLabel="name"
                placeholder="Select a grade" class="w-full" />
              <label for="grade">Grade</label>
              <small v-if="v$.grade.$invalid && submitted" class="p-error">Please select a grade</small>
            </span>
          </div>
        </div>

        <div class="mt-5 mb-0 pb-0">
          Optional fields:
        </div>

        <div v-if="['district', 'school', 'group'].includes(orgType?.singular)">
          <div class="grid column-gap-3">
            <div v-if="['district', 'school'].includes(orgType?.singular)" class="col-12 md:col-6 lg:col-4 mt-5">
              <span class="p-float-label">
                <InputText v-model="state.ncesId" v-tooltip="ncesTooltip" inputId="nces-id" class="w-full" />
                <label for="nces-id">NCES ID</label>
              </span>
            </div>
          </div>
          <div class="grid mt-3">
            <div class="col-12">
              Search for a {{ orgType.singular }} address:
            </div>
            <div class="col-12 md:col-6 lg:col-6 xl:col-6 p-inputgroup">
              <span class="p-inputgroup-addon">
                <i class="pi pi-map"></i>
              </span>
              <GMapAutocomplete @place_changed="setAddress" :options="{
                fields: ['address_components', 'formatted_address', 'place_id', 'url'],
              }" class="p-inputtext p-component w-full">
              </GMapAutocomplete>
            </div>
          </div>
          <div v-if="state.address?.formattedAddress" class="grid">
            <div class="col-12 mt-3">
              {{ orgTypeLabel }} Address:
              <Chip :label="state.address.formattedAddress" removable @remove="removeAddress" />
            </div>
          </div>
        </div>

        <div class="grid mt-3">
          <div class="col-12 md:col-6 lg:col-4 mt-3">
            <span class="p-float-label">
              <AutoComplete v-model="state.tags" multiple dropdown :options="allTags" :suggestions="tagSuggestions"
                @complete="searchTags" name="tags" class="w-full" />
              <label for="tags">Tags</label>
            </span>
          </div>
        </div>

        <Divider />

        <div class="grid">
          <div class="col-12">
            <ConfirmPopup></ConfirmPopup>
            <Button :label="`Create ${orgTypeLabel}`" @click="preSubmit" :disabled="orgTypeLabel === 'Org'" />
          </div>
        </div>

      </Panel>
    </section>
  </main>
</template>

<script setup>
import { computed, reactive, ref, toRaw, onMounted } from "vue";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { storeToRefs } from "pinia";
import _capitalize from "lodash/capitalize";
import _get from "lodash/get";
import _set from "lodash/set";
import _union from "lodash/union";
import _without from "lodash/without";
import { useQuery } from '@tanstack/vue-query'
import { useVuelidate } from "@vuelidate/core";
import { required, requiredIf } from "@vuelidate/validators";
import { useAuthStore } from "@/store/auth";
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import { getSidebarActions } from "@/router/sidebarActions";
import { fetchDocById } from "@/helpers/query/utils";
import { orgFetcher } from "@/helpers/query/orgs";

const initialized = ref(false);
const confirm = useConfirm();
const toast = useToast();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const state = reactive({
  orgName: "",
  orgInitials: "",
  ncesId: undefined,
  address: undefined,
  parentDistrict: undefined,
  parentSchool: undefined,
  grade: undefined,
  tags: [],
})

let unsubscribe;
const initTable = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
}

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) initTable();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) initTable();
})

const { isLoading: isLoadingClaims, isFetching: isFetchingClaims, data: userClaims } =
  useQuery({
    queryKey: ['userClaims', authStore.uid],
    queryFn: () => fetchDocById('userClaims', authStore.uid),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));
const adminOrgs = computed(() => userClaims.value?.claims?.minimalAdminOrgs);
const sidebarActions = ref(getSidebarActions(isSuperAdmin.value, true));

const claimsLoaded = computed(() => !isLoadingClaims.value);

const { isLoading: isLoadingDistricts, data: districts } =
  useQuery({
    queryKey: ['districts'],
    queryFn: () => orgFetcher('districts', undefined, isSuperAdmin, adminOrgs, ["name", "id", "tags"]),
    keepPreviousData: true,
    enabled: claimsLoaded,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const { isLoading: isLoadingGroups, data: groups } =
  useQuery({
    queryKey: ['groups'],
    queryFn: () => orgFetcher('groups', undefined, isSuperAdmin, adminOrgs, ["name", "id", "tags"]),
    keepPreviousData: true,
    enabled: claimsLoaded,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const schoolQueryEnabled = computed(() => {
  return claimsLoaded.value && state.parentDistrict !== undefined;
})

const selectedDistrict = computed(() => state.parentDistrict?.id);

const { isLoading: isLoadingSchools, isFetching: isFetchingSchools, data: schools } =
  useQuery({
    queryKey: ['schools', selectedDistrict],
    queryFn: () => orgFetcher('schools', selectedDistrict, isSuperAdmin, adminOrgs, ["name", "id", "tags"]),
    keepPreviousData: true,
    enabled: schoolQueryEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const classQueryEnabled = computed(() => {
  return claimsLoaded.value && state.parentSchool !== undefined;
})

const schoolDropdownEnabled = computed(() => {
  return state.parentDistrict && !isFetchingSchools.value;
})

const selectedSchool = computed(() => state.parentSchool?.id);

const { isLoading: isLoadingClasses, data: classes } =
  useQuery({
    queryKey: ['classes', selectedSchool],
    queryFn: () => orgFetcher('schools', selectedSchool, isSuperAdmin, adminOrgs, ["name", "id", "tags"]),
    keepPreviousData: true,
    enabled: classQueryEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const rules = {
  orgName: { required },
  orgInitials: { required },
  parentDistrict: { required: requiredIf(() => ["school", "class"].includes(orgType.value.singular)) },
  parentSchool: { required: requiredIf(() => orgType.value.singular === "class") },
  grade: { required: requiredIf(() => orgType.value.singular === "class") }
};

const v$ = useVuelidate(rules, state);
const submitted = ref(false);

const orgTypes = [
  { firestoreCollection: 'districts', singular: 'district' },
  { firestoreCollection: 'schools', singular: 'school' },
  { firestoreCollection: 'classes', singular: 'class' },
  { firestoreCollection: 'groups', singular: 'group' },
];

const orgType = ref();
const orgTypeLabel = computed(() => {
  if (orgType.value) {
    return _capitalize(orgType.value.singular);
  }
  return "Org";
})

const parentOrgRequired = computed(() => ["school", "class"].includes(orgType.value?.singular))

const grades = [
  { name: 'Pre-K', value: 'PK' },
  { name: 'Transitional Kindergarten', value: 'TK' },
  { name: 'Kindergarten', value: 'K' },
  { name: 'Grade 1', value: 1 },
  { name: 'Grade 2', value: 2 },
  { name: 'Grade 3', value: 3 },
  { name: 'Grade 4', value: 4 },
  { name: 'Grade 5', value: 5 },
  { name: 'Grade 6', value: 6 },
  { name: 'Grade 7', value: 7 },
  { name: 'Grade 8', value: 8 },
  { name: 'Grade 9', value: 9 },
  { name: 'Grade 10', value: 10 },
  { name: 'Grade 11', value: 11 },
  { name: 'Grade 12', value: 12 },
];

const allTags = computed(() => {
  const districtTags = (districts.value ?? []).map((org) => org.tags);
  const schoolTags = (districts.value ?? []).map((org) => org.tags);
  const classTags = (classes.value ?? []).map((org) => org.tags);
  const groupTags = (groups.value ?? []).map((org) => org.tags);
  return _without(_union(
    ...districtTags, ...schoolTags, ...classTags, ...groupTags
  ), undefined) || [];
})

const ncesTooltip = computed(() => {
  if (orgType.value?.singular === "school") {
    return "12 digit NCES school identification number";
  } else if (orgType.value?.singular === "district") {
    return "7 digit NCES district identification number";
  }
  return "";
})

const tagSuggestions = ref([]);
const searchTags = (event) => {
  const query = event.query.toLowerCase();
  let filteredOptions = allTags.value.filter(opt => opt.toLowerCase().includes(query));
  if (filteredOptions.length === 0 && query) {
    filteredOptions.push(query);
  } else {
    filteredOptions = filteredOptions.map(opt => opt);
  }
  tagSuggestions.value = filteredOptions;
}

const setAddress = (place) => {
  state.address = {
    addressComponents: place.address_components || [],
    formattedAddress: place.formatted_address,
    googlePlacesId: place.place_id,
    googleMapsUrl: place.url,
  }
}

const removeAddress = () => {
  state.address = undefined;
}

const submit = async (event) => {
  submitted.value = true;
  const isFormValid = await v$.value.$validate()
  if (isFormValid) {
    let orgData = {
      name: state.orgName,
      abbreviation: state.orgInitials,
    };

    if (state.grade) orgData.grade = toRaw(state.grade).value;
    if (state.ncesId) orgData.ncesId = state.ncesId;
    if (state.address) orgData.address = state.address;
    if (state.tags.length > 0) orgData.tags = state.tags;

    if (orgType.value?.singular === "class") {
      orgData.schoolId = toRaw(state.parentSchool).id;
      orgData.districtId = toRaw(state.parentDistrict).id;
    } else if (orgType.value?.singular === "school") {
      orgData.districtId = toRaw(state.parentDistrict).id;
    }

    await roarfirekit.value.createOrg(orgType.value.firestoreCollection, orgData).then(() => {
      toast.add({ severity: 'success', summary: 'Success', detail: 'Org created', life: 3000 });
      submitted.value = false;
      resetForm();
    })
  } else {
    console.log("Form is invalid");
  }
};

const resetForm = () => {
  state.orgName = "";
  state.orgInitials = "";
  state.ncesId = undefined;
  state.address = undefined;
  state.grade = undefined;
  state.tags = [];
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
