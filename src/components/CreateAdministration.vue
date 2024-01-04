<template>
  <main class="container main">
    <section class="main-body">
      <PvPanel header="Create a new administration">
        Use this form to create a new administration and assign it to organizations.

        <PvDivider />

        <div class="formgrid grid mt-5">
          <div class="field col">
            <span class="p-float-label">
              <PvInputText id="administration-name" v-model="state.administrationName" />
              <label for="administration-name">Administration Name</label>
              <small v-if="v$.administrationName.$invalid && submitted" class="p-error"
                >Please name your administration</small
              >
            </span>
          </div>

          <div class="field col">
            <span class="p-float-label">
              <PvCalendar
                v-model="state.dates"
                :min-date="minStartDate"
                input-id="dates"
                :number-of-months="2"
                selection-mode="range"
                :manual-input="false"
                show-icon
                show-button-bar
              />
              <label for="dates">Dates</label>
              <small v-if="v$.dates.required.$invalid && submitted" class="p-error">Please select dates.</small>
              <small v-else-if="v$.dates.datesNotNull.$invalid && submitted" class="p-error"
                >Please select both a start and end date.</small
              >
            </span>
          </div>
        </div>

        <OrgPicker @selection="selection($event)" />

        <PvPanel class="mt-3" header="Select assessments for this administration">
          <template #icons>
            <div class="flex flex-row align-items-center justify-content-end">
              <small v-if="v$.sequential.$invalid && submitted" class="p-error">Please select one.</small>
              <span>Require sequential?</span>
              <PvInputSwitch v-model="state.sequential" class="ml-2" />
            </div>
          </template>

          <div v-if="pickListError" class="p-error">{{ pickListError }}</div>
          <PvPickList
            v-if="assessments[0].length || assessments[1].length"
            v-model="assessments"
            :show-source-controls="false"
            list-style="height: 21.375rem"
            data-key="id"
            :striped-rows="true"
            :pt="{
              moveAllToTargetButton: { root: { class: 'hide' } },
              moveAllToSourceButton: { root: { class: 'hide' } },
              targetMoveTopButton: { root: { class: 'hide' } },
              targetMoveBottomButton: { root: { class: 'hide' } },
            }"
          >
            <template #sourceheader>Available</template>
            <template #targetheader>Selected</template>
            <template #item="slotProps">
              <div class="flex flex-wrap p-2 align-items-center gap-3">
                <img
                  class="w-4rem shadow-2 flex-shrink-0 border-round"
                  :src="slotProps.item.task.image || backupImage"
                  :alt="slotProps.item.task.name"
                />
                <div class="flex-1 flex flex-column gap-2">
                  <span class="font-bold" style="margin-left: 0.625rem">{{ slotProps.item.task.name }}</span>
                  <div class="flex align-items-center gap-2">
                    <i class="pi pi-tag text-sm" style="margin-left: 0.625rem"></i>
                    <span>Variant: {{ slotProps.item.variant.name || slotProps.item.variant.id }}</span>
                  </div>
                </div>
                <PvButton
                  v-tooltip.right="'Click to view params'"
                  type="button"
                  rounded
                  size="small"
                  icon="pi pi-info"
                  @click="toggle($event, slotProps.item.id)"
                />
                <PvOverlayPanel :ref="paramPanelRefs[slotProps.item.id]">
                  <PvDataTable
                    striped-rows
                    class="p-datatable-small"
                    table-style="min-width: 30rem"
                    :value="toEntryObjects(slotProps.item.variant.params)"
                  >
                    <PvColumn field="key" header="Parameter" style="width: 50%"></PvColumn>
                    <PvColumn field="value" header="Value" style="width: 50%"></PvColumn>
                  </PvDataTable>
                </PvOverlayPanel>
              </div>
            </template>
          </PvPickList>
          <div v-else class="loading-container">
            <AppSpinner style="margin-bottom: 1rem" />
            <span>Loading Assessments</span>
          </div>
        </PvPanel>

        <div class="col-12 mb-3">
          <PvButton label="Create Administration" @click="submit" />
        </div>
      </PvPanel>
    </section>
  </main>
</template>

<script setup>
import { onMounted, reactive, ref, toRaw, watch } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { useQuery } from '@tanstack/vue-query';
import _filter from 'lodash/filter';
import _fromPairs from 'lodash/fromPairs';
import _isEmpty from 'lodash/isEmpty';
import _toPairs from 'lodash/toPairs';
import _uniqBy from 'lodash/uniqBy';
import { useVuelidate } from '@vuelidate/core';
import { maxLength, minLength, required } from '@vuelidate/validators';
import { useAuthStore } from '@/store/auth';
import AppSpinner from '@/components/AppSpinner.vue';
// import AdministratorSidebar from '@/components/AdministratorSidebar.vue';
import OrgPicker from '@/components/OrgPicker.vue';
// import { getSidebarActions } from '@/router/sidebarActions';
// import { fetchDocById } from '@/helpers/query/utils';
import { variantsFetcher } from '@/helpers/query/tasks';

