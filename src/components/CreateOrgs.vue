<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :actions="sidebarActions" />
    </aside>
    <section class="main-body">
      <Panel header="Create a new organization">
        <template #icons>
          <button class="p-panel-header-icon p-link mr-2" @click="refresh">
            <span :class="spinIcon"></span>
          </button>
        </template>
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

        <div v-if="parentOrgType" class="grid column-gap-3">
          <div v-if="parentOrgs.length > 1" class="col-12 mt-3 mb-0 pb-0">
            <p id="section-heading">Assign this {{ orgTypeLabel.toLowerCase() }} to a {{
              parentOrgType.singular }}.</p>
          </div>
          <div v-if="parentOrgs.length > 1" class="col-12 md:col-6 lg:col-3 xl:col-3">
            <span class="p-float-label">
              <Dropdown v-model="state.parentOrg" inputId="parent-org" :options="parentOrgs" showClear optionLabel="name"
                :placeholder="`Select a ${parentOrgType.singular}`" class="w-full" />
              <label for="parent-org">{{ _capitalize(parentOrgType.singular) }}</label>
              <small v-if="v$.parentOrg.$invalid && submitted" class="p-error">
                Please select a {{ parentOrgType.singular }}
              </small>
            </span>
          </div>

          <div v-else-if="parentOrgs.length === 1" class="col-12 md:col-6 lg:col-3 xl:col-3 mt-3">
            <p id="section-heading">
              This {{ orgTypeLabel.toLowerCase() }} will be created in {{ parentOrgType }} {{ parentOrgs[0].name }}.
            </p>
          </div>

          <div v-else class="loading-container">
            <AppSpinner style="margin-bottom: 1rem;" />
            <span>Loading {{ parentOrgType.plural }}</span>
          </div>
        </div>

        <div class="grid column-gap-3 mt-3">
          <div class="col-12 md:col-6 lg:col-3 xl:col-3 mt-3">
            <span class="p-float-label">
              <InputText id="org-name" v-model="state.orgName" class="w-full" />
              <label for="org-name">{{ orgTypeLabel }} Name</label>
              <small v-if="v$.orgName.$invalid && submitted" class="p-error">Please supply a name</small>
            </span>
          </div>

          <div class="col-12 md:col-6 lg:col-3 xl:col-3 mt-3">
            <span class="p-float-label">
              <InputText id="org-initial" v-model="state.orgInitials" class="w-full" />
              <label for="org-initial">{{ orgTypeLabel }} Abbreviation</label>
              <small v-if="v$.orgInitials.$invalid && submitted" class="p-error">Please supply an abbreviation</small>
            </span>
          </div>

          <div class="col-12 md:col-6 lg:col-3 xl:col-3 mt-3" v-if="parentOrgType?.singular === 'school'">
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
            <div v-if="['district', 'school'].includes(orgType?.singular)" class="col-12 md:col-6 lg:col-3 xl:col-3 mt-5">
              <span class="p-float-label">
                <InputText v-model="state.ncesId" v-tooltip="ncesTooltip" inputId="nces-id" class="w-full" />
                <label for="nces-id">NCES ID</label>
              </span>
            </div>
          </div>
          <div class="grid column-gap-3 mt-3">
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

        <div class="grid column-gap-3 mt-3">
          <div class="col-12 md:col-6 lg:col-3 xl:col-3 mt-3">
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
import { computed, reactive, ref, toRaw } from "vue";
import { useRouter } from 'vue-router';
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { storeToRefs } from "pinia";
import _capitalize from "lodash/capitalize";
import _get from "lodash/get";
import _set from "lodash/set";
import _union from "lodash/union";
import _without from "lodash/without";
import { useVuelidate } from "@vuelidate/core";
import { required, requiredIf } from "@vuelidate/validators";
import { useQueryStore } from "@/store/query";
import { useAuthStore } from "@/store/auth";
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import { getSidebarActions } from "../router/sidebarActions";

