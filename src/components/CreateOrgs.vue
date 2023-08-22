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

        <div class="grid mt-4">
          <div class="col-12 mb-2">
            <span class="p-float-label">
              <Dropdown v-model="orgType" inputId="org-type" :options="orgTypes" showClear optionLabel="singular"
                placeholder="Select an org type" class="w-full md:w-30rem" />
              <label for="org-type">Org Type</label>
            </span>
          </div>

          <div class="col-12" v-if="parentOrgType">
            <div v-if="parentOrgs.length > 1">
              <p id="section-heading">Assign this {{ orgTypeLabel.toLowerCase() }} to a {{ parentOrgType.singular }}.</p>
              <span class="p-float-label my-4">
                <Dropdown v-model="parentOrg" inputId="parent-org" :options="parentOrgs" showClear optionLabel="name"
                  :placeholder="`Select a ${parentOrgType.singular}`" class="w-full md:w-14rem" />
                <label for="parent-org">{{ _capitalize(parentOrgType.singular) }}</label>
              </span>
            </div>

            <div v-else-if="parentOrgs.length === 1">
              <p id="section-heading">
                This {{ orgTypeLabel.toLowerCase() }} will be created in {{ parentOrgType }} {{ parentOrgs[0].name }}.
              </p>
            </div>

            <div v-else class="loading-container">
              <AppSpinner style="margin-bottom: 1rem;" />
              <span>Loading {{ parentOrgType.plural }}</span>
            </div>
          </div>

          <div class="col-12 md:col-6 lg:col-3">
            <small v-if="v$.orgName.$invalid && submitted" class="p-error">Please supply a name</small>
            <span class="p-float-label">
              <InputText id="org-name" v-model="state.orgName" class="w-full" />
              <label for="org-name">{{ orgTypeLabel }} Name</label>
            </span>
          </div>

          <div class="col-12 md:col-6 lg:col-3">
            <small v-if="v$.orgInitials.$invalid && submitted" class="p-error">Please supply an abbreviation</small>
            <span class="p-float-label">
              <InputText id="org-initial" v-model="state.orgInitials" class="w-full" />
              <label for="org-initial">{{ orgTypeLabel }} Abbreviation</label>
            </span>
          </div>

          <div class="col-12 md:col-6 lg:col-3" v-if="parentOrgType?.singular === 'school'">
            <span class="p-float-label">
              <Dropdown v-model="grade" inputId="grade" :options="grades" showClear optionLabel="name"
                placeholder="Select a grade" class="w-full" />
              <label for="grade">Grade</label>
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
import { computed, reactive, ref } from "vue";
import { useRouter } from 'vue-router';
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { storeToRefs } from "pinia";
import _capitalize from "lodash/capitalize";
import _get from "lodash/get";
import { useVuelidate } from "@vuelidate/core";
import { required } from "@vuelidate/validators";
import { useQueryStore } from "@/store/query";
import { useAuthStore } from "@/store/auth";
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import { getSidebarActions } from "../router/sidebarActions";

const state = reactive({
  orgName: "",
  orgInitials: "",
})
const rules = {
  orgName: { required },
  orgInitials: { required }
}
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
  { firestoreCollection: 'families', singular: 'family' },
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

const grade = ref();
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
const parentOrgs = computed(() => {
  if (orgType.value?.singular === "school") {
    return districts.value;
  } else if (orgType.value?.singular === "class") {
    return schools.value;
  }
  return [];
})

const parentOrg = ref();

const preSubmit = (event) => {
  if (parentOrgType.value && !parentOrg.value) {
    confirm.require({
      target: event.currentTarget,
      message: `You created a ${orgType.value?.singular} without a parent ${parentOrgType.value?.singular}. Are you sure you want to do this?`,
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

    if (parentOrgType.value?.singular === "school") {
      if (parentOrg.value?.id) {
        orgData.schoolId = parentOrg.value.id;
      }
    } else if (parentOrgType.value?.singular === "district") {
      if (parentOrg.value?.id) {
        orgData.districtId = parentOrg.value.id;
      }
    }

    if (grade.value) orgData.grade = grade.value.value;

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
