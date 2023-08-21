<template>
  <router-link :to="{ name: 'Home' }" class="return-button">
    <Button icon="pi pi-angle-left" label="Return to Dashboard" />
  </router-link>
  <div class="card" id="rectangle" v-if="formReady">
    <span id="heading">Create a new administrator account</span>
    <p id="section-heading">Use this form to create a new user and designate them as an administrator for some
      organization.</p>
    <hr>
    <div class="formgrid grid mt-5">
      <div class="field col">
        <span class="p-float-label">
          <InputText id="first-name" v-model="firstName" />
          <label for="first-name">First Name</label>
        </span>
      </div>

      <div class="field col">
        <span class="p-float-label">
          <InputText id="middle-name" v-model="middleName" />
          <label for="middle-name">Middle Name</label>
        </span>
      </div>

      <div class="field col">
        <span class="p-float-label">
          <InputText id="last-name" v-model="lastName" />
          <label for="last-name">Last Name</label>
        </span>
      </div>

      <div class="field col">
        <span class="p-float-label">
          <InputText id="email" v-model="email" />
          <label for="email">Email</label>
        </span>
      </div>
    </div>

    <div style="width: fit-content;">
      <p id="section-heading">Select organizations that this user will have admin priviledges for.</p>
    </div>
    <div class="formgrid grid mt-5 mb-5">
      <div class="field col" v-if="districts.length > 0">
        <span class="p-float-label">
          <MultiSelect v-model="selectedDistricts" :options="districts" optionLabel="name" class="w-full md:w-14rem"
            inputId="districts" />
          <label for="districts">Districts</label>
        </span>
      </div>

      <div class="field col" v-if="schools.length > 0">
        <span class="p-float-label">
          <MultiSelect v-model="selectedSchools" :options="schools" optionLabel="name" class="w-full md:w-14rem"
            inputId="schools" />
          <label for="schools">Schools</label>
        </span>
      </div>

      <div class="field col" v-if="classes.length > 0">
        <span class="p-float-label">
          <MultiSelect v-model="selectedClasses" :options="classes" optionLabel="name" class="w-full md:w-14rem"
            inputId="classes" />
          <label for="classes">Classes</label>
        </span>
      </div>

      <div class="field col" v-if="groups.length > 0">
        <span class="p-float-label">
          <MultiSelect v-model="selectedGroups" :options="groups" optionLabel="name" class="w-full md:w-14rem"
            inputId="groups" />
          <label for="groups">Groups</label>
        </span>
      </div>

      <div class="field col" v-if="families.length > 0">
        <span class="p-float-label">
          <MultiSelect v-model="selectedFamilies" :options="families" optionLabel="name" class="w-full md:w-14rem"
            inputId="families" />
          <label for="families">Families</label>
        </span>
      </div>
    </div>

    <div class="col-12 mb-3">
      <Button label="Create Administrator" @click="submit" />
    </div>
  </div>
  <div v-else class="loading-container">
    <AppSpinner style="margin-bottom: 1rem;" />
    <span>Loading Org Data</span>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from 'vue-router';
import { storeToRefs } from "pinia";
import { useToast } from "primevue/usetoast";
import _cloneDeep from "lodash/cloneDeep";
import _union from "lodash/union";
import { useQueryStore } from "@/store/query";
import { useAuthStore } from "@/store/auth";
import AppSpinner from "./AppSpinner.vue";

const router = useRouter();
const toast = useToast();

const formReady = ref(false);

const firstName = ref();
const middleName = ref();
const lastName = ref();
const email = ref();

const authStore = useAuthStore();
const queryStore = useQueryStore();

const { roarfirekit } = storeToRefs(authStore);

const districts = ref([]);
const schools = ref([]);
const classes = ref([]);
const groups = ref([]);
const families = ref([]);

const selectedDistricts = ref([]);
const selectedSchools = ref([]);
const selectedClasses = ref([]);
const selectedGroups = ref([]);
const selectedFamilies = ref([]);

const initFormFields = async () => {
  unsubscribe();

  const promises = [
    queryStore.getOrgs("districts"),
    queryStore.getOrgs("schools"),
    queryStore.getOrgs("classes"),
    queryStore.getOrgs("groups"),
    queryStore.getOrgs("families"),
  ]

  const [_districts, _schools, _classes, _groups, _families] = await Promise.all(promises);

  districts.value = _districts;
  schools.value = _schools;
  classes.value = _classes;
  groups.value = _groups;
  families.value = _families;

  formReady.value = true;
}

const unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.getOrgs && state.roarfirekit.createAdministrator && state.roarfirekit.isAdmin()) {
    await initFormFields();
  }
});

const submit = async () => {
  const validEmail = await roarfirekit.value.isEmailAvailable(email.value);

  if (!validEmail) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: `Email ${email.value} is already in use. Please enter a different email address.`,
      life: 5000,
    });
    return;
  }

  const name = {
    first: firstName.value,
    middle: middleName.value,
    last: lastName.value,
  }

  const adminOrgs = {
    districts: selectedDistricts.value.map(o => o.id),
    schools: selectedSchools.value.map(o => o.id),
    classes: selectedClasses.value.map(o => o.id),
    groups: selectedGroups.value.map(o => o.id),
    families: selectedFamilies.value.map(o => o.id),
  }

  // Build orgs from admin orgs. Orgs should contain all of the admin orgs. And
  // also their parents.
  const orgs = _cloneDeep(adminOrgs)
  for (const school of selectedSchools.value) {
    orgs.districts = _union(orgs.districts, [school.districtId]);
  }

  for (const _class of selectedClasses.value) {
    orgs.districts = _union(orgs.districts, [_class.districtId]);
    orgs.schools = _union(orgs.schools, [_class.schoolId]);
  }

  formReady.value = false;
  await roarfirekit.value.createAdministrator(email.value, name, orgs, adminOrgs).then(() => {
    toast.add({ severity: 'success', summary: 'Success', detail: 'Administrator account created', life: 5000 });
    router.push({ name: "Home" });
  });
}
</script> 

<style lang="scss">
.return-button {
  display: block;
  margin: 1rem 1.75rem;
}

.loading-container {
  width: 100%;
  text-align: center;
}

.orgs-container {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  margin-top: -1rem;
  margin-bottom: 1rem;
}

.org-dropdown {
  margin-right: 3rem;
  margin-top: 2rem;
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

  .p-dropdown-label {
    font-family: 'Source Sans Pro', sans-serif;
    color: #C4C4C4;
  }

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
