<template>
  <main class="container main">
    <section class="main-body">
      <PvPanel header="Create a new administration">
        Use this form to create a new administration and assign it to organizations.

        <PvDivider />
        <div class="formgrid grid mt-5">
          <div class="field col">
            <span class="p-float-label">
              <PvInputText
                id="administration-name"
                v-model="state.administrationName"
                data-cy="input-administration-name"
              />
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
                data-cy="input-calendar"
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

        <TaskPicker
          :allVariants="variantsByTaskId"
          :set-variants="setVariants"
          @variants-changed="handleVariantsChanged"
        />

        <div class="flex flex-row justify-content-end">
          <div class="flex flex-column mt-2 align-items-end">
            <label style="font-weight: bold; font-size: large" class="mb-2">Sequential?</label>
            <span class="flex gap-2">
              <PvRadioButton v-model="state.sequential" inputId="Yes" :value="true" />
              <label for="Yes">Yes</label>
              <PvRadioButton v-model="state.sequential" inputId="No" :value="false" />
              <label for="No">No</label>
            </span>
            <small v-if="v$.sequential.$invalid && submitted" class="p-error mt-2"
              >Please specify sequential behavior.</small
            >
          </div>
          <div class="divider ml-2 mr-2" />
          <div class="mb-2">
            <div class="mt-2 mb-2">
              <PvCheckbox :binary="true" v-model="isTestData" inputId="isTestData" />
              <label for="isTestData" class="ml-2">This is Test Data</label>
            </div>
            <PvButton
              label="Create Administration"
              data-cy="button-create-administration"
              @click="submit"
              style="margin: 0"
            />
          </div>
        </div>
      </PvPanel>
    </section>
  </main>
</template>

<script setup>
import { onMounted, reactive, ref, toRaw, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { useQuery } from '@tanstack/vue-query';
import _filter from 'lodash/filter';
import _fromPairs from 'lodash/fromPairs';
import _isEmpty from 'lodash/isEmpty';
import _toPairs from 'lodash/toPairs';
import _uniqBy from 'lodash/uniqBy';
import _groupBy from 'lodash/groupBy';
import { useVuelidate } from '@vuelidate/core';
import { maxLength, minLength, required } from '@vuelidate/validators';
import { useAuthStore } from '@/store/auth';
import AppSpinner from '@/components/AppSpinner.vue';
import OrgPicker from '@/components/OrgPicker.vue';
import { variantsFetcher } from '@/helpers/query/tasks';
import TaskPicker from './TaskPicker.vue';

const router = useRouter();
const toast = useToast();
const initialized = ref(false);

const authStore = useAuthStore();
const { roarfirekit, administrationQueryKeyIndex } = storeToRefs(authStore);

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
  sequential: null,
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
const isTestData = ref(false);

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
const variants = ref([]);
const variantsByTaskId = computed(() => {
  return _groupBy(allVariants.value, 'task.id');
});

const handleVariantsChanged = (variants) => {
  console.log('new variants', variants);
};

// Card event handlers
const setVariants = (variants) => {
  console.log(variants);
};

let paramPanelRefs = {};

const toEntryObjects = (inputObj) => {
  return _toPairs(inputObj).map(([key, value]) => ({ key, value }));
};

const toggle = (event, id) => {
  paramPanelRefs[id].value.toggle(event);
};

const assessments = ref([[], []]);
const assessment = ref({
  id: '07e91CO5Nn9WHNsUz4qK',
  variant: {
    name: 'Same Different Selection',
    params: { fromDashboard: true, taskName: 'same-different-selection' },
    lastUpdated: '2024-01-31T00:48:08.810Z',
    id: '07e91CO5Nn9WHNsUz4qK',
    parentDoc: 'core-tasks',
  },
  task: {
    id: 'core-tasks',
    image:
      'https://imgs.search.brave.com/SOh64AD8PjBSoFCQukI7vBloBK_tNX_45_mZ6e0sv4M/rs:fit:860:0:0/g:ce/aHR0cHM6Ly9pbWcu/ZnJlZXBpay5jb20v/ZnJlZS12ZWN0b3Iv/d2hpdGUtaXNvbGF0/ZWQtZmVhdGhlci1j/YXJ0b29uXzEzMDgt/MTM4MDg2LmpwZz9z/aXplPTYyNiZleHQ9/anBn',
    name: 'LEVANTE core tasks',
    registered: true,
    description: 'Test for LEVANTE core tasks',
    lastUpdated: '2024-02-09T00:33:45.740Z',
  },
});

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

.divider {
  min-height: 100%;
  max-width: 0;
  border-left: 1px solid var(--surface-d);
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