const state = reactive({
  orgName: "",
  orgInitials: "",
  ncesId: undefined,
  address: undefined,
  parentOrg: undefined,
  grade: undefined,
  tags: [],
})

const rules = {
  orgName: { required },
  orgInitials: { required },
  parentOrg: { required: requiredIf(() => orgType.value.singular === "class") },
  grade: { required: requiredIf(() => orgType.value.singular === "class") }
};

const v$ = useVuelidate(rules, state);
const submitted = ref(false);

const refreshing = ref(false);
const spinIcon = computed(() => {
  if (refreshing.value) return "pi pi-spin pi-spinner";
  return "pi pi-refresh";
});

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

const parentOrgType = computed(() => {
  if (orgType.value?.singular === "school") {
    return { plural: "districts", singular: "district" };
  } else if (orgType.value?.singular === "class") {
    return { plural: "school", singular: "school" };
  }
})

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

const router = useRouter();
const confirm = useConfirm();
const toast = useToast();
const queryStore = useQueryStore();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const { adminOrgs } = storeToRefs(queryStore);
const sidebarActions = ref(getSidebarActions(authStore.isUserSuperAdmin(), true));

const districts = ref(adminOrgs.value.districts || []);
const schools = ref(adminOrgs.value.schools || []);
const classes = ref(adminOrgs.value.classes || []);
const groups = ref(adminOrgs.value.groups || []);

const allTags = computed(() => {
  const districtTags = districts.value.map((org) => org.tags);
  const schoolTags = districts.value.map((org) => org.tags);
  const classTags = classes.value.map((org) => org.tags);
  const groupTags = groups.value.map((org) => org.tags);
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

const parentOrgs = computed(() => {
  if (orgType.value?.singular === "school") {
    return districts.value;
  } else if (orgType.value?.singular === "class") {
    return schools.value;
  }
  return [];
})

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

const preSubmit = (event) => {
  if (orgType.value.singular === "school" && !state.parentOrg) {
    confirm.require({
      target: event.currentTarget,
      message:
        "You created a school that doesn't belong to any district. If you "
        + "continue, we will create a parent pseudo-district using this "
        + "school's data. Are you sure you want to do that?",
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        submit();
      },
      reject: () => {
        return;
      }
    });
  } else {
    submit();
  }
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
      orgData.schoolId = toRaw(state.parentOrg).id;
    } else if (orgType.value?.singular === "school") {
      if (state.parentOrg) {
        orgData.districtId = toRaw(state.parentOrg).id;
      } else {
        const districtData = { ...orgData };
        // The NCES school ID is composed of the 7 digit district ID followed by
        // the 5 digit ID of the school within that district.
        // To create the district ID, we need to take just the first 7 digits
        if (orgData.ncesId) districtData.ncesId = orgData.ncesId.slice(0, 7);
        orgData.districtId = await roarfirekit.value.createOrg('districts', districtData);
      }
    }

    await roarfirekit.value.createOrg(orgType.value.firestoreCollection, orgData).then(() => {
      toast.add({ severity: 'success', summary: 'Success', detail: 'Org created', life: 3000 });
      router.push({ name: 'ListOrgs' });
    })
  } else {
    console.log("Form is invalid");
  }
};

let unsubscribe;

const refresh = async () => {
  if (unsubscribe) unsubscribe();
  refreshing.value = true;
  districts.value = await queryStore.getOrgs("districts");
  schools.value = await queryStore.getOrgs("schools");
  classes.value = await queryStore.getOrgs("classes");
  groups.value = await queryStore.getOrgs("groups");
  refreshing.value = false;
}

if (districts.value.length === 0 || schools.value.length === 0) {
  unsubscribe = authStore.$subscribe(async (mutation, state) => {
    if (state.roarfirekit.getOrgs && state.roarfirekit.isAdmin()) {
      await refresh();
    }
  });
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
