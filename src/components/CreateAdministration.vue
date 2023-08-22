<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :actions="sidebarActions" />
    </aside>
    <section class="main-body">
      <Panel header="Create a new administration">
        Use this form to create a new administration and assign it to organizations.

        <Divider />

        <div class="formgrid grid mt-5">
          <div class="field col">
            <span class="p-float-label">
              <InputText id="administration-name" v-model="administrationName" />
              <label for="administration-name">Administration Name</label>
            </span>
          </div>

          <div class="field col">
            <span class="p-float-label">
              <Calendar v-model="dates" :minDate="minStartDate" inputId="dates" :numberOfMonths="2" selectionMode="range"
                :manualInput="false" showIcon showButtonBar />
              <label for="dates">Dates</label>
            </span>
          </div>
        </div>

        <Panel header="Assign this administration to organizations">
          <template #icons>
            <button class="p-panel-header-icon p-link mr-2" @click="refreshOrgs">
              <span :class="spinIcon.orgs"></span>
            </button>
          </template>
          <div class="formgrid grid mt-5 mb-5" v-if="orgsReady">
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
            <span>Loading Organizations</span>
          </div>
        </Panel>

        <Panel class="mt-3" header="Assign this administration to organizations">
          <template #icons>
            <div class="flex flex-row align-items-center justify-content-end">
              <span>Require sequential?</span>
              <InputSwitch class="ml-2" v-model="sequential" />
              <button class="p-panel-header-icon p-link ml-6 mr-2" @click="refreshAssessments">
                <span :class="spinIcon.assessments"></span>
              </button>
            </div>
          </template>

          <PickList v-if="assessments[0].length || assessments[1].length" v-model="assessments"
            :showSourceControls="false" listStyle="height: 21.375rem" dataKey="id" :stripedRows="true" :pt="{
              moveAllToTargetButton: { root: { class: 'hide' } },
              moveAllToSourceButton: { root: { class: 'hide' } },
              targetMoveTopButton: { root: { class: 'hide' } },
              targetMoveBottomButton: { root: { class: 'hide' } },
            }">
            <template #sourceheader>Available</template>
            <template #targetheader>Selected</template>
            <template #item="slotProps">
              <div class="flex flex-wrap p-2 align-items-center gap-3">
                <img class="w-4rem shadow-2 flex-shrink-0 border-round" :src="slotProps.item.task.image || backupImage"
                  :alt="slotProps.item.task.name" />
                <div class="flex-1 flex flex-column gap-2">
                  <span class="font-bold" style="margin-left: 0.625rem">{{ slotProps.item.task.name }}</span>
                  <div class="flex align-items-center gap-2">
                    <i class="pi pi-tag text-sm" style="margin-left: 0.625rem"></i>
                    <span>Variant: {{ slotProps.item.variant.name || slotProps.item.variant.id }}</span>
                  </div>
                </div>
                <Button type="button" rounded size="small" icon="pi pi-info" @click="toggle($event, slotProps.item.id)" />
                <OverlayPanel :ref="paramPanelRefs[slotProps.item.id]">
                  <DataTable stripedRows class="p-datatable-small" tableStyle="min-width: 30rem"
                    :value="toEntryObjects(slotProps.item.variant.params)">
                    <Column field="key" header="Parameter" style="width: 50%"></Column>
                    <Column field="value" header="Value" style="width: 50%"></Column>
                  </DataTable>
                </OverlayPanel>
              </div>
            </template>
          </PickList>
          <div v-else class="loading-container">
            <AppSpinner style="margin-bottom: 1rem;" />
            <span>Loading Assessments</span>
          </div>
        </Panel>

        <div class="col-12 mb-3">
          <Button label="Create Administration" @click="submit" />
        </div>
      </Panel>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref, toRaw } from "vue";
import { useRouter } from 'vue-router';
import { storeToRefs } from "pinia";
import { useToast } from "primevue/usetoast";
import _fromPairs from "lodash/fromPairs";
import _get from "lodash/get";
import _isEmpty from "lodash/isEmpty";
import _toPairs from "lodash/toPairs";
import _union from "lodash/union";
import { useQueryStore } from "@/store/query";
import { useAuthStore } from "@/store/auth";
import AppSpinner from "@/components/AppSpinner.vue";
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";