const router = useRouter();
const toast = useToast();
const initialized = ref(false);

const authStore = useAuthStore();
const { roarfirekit, administrationQueryKeyIndex } = storeToRefs(authStore);

// const { data: userClaims } = useQuery({
//   queryKey: ['userClaims', authStore.uid],
//   queryFn: () => fetchDocById('userClaims', authStore.uid),
//   keepPreviousData: true,
//   enabled: initialized,
//   staleTime: 5 * 60 * 1000, // 5 minutes
// });

// const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));
// const sidebarActions = ref(getSidebarActions(isSuperAdmin.value, true));

const { data: allVariants, isLoading: isLoadingVariants } = useQuery({
  queryKey: ['variants', 'all'],
  queryFn: () => variantsFetcher(),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

//      +---------------------------------+
// -----| Form state and validation rules |-----
//      +---------------------------------+
const state = reactive({
  administrationName: '',
  dates: [],
  sequential: true,
  districts: [],
  schools: [],
  classes: [],
  groups: [],
  families: [],
});

const datesNotNull = (value) => {
  return value[0] && value[1];
};

const minStartDate = ref(new Date());

const rules = {
  administrationName: { required },
  dates: {
    required,
    minLength: minLength(2),
    maxLength: maxLength(2),
    datesNotNull,
  },
  sequential: { required },
};
const v$ = useVuelidate(rules, state);
const pickListError = ref('');
const orgError = ref('');
const submitted = ref(false);

//      +---------------------------------+
// -----|          Org Selection          |-----
//      +---------------------------------+
const selection = (selected) => {
  for (const [key, value] of _toPairs(selected)) {
    state[key] = value;
  }
};

//      +---------------------------------+
// -----|       Assessment Selection      |-----
//      +---------------------------------+
let paramPanelRefs = {};

const toEntryObjects = (inputObj) => {
  return _toPairs(inputObj).map(([key, value]) => ({ key, value }));
};

const toggle = (event, id) => {
  paramPanelRefs[id].value.toggle(event);
};

const assessments = ref([[], []]);

const backupImage = '/src/assets/swr-icon.jpeg';

const checkForUniqueTasks = (assignments) => {
  if (_isEmpty(assignments)) return false;
  const uniqueTasks = _uniqBy(assignments, (assignment) => assignment.taskId);
  return uniqueTasks.length === assignments.length;
};

const checkForRequiredOrgs = (orgs) => {
  const filtered = _filter(orgs, (org) => !_isEmpty(org));
  return Boolean(filtered.length);
};

watch(isLoadingVariants, (value) => {
  if (!value && allVariants.value.length > 0) {
    assessments.value = [allVariants.value, []];
    paramPanelRefs = _fromPairs(allVariants.value.map((variant) => [variant.id, ref()]));
  }
});

//      +---------------------------------+
// -----|         Form submission         |-----
//      +---------------------------------+
const submit = async () => {
  pickListError.value = '';
  submitted.value = true;
  const isFormValid = await v$.value.$validate();
  if (isFormValid) {
    const submittedAssessments = assessments.value[1].map((assessment) => ({
      taskId: assessment.task.id,
      params: toRaw(assessment.variant.params),
    }));

    const tasksUnique = checkForUniqueTasks(submittedAssessments);
    if (tasksUnique && !_isEmpty(submittedAssessments)) {
      const orgs = {
        districts: toRaw(state.districts).map((org) => org.id),
        schools: toRaw(state.schools).map((org) => org.id),
        classes: toRaw(state.classes).map((org) => org.id),
        groups: toRaw(state.groups).map((org) => org.id),
        families: toRaw(state.families).map((org) => org.id),
      };

      const orgsValid = checkForRequiredOrgs(orgs);
      if (orgsValid) {
        const args = {
          name: toRaw(state).administrationName,
          assessments: submittedAssessments,
          dateOpen: toRaw(state).dates[0],
          dateClose: toRaw(state).dates[1],
          sequential: toRaw(state).sequential,
          orgs: orgs,
        };

        await roarfirekit.value.createAdministration(args).then(() => {
          toast.add({ severity: 'success', summary: 'Success', detail: 'Administration created', life: 3000 });
          administrationQueryKeyIndex.value += 1;

          router.push({ name: 'Home' });
        });
      } else {
        console.log('need at least one org');
        orgError.value = 'At least one organization needs to be selected.';
      }
    } else {
      pickListError.value = 'Task selections must not be empty and must be unique.';
    }
  } else {
    console.log('form is invalid');
  }
};

//      +-----------------------------------+
// -----| Lifecycle hooks and subscriptions |-----
//      +-----------------------------------+
let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

onMounted(async () => {
  if (roarfirekit.value.restConfig) init();
});
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

  .p-dropdown-label {
    font-family: 'Source Sans Pro', sans-serif;
    color: #c4c4c4;
  }

  ::placeholder {
    font-family: 'Source Sans Pro', sans-serif;
    color: #c4c4c4;
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
