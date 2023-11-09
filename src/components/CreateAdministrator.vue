<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :actions="sidebarActions" />
    </aside>
    <section class="main-body">
      <Panel header="Create a new administrator account">
        Use this form to create a new user and give them administrator access to
        selected organizations.

        <PvDivider />

        <div v-if="initialized && !registering">
          <div class="grid">
            <div class="col-12 md:col-6 lg:col-3 my-3">
              <span class="p-float-label">
                <InputText id="first-name" v-model="firstName" class="w-full" />
                <label for="first-name">First Name</label>
              </span>
            </div>

            <div class="col-12 md:col-6 lg:col-3 my-3">
              <span class="p-float-label">
                <InputText id="middle-name" v-model="middleName" class="w-full" />
                <label for="middle-name">Middle Name</label>
              </span>
            </div>

            <div class="col-12 md:col-6 lg:col-3 my-3">
              <span class="p-float-label">
                <InputText id="last-name" v-model="lastName" class="w-full" />
                <label for="last-name">Last Name</label>
              </span>
            </div>

            <div class="col-12 md:col-6 lg:col-3 my-3">
              <span class="p-float-label">
                <InputText id="email" v-model="email" class="w-full" />
                <label for="email">Email</label>
              </span>
            </div>
          </div>

          <OrgPicker @selection="selection($event)" />

          <PvDivider />

          <div class="grid">
            <div class="col-12">
              <Button label="Create Administrator" @click="submit" />
            </div>
          </div>
        </div>
        <div v-else class="loading-container">
          <AppSpinner style="margin-bottom: 1rem;" />
          <span v-if="initialized">Registering new administrator...</span>
          <span v-else>Initializing...</span>
        </div>
      </Panel>
    </section>
  </main>
</template>

<script setup>
import { computed, ref, onMounted } from "vue";
import { useRouter } from 'vue-router';
import { storeToRefs } from "pinia";
import { useToast } from "primevue/usetoast";
import { useQuery } from "@tanstack/vue-query"
import _cloneDeep from "lodash/cloneDeep";
import _union from "lodash/union";
import { useAuthStore } from "@/store/auth";
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import OrgPicker from "@/components/OrgPicker.vue";
import { getSidebarActions } from "@/router/sidebarActions";
import { fetchDocById } from "@/helpers/query/utils";

const router = useRouter();
const toast = useToast();
const initialized = ref(false);
const registering = ref(false);

const firstName = ref();
const middleName = ref();
const lastName = ref();
const email = ref();

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const { data: userClaims } =
  useQuery({
    queryKey: ['userClaims', authStore.uid],
    queryFn: () => fetchDocById('userClaims', authStore.uid),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));
const sidebarActions = ref(getSidebarActions(isSuperAdmin.value, true));

let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
}

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) init();
})

const selectedOrgs = ref();

const selection = (selected) => {
  selectedOrgs.value = selected;
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
    districts: selectedOrgs.value.districts.map(o => o.id),
    schools: selectedOrgs.value.schools.map(o => o.id),
    classes: selectedOrgs.value.classes.map(o => o.id),
    groups: selectedOrgs.value.groups.map(o => o.id),
    families: selectedOrgs.value.families.map(o => o.id),
  }

  // Build orgs from admin orgs. Orgs should contain all of the admin orgs. And
  // also their parents.
  const orgs = _cloneDeep(adminOrgs)
  for (const school of selectedOrgs.value.schools) {
    orgs.districts = _union(orgs.districts, [school.districtId]);
  }

  for (const _class of selectedOrgs.value.classes) {
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