import { getSidebarActions } from "../router/sidebarActions";

const router = useRouter();
const toast = useToast();

const refreshing = reactive({
  orgs: false,
  assessments: false,
});

const spinIcon = computed(() => ({
  orgs: refreshing.orgs ? "pi pi-spin pi-spinner" : "pi pi-refresh",
  assessments: refreshing.assessments ? "pi pi-spin pi-spinner" : "pi pi-refresh",
}));

let paramPanelRefs = {};

const toEntryObjects = (inputObj) => {
  return _toPairs(inputObj).map(([key, value]) => ({ key, value }));
}

const toggle = (event, id) => {
  console.log("Toggling " + id)
  paramPanelRefs[id].value.toggle(event)
}

const orgsReady = ref(false);

const administrationName = ref("");
const minStartDate = ref(new Date());

const dates = ref();

const authStore = useAuthStore();
const queryStore = useQueryStore();

const sidebarActions = ref(getSidebarActions(authStore.isUserSuperAdmin(), true));

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

const sequential = ref(true);

const { allVariants } = storeToRefs(queryStore);
const assessments = ref([[], []])

const backupImage = "/src/assets/swr-icon.jpeg";

let unsubscribeOrgs;
let unsubscribeAssessments;

const refreshOrgs = async () => {
  refreshing.orgs = true;
  orgsReady.value = false;
  if (unsubscribeOrgs) unsubscribeOrgs();

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
  orgsReady.value = true;
  refreshing.orgs = false;
};

const refreshAssessments = async () => {
  refreshing.assessments = true;
  if (unsubscribeAssessments) unsubscribeAssessments();
  assessments.value = [[], []];

  const requireRegisteredTasks = !roarfirekit.value.superAdmin
  queryStore.getVariants(requireRegisteredTasks).then(() => {
    assessments.value = [allVariants.value, []];
    paramPanelRefs = _fromPairs(allVariants.value.map((variant) => [variant.id, ref()]));
    refreshing.assessments = false;
  });
}

onMounted(() => {
  if (
    districts.value.length === 0
    || schools.value.length === 0
    || classes.value.length === 0
    || groups.value.length === 0
    || families.value.length === 0
  ) {
    console.log("Setting up subscription for orgs")
    unsubscribeOrgs = authStore.$subscribe(async (mutation, state) => {
      console.log("state change for orgs")
      if (state.roarfirekit.getOrgs && state.roarfirekit.isAdmin()) {
        console.log("refreshing orgs")
        await refreshOrgs();
      }
    });
  } else {
    orgsReady.value = true;
  }

  if (allVariants.value.length === 0) {
    console.log("Setting up subscription for assessments")
    unsubscribeAssessments = authStore.$subscribe(async (mutation, state) => {
      console.log("state change for assessments")
      if (state.roarfirekit.getVariants && state.roarfirekit.isAdmin()) {
        console.log("refreshing assessments")
        await refreshAssessments();
      }
    });
  } else {
    assessments.value = [allVariants.value, []];
  }
})

const submit = async () => {
  const submittedAssessments = assessments.value[1].map((assessment) => ({
    taskId: assessment.task.id,
    params: toRaw(assessment.variant.params),
  }));
  const orgs = {
    districts: selectedDistricts.value.map((org) => org.id),
    schools: selectedSchools.value.map((org) => org.id),
    classes: selectedClasses.value.map((org) => org.id),
    groups: selectedGroups.value.map((org) => org.id),
    families: selectedFamilies.value.map((org) => org.id),
  }

  const args = {
    name: administrationName.value,
    assessments: submittedAssessments,
    dateOpen: dates.value[0],
    dateClose: dates.value[1],
    sequential: sequential.value,
    orgs: orgs,
  }

  await roarfirekit.value.createAdministration(args).then(() => {
    toast.add({ severity: 'success', summary: 'Success', detail: 'Administration created', life: 3000 });

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
