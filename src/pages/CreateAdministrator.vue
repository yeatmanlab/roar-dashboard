<template>
  <main class="container main">
    <section class="main-body">
      <div class="flex flex-column">
        <div class="flex flex-column mb-5 gap-2">
          <div class="flex align-items-center flex-wrap gap-3 mb-2">
            <i class="pi pi-user-plus text-gray-400 rounded" style="font-size: 1.6rem" />
            <div class="admin-page-header">Create a new administrator account</div>
          </div>
          <div class="text-md text-gray-500 ml-6">
            Use this form to create a new user and give them administrator access to selected organizations.
          </div>
        </div>

        <div v-if="initialized && !registering" class="w-full">
          <div class="grid">
            <div class="col-12 md:col-6 lg:col-3 my-3">
              <PvFloatLabel>
                <PvInputText
                  id="first-name"
                  v-model="firstName"
                  class="w-full"
                  data-cy="input-administrator-first-name"
                />
                <label for="first-name">First Name</label>
              </PvFloatLabel>
            </div>

            <div class="col-12 md:col-6 lg:col-3 my-3">
              <PvFloatLabel>
                <PvInputText
                  id="middle-name"
                  v-model="middleName"
                  class="w-full"
                  data-cy="input-administrator-middle-name"
                />
                <label for="middle-name">Middle Name</label>
              </PvFloatLabel>
            </div>

            <div class="col-12 md:col-6 lg:col-3 my-3">
              <PvFloatLabel>
                <PvInputText id="last-name" v-model="lastName" class="w-full" data-cy="input-administrator-last-name" />
                <label for="last-name">Last Name</label>
              </PvFloatLabel>
            </div>

            <div class="col-12 md:col-6 lg:col-3 my-3">
              <PvFloatLabel>
                <PvInputText id="email" v-model="email" class="w-full" data-cy="input-administrator-email" />
                <label for="email">Email</label>
              </PvFloatLabel>
            </div>
          </div>

          <GroupPicker @selection="selection($event)" />
          <div class="flex flex-row align-items-center justify-content-center gap-2 flex-order-0 my-3">
            <div class="flex flex-row align-items-center">
              <PvCheckbox v-model="isTestData" input-id="chbx-externalTask" :binary="true" />
              <label class="ml-1 mr-3" for="chbx-externalTask">Mark as <b>Test Administrator</b></label>
            </div>
          </div>

          <PvDivider />

          <div class="flex w-full align-items-center justify-content-center">
            <div>
              <PvButton
                class="bg-primary text-white border-none border-round p-2 h-3rem hover:bg-red-900"
                label="Create Administrator"
                data-cy="button-create-administrator"
                @click="submit"
              />
            </div>
          </div>
        </div>
        <div v-else class="loading-container">
          <AppSpinner style="margin-bottom: 1rem" />
          <span v-if="initialized">Registering new administrator...</span>
          <span v-else>Initializing...</span>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';
import PvButton from 'primevue/button';
import PvCheckbox from 'primevue/checkbox';
import PvDivider from 'primevue/divider';
import PvInputText from 'primevue/inputtext';
import _cloneDeep from 'lodash/cloneDeep';
import _union from 'lodash/union';
import { useAuthStore } from '@/store/auth';
import GroupPicker from '@/components/GroupPicker.vue';
import PvFloatLabel from 'primevue/floatlabel';
import { TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';
const router = useRouter();
const toast = useToast();
const initialized = ref(false);
const registering = ref(false);

const firstName = ref();
const middleName = ref();
const lastName = ref();
const email = ref();
const isTestData = ref(false);

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) init();
});

const selectedOrgs = ref();

const selection = (selected) => {
  selectedOrgs.value = selected;
};

const submit = async () => {
  const validEmail = await roarfirekit.value.isEmailAvailable(email.value);
  if (!validEmail) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: `Email ${email.value} is already in use. Please enter a different email address.`,
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
    return;
  }

  registering.value = true;

  const name = {
    first: firstName.value,
    middle: middleName.value,
    last: lastName.value,
  };

  const adminOrgs = {
    districts: selectedOrgs.value?.districts?.map((o) => o.id) ?? [],
    schools: selectedOrgs.value?.schools?.map((o) => o.id) ?? [],
    classes: selectedOrgs.value?.classes?.map((o) => o.id) ?? [],
    groups: selectedOrgs.value?.groups?.map((o) => o.id) ?? [],
    families: selectedOrgs.value?.families?.map((o) => o.id) ?? [],
  };

  // Build orgs from admin orgs. Orgs should contain all of the admin orgs. And
  // also their parents.
  const orgs = _cloneDeep(adminOrgs);

  for (const school of selectedOrgs.value?.schools ?? []) {
    orgs.districts = _union(orgs.districts, [school.districtId]);
  }

  for (const _class of selectedOrgs.value?.classes ?? []) {
    orgs.districts = _union(orgs.districts, [_class.districtId]);
    orgs.schools = _union(orgs.schools, [_class.schoolId]);
  }

  await roarfirekit.value
    .createAdministrator(email.value, name, orgs, adminOrgs, isTestData.value)
    .then(() => {
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Administrator account created',
        life: 5000,
      });
      router.push({ name: 'Home' });
    })
    .catch((error) => {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message,
        life: 5000,
      });
      console.error(error);
    });
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
</style>
