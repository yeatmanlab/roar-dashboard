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
              <InputText id="administration-name" v-model="state.administrationName" />
              <label for="administration-name">Administration Name</label>
              <small v-if="v$.administrationName.$invalid && submitted" class="p-error">Please name your
                administration</small>
            </span>
          </div>

          <div class="field col">
            <span class="p-float-label">
              <Calendar v-model="state.dates" :minDate="minStartDate" inputId="dates" :numberOfMonths="2"
                selectionMode="range" :manualInput="false" showIcon showButtonBar />
              <label for="dates">Dates</label>
              <small v-if="v$.dates.required.$invalid && submitted" class="p-error">Please select dates.</small>
              <small v-else-if="v$.dates.datesNotNull.$invalid && submitted" class="p-error">Please select both a start
                and end
                date.</small>
            </span>
          </div>
        </div>

        <Panel header="Assign this administration to organizations">
          <template #icons>
            <button class="p-panel-header-icon p-link mr-2" @click="refreshOrgs">
              <span :class="spinIcon.orgs"></span>
            </button>
          </template>
          <div v-if="orgError" class="p-error">{{ orgError }}</div>
          <div class="formgrid grid mt-5 mb-5" v-if="orgsReady">
            <div class="field col" v-if="districts.length > 0">
              <span class="p-float-label">
                <MultiSelect v-model="state.districts" :options="districts" optionLabel="name" class="w-full md:w-14rem"
                  inputId="districts" />
                <label for="districts">Districts</label>
              </span>
            </div>

            <div class="field col" v-if="schools.length > 0">
              <span class="p-float-label">
                <MultiSelect v-model="state.schools" :options="schools" optionLabel="name" class="w-full md:w-14rem"
                  inputId="schools" />
                <label for="schools">Schools</label>
              </span>
            </div>

            <div class="field col" v-if="classes.length > 0">
              <span class="p-float-label">
                <MultiSelect v-model="state.classes" :options="classes" optionLabel="name" class="w-full md:w-14rem"
                  inputId="classes" />
                <label for="classes">Classes</label>
              </span>
            </div>

            <div class="field col" v-if="groups.length > 0">
              <span class="p-float-label">
                <MultiSelect v-model="state.groups" :options="groups" optionLabel="name" class="w-full md:w-14rem"
                  inputId="groups" />
                <label for="groups">Groups</label>
              </span>
            </div>

            <div class="field col" v-if="families.length > 0">
              <span class="p-float-label">
                <MultiSelect v-model="state.families" :options="families" optionLabel="name" class="w-full md:w-14rem"
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
              <small v-if="v$.sequential.$invalid && submitted" class="p-error">Please select one.</small>
              <span>Require sequential?</span>
              <InputSwitch class="ml-2" v-model="state.sequential" />
              <button class="p-panel-header-icon p-link ml-6 mr-2" @click="refreshAssessments">
                <span :class="spinIcon.assessments"></span>
              </button>
            </div>
          </template>

          <div v-if="pickListError" class="p-error">{{ pickListError }}</div>
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
                <Button type="button" v-tooltip.right="'Click to view params'" rounded size="small" icon="pi pi-info"
                  @click="toggle($event, slotProps.item.id)" />
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
import _filter from "lodash/filter"
import _forEach from "lodash/forEach"
import _fromPairs from "lodash/fromPairs";
import _get from "lodash/get";
import _isEmpty from "lodash/isEmpty";
import _toPairs from "lodash/toPairs";
import _union from "lodash/union";
import _uniqBy from "lodash/uniqBy";
import { useVuelidate } from "@vuelidate/core";
import { maxLength, minLength, required } from "@vuelidate/validators";
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

const state = reactive({
  administrationName: "",
  dates: [],
  sequential: true,
  districts: [],
  schools: [],
  classes: [],
  groups: [],
  families: []
})

const datesNotNull = (value) => {
  value[0] && value[1];
}

const rules = {
  administrationName: { required },
  dates: {
    required,
    minLength: minLength(2),
    maxLength: maxLength(2),
    datesNotNull,
  },
  sequential: { required }
}
const v$ = useVuelidate(rules, state);
const pickListError = ref('');
const orgError = ref('');
const submitted = ref(false);

let paramPanelRefs = {};

const toEntryObjects = (inputObj) => {
  return _toPairs(inputObj).map(([key, value]) => ({ key, value }));
}

const toggle = (event, id) => {
  paramPanelRefs[id].value.toggle(event)
}

const orgsReady = ref(false);

const minStartDate = ref(new Date());

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

const { allVariants } = storeToRefs(queryStore);
const assessments = ref([[], []])

const backupImage = "/src/assets/swr-icon.jpeg";

const checkForUniqueTasks = (assignments) => {
  if (_isEmpty(assignments)) return false;
  const uniqueTasks = _uniqBy(assignments, (assignment) => assignment.taskId)
  return (uniqueTasks.length === assignments.length)
}
const checkForRequiredOrgs = (orgs) => {
  const filtered = _filter(orgs, org => !_isEmpty(org))
  return Boolean(filtered.length)
}

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

if (
  districts.value.length === 0
  || schools.value.length === 0
  || classes.value.length === 0
  || groups.value.length === 0
  || families.value.length === 0
) {
  unsubscribeOrgs = authStore.$subscribe(async (mutation, state) => {
    if (state.roarfirekit.getOrgs && state.roarfirekit.isAdmin()) {
      await refreshOrgs();
    }
  });
} else {
  orgsReady.value = true;
}

if (allVariants.value.length === 0) {
  unsubscribeAssessments = authStore.$subscribe(async (mutation, state) => {
    if (state.roarfirekit.getVariants && state.roarfirekit.isAdmin()) {
      await refreshAssessments();
    }
  });
} else {
  assessments.value = [allVariants.value, []];
}

onMounted(async () => {
  if (roarfirekit.value.getVariants && roarfirekit.value.isAdmin()) {
    await refreshAssessments();
  }
  if (roarfirekit.value.getOrgs && roarfirekit.value.isAdmin()) {
    await refreshOrgs();
  }
})

const submit = async () => {
  pickListError.value = ''
  submitted.value = true;
  const isFormValid = await v$.value.$validate()
  if (isFormValid) {
    const submittedAssessments = assessments.value[1].map((assessment) => ({
      taskId: assessment.task.id,
      params: toRaw(assessment.variant.params),
    }));

    const tasksUnique = checkForUniqueTasks(submittedAssessments)
    if (tasksUnique && !_isEmpty(submittedAssessments)) {
      const orgs = {
        districts: toRaw(state.districts).map((org) => org.id),
        schools: toRaw(state.schools).map((org) => org.id),
        classes: toRaw(state.classes).map((org) => org.id),
        groups: toRaw(state.groups).map((org) => org.id),
        families: toRaw(state.families).map((org) => org.id),
      }

      const orgsValid = checkForRequiredOrgs(orgs);
      if (orgsValid) {
        const args = {
          name: toRaw(state).administrationName,
          assessments: submittedAssessments,
          dateOpen: toRaw(state).dates[0],
          dateClose: toRaw(state).dates[1],
          sequential: toRaw(state).sequential,
          orgs: orgs,
        }

        await roarfirekit.value.createAdministration(args).then(() => {
          toast.add({ severity: 'success', summary: 'Success', detail: 'Administration created', life: 3000 });

          router.push({ name: "Home" });
        });
      } else {
        console.log('need at least one org')
        orgError.value = 'At least one organization needs to be selected.'
      }
    } else {
      pickListError.value = 'Task selections must not be empty and must be unique.'
    }
  } else {
    console.log('form is invalid')
  }
};
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
