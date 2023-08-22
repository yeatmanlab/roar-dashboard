<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :actions="sidebarActions" />
    </aside>
    <section class="main-body">
      <Panel header="Create a new administrator account">
        <template #icons>
          <button class="p-panel-header-icon p-link mr-2" @click="refresh">
            <span :class="spinIcon"></span>
          </button>
        </template>

        Use this form to create a new user and give them administrator access to
        selected organizations.

        <Divider />

        <div v-if="!registering">
          <div class="grid">
            <div class="col-12 md:col-6 lg:col-3 my-2">
              <span class="p-float-label">
                <InputText id="first-name" v-model="firstName" />
                <label for="first-name">First Name</label>
              </span>
            </div>

            <div class="col-12 md:col-6 lg:col-3 my-2">
              <span class="p-float-label">
                <InputText id="middle-name" v-model="middleName" />
                <label for="middle-name">Middle Name</label>
              </span>
            </div>

            <div class="col-12 md:col-6 lg:col-3 my-2">
              <span class="p-float-label">
                <InputText id="last-name" v-model="lastName" />
                <label for="last-name">Last Name</label>
              </span>
            </div>

            <div class="col-12 md:col-6 lg:col-3 my-2">
              <span class="p-float-label">
                <InputText id="email" v-model="email" />
                <label for="email">Email</label>
              </span>
            </div>
          </div>

          <p id="section-heading">Select organizations that this user will have admin priviledges for.</p>
          <div class="formgrid grid mt-5 mb-5" v-if="!refreshing">
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
          <div v-else class="loading-container">
            <AppSpinner style="margin-bottom: 1rem;" />
            <span>Loading Orgs</span>
          </div>

          <Divider />

          <div class="grid">
            <div class="col-12">
              <Button label="Create Administrator" @click="submit" />
            </div>
          </div>
        </div>
        <div v-else class="loading-container">
          <AppSpinner style="margin-bottom: 1rem;" />
          <span>Registering new administrator...</span>
        </div>
      </Panel>
    </section>
  </main>
</template>

<script setup>
import { computed, ref } from "vue";
import { useRouter } from 'vue-router';
import { storeToRefs } from "pinia";
import { useToast } from "primevue/usetoast";
import _cloneDeep from "lodash/cloneDeep";
import _union from "lodash/union";
import { useQueryStore } from "@/store/query";
import { useAuthStore } from "@/store/auth";
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import { getSidebarActions } from "../router/sidebarActions";

const router = useRouter();
const toast = useToast();

const registering = ref(false);
const refreshing = ref(false);
const spinIcon = computed(() => {
  if (refreshing.value) return "pi pi-spin pi-spinner";
  return "pi pi-refresh";
});

const firstName = ref();
const middleName = ref();
const lastName = ref();
const email = ref();

const authStore = useAuthStore();
const queryStore = useQueryStore();

const sidebarActions = ref(getSidebarActions(authStore.isUserSuperAdmin(), true));

const { roarfirekit } = storeToRefs(authStore);
const { adminOrgs } = storeToRefs(queryStore);
const districts = ref(adminOrgs.value.districts || []);
const schools = ref(adminOrgs.value.schools || []);
const classes = ref(adminOrgs.value.classes || []);
const groups = ref(adminOrgs.value.groups || []);
const families = ref(adminOrgs.value.families || []);

const selectedDistricts = ref([]);
const selectedSchools = ref([]);
const selectedClasses = ref([]);
const selectedGroups = ref([]);
const selectedFamilies = ref([]);

let unsubscribe;

const refresh = async () => {
  if (unsubscribe) unsubscribe();
  refreshing.value = true;

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

  refreshing.value = false;
}

if (
  districts.value.length === 0
  || schools.value.length === 0
  || classes.value.length === 0
  || groups.value.length === 0
  || families.value.length === 0
) {
  refreshing.value = true;
  unsubscribe = authStore.$subscribe(async (mutation, state) => {
    if (state.roarfirekit.getOrgs && state.roarfirekit.createAdministrator && state.roarfirekit.isAdmin()) {
      await refresh();
    }
  });
}

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

  registering.value = true;

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
