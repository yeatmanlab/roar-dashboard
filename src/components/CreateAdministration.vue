<template>
  <main class="container main">
    <section class="main-body">
      <div class="flex flex-column mb-5">
        <div class="flex justify-content-between mb-2">
          <div class="flex align-items-center gap-3">
            <div class="admin-page-header">{{ header }}</div>
          </div>
        </div>
        <div class="text-md text-gray-500">{{ description }}</div>
      </div>

      <PvDivider />
      <div class="bg-gray-100 rounded p-5">
        <div class="formgrid grid mt-5">
        <div class="field col-12 xl:col-6 mb-5">
          <PvFloatLabel>
            <PvInputText
                id="administration-name"
                v-model="state.administrationName"
                class="w-full"
                data-cy="input-administration-name"
            />
            <label for="administration-name" class="w-full">Assignment Name</label>
            <small
              v-if="v$.administrationName.$invalid && submitted"
              class="p-error white-space-nowrap overflow-hidden text-overflow-ellipsis"
            >
              Please name your administration
            </small>
            </PvFloatLabel>
            <p class="mt-1 ml-1 text-sm text-gray-500">This name is visible to participants</p>
          </div>
        </div>
        <div class="formgrid grid">
          <div class="field col-12 md:col-6 mb-5">
            <PvFloatLabel>
              <PvDatePicker
                v-model="state.dateStarted"
                class="w-full"
                :min-date="minStartDate"
                :number-of-months="1"
                :manual-input="false"
                icon="pi pi-calendar text-white p-1"
                input-id="start-date"
                show-button-bar
                data-cy="input-start-date"
              />
              <label for="start-date">Start Date</label>
              <small v-if="v$.dateStarted.required.$invalid && submitted" class="p-error"
                >Please select a start date.</small
              >
            </PvFloatLabel>
          </div>
          <div class="field col-12 md:col-6">
            <PvFloatLabel>
              <PvDatePicker
                v-model="state.dateClosed"
                class="w-full"
                :min-date="minEndDate"
                input-id="end-date"
                :number-of-months="1"
                :manual-input="false"
                icon="pi pi-calendar text-white p-1"
                show-button-bar
                data-cy="input-end-date"
              />
              <label for="end-date">End Date</label>
              <small v-if="v$.dateClosed.required.$invalid && submitted" class="p-error"
                >Please select an end date.</small
              >
            </PvFloatLabel>
          </div>
        </div>

        <OrgPicker :orgs="orgsList" @selection="selection($event)" />

        <PvConfirmDialog group="errors" class="confirm" :draggable="false">
          <template #message>
            <span class="flex flex-column">
              <span v-if="nonUniqueTasks.length > 0" class="flex flex-column">
                <span>Task selections must be unique.</span>
                <span class="mt-2">The following tasks are not unique:</span>
                <span class="mt-2 font-bold">{{ nonUniqueTasks.join(', ') }}</span>
              </span>
              <span v-else>
                <span>No variants selected. You must select at least one variant to be assigned.</span>
              </span>
            </span>
          </template>
        </PvConfirmDialog>

        <TaskPicker
          :all-variants="variantsByTaskId"
          :input-variants="preSelectedVariants"
          :pre-existing-assessment-info="existingAssessments"
          @variants-changed="handleVariantsChanged"
        />

        <div v-if="!isLevante" class="mt-2 flex w-full">
          <ConsentPicker :legal="state.legal" @consent-selected="handleConsentSelected" />
          <small v-if="submitted && v$.consent.$invalid && v$.consent.$invalid" class="p-error mt-2"
            >Please select a consent/assent form.</small
          >
        </div>
        <div class="flex flex-column justify-content-center mt-5">
          <div class="flex flex-column mt-2 align-items-center justify-content-center">
            <div class="flex">
              <label style="font-weight: bold" class="mb-2 mx-2">Sequential?</label>
              <span class="flex gap-2">
                <PvRadioButton
                  v-model="state.sequential"
                  input-id="Yes"
                  :value="true"
                />
                <label for="Yes">Yes</label>
                <PvRadioButton
                  v-model="state.sequential"
                  data-cy="radio-button-not-sequential"
                  input-id="No"
                  :value="false"
                />
                <label for="No">No</label>
              </span>
            </div>
            <small v-if="v$.sequential.$invalid && submitted" class="p-error mt-2"
                >Please specify sequential behavior.</small
              >
            <div v-if="!isLevante" class="mt-2 mb-2">
              <PvCheckbox v-model="isTestData" :binary="true" data-cy="checkbutton-test-data" input-id="isTestData" />
              <label for="isTestData" class="ml-2">Mark As <b>Test Administration</b></label>
            </div>
          </div>
          <div class="divider mx-2 my-3" />
          <div class="mb-2 w-full flex justify-content-center">
            <PvButton
              :label="submitLabel"
              class="text-white bg-primary border-none border-round h-3rem p-3 hover:bg-red-900"
              data-cy="button-create-administration"
              style="margin: 0"
              :disabled="isSubmitting"
              @click="submit"
            >
              <i v-if="isSubmitting" class="pi pi-spinner pi-spin mr-2"></i> {{ submitLabel }}
            </PvButton>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref, toRaw, watch } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import PvFloatLabel from 'primevue/floatlabel';
import PvButton from 'primevue/button';
import PvDatePicker from 'primevue/datepicker';
import PvCheckbox from 'primevue/checkbox';
import PvConfirmDialog from 'primevue/confirmdialog';
import PvDivider from 'primevue/divider';
import PvInputText from 'primevue/inputtext';
import PvRadioButton from 'primevue/radiobutton';
import _filter from 'lodash/filter';
import _isEmpty from 'lodash/isEmpty';
import _toPairs from 'lodash/toPairs';
import _uniqBy from 'lodash/uniqBy';
import _forEach from 'lodash/forEach';
import _find from 'lodash/find';
import _isEqual from 'lodash/isEqual';
import _union from 'lodash/union';
import _groupBy from 'lodash/groupBy';
import _values from 'lodash/values';
import { useVuelidate } from '@vuelidate/core';
import { required, requiredIf } from '@vuelidate/validators';
import { useAuthStore } from '@/store/auth';
import useAdministrationsQuery from '@/composables/queries/useAdministrationsQuery';
import useDistrictsQuery from '@/composables/queries/useDistrictsQuery';
import useSchoolsQuery from '@/composables/queries/useSchoolsQuery';
import useClassesQuery from '@/composables/queries/useClassesQuery';
import useGroupsQuery from '@/composables/queries/useGroupsQuery';
import useFamiliesQuery from '@/composables/queries/useFamiliesQuery';
import useTaskVariantsQuery from '@/composables/queries/useTaskVariantsQuery';
import useUpsertAdministrationMutation from '@/composables/mutations/useUpsertAdministrationMutation';
import TaskPicker from './TaskPicker.vue';
import ConsentPicker from './ConsentPicker.vue';
import OrgPicker from '@/components/OrgPicker.vue';
import { APP_ROUTES } from '@/constants/routes';
import { TOAST_SEVERITIES, TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';
import { isLevante } from '@/helpers';

const initialized = ref(false);
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();

const { mutate: upsertAdministration, isPending: isSubmitting } = useUpsertAdministrationMutation();

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const props = defineProps({
  adminId: { type: String, required: false, default: null },
});

const header = computed(() => {
  if (props.adminId) {
    return 'Edit an assignment';
  }

  return 'Create New Assignment';
});

const description = computed(() => {
  return 'Assignments are bundles of tasks, surveys, and questionnaires that are sent to your users';
});

const submitLabel = computed(() => {
  if (props.adminId) {
    return 'Update Assignment';
  }

  return 'Create Assignment';
});

// +------------------------------------------------------------------------------------------------------------------+
// | Fetch Variants with Params
// +------------------------------------------------------------------------------------------------------------------+
const findVariantWithParams = (variants, params) => {
  // TODO: implement tie breakers if found.length > 1
  return _find(variants, (variant) => {
    const cleanVariantParams = removeNull(variant.variant.params);
    const cleanInputParams = removeNull(params);
    return _isEqual(cleanInputParams, cleanVariantParams);
  });
};

const { data: allVariants } = useTaskVariantsQuery(true, {
  enabled: initialized,
});

// +------------------------------------------------------------------------------------------------------------------+
// | Fetch pre-existing administration data when editing an administration
// +------------------------------------------------------------------------------------------------------------------+
// Fetch the data of the currently being edited administration, incl. its assigned assessments.
const fetchAdminitrations = computed(() => initialized.value && !!props.adminId);
const { data: existingAdministrationData } = useAdministrationsQuery([props.adminId], {
  enabled: fetchAdminitrations,
  select: (data) => data[0],
});

const existingAssessments = computed(() => {
  return existingAdministrationData?.value?.assessments ?? [];
});

// Fetch the districts assigned to the administration.
const districtIds = computed(() => existingAdministrationData?.value?.minimalOrgs?.districts ?? []);

const { data: existingDistrictsData } = useDistrictsQuery(districtIds, {
  enabled: initialized,
});

// Fetch the schools assigned to the administration.
const schoolIds = computed(() => existingAdministrationData.value?.minimalOrgs?.schools ?? []);

const { data: existingSchoolsData } = useSchoolsQuery(schoolIds, {
  enabled: initialized,
});

// Fetch the classes assigned to the administration.
const classIds = computed(() => existingAdministrationData.value?.minimalOrgs?.classes ?? []);

const { data: existingClassesData } = useClassesQuery(classIds, {
  enabled: initialized,
});

// Fetch the groups assigned to the administration.
const groupIds = computed(() => existingAdministrationData.value?.minimalOrgs?.groups ?? []);

const { data: existingGroupData } = useGroupsQuery(groupIds, {
  enabled: initialized,
});

// Fetch the families assigned to the administration.
const familyIds = computed(() => existingAdministrationData.value?.minimalOrgs?.families ?? []);

const { data: existingFamiliesData } = useFamiliesQuery(familyIds, {
  enabled: initialized,
});

// +------------------------------------------------------------------------------------------------------------------+
// | Form state and validation rules
// +------------------------------------------------------------------------------------------------------------------+
let noConsent = ref('');

const submitted = ref(false);
const isTestData = ref(false);

const state = reactive({
  administrationName: '',
  administrationPublicName: '',
  dateStarted: null,
  dateClosed: null,
  sequential: null,
  legal: null,
  consent: null,
  assent: null,
  districts: [],
  schools: [],
  classes: [],
  groups: [],
  families: [],
  amount: '',
  expectedTime: '',
});

const rules = {
  administrationName: { required },
  administrationPublicName: { required },
  dateStarted: { required },
  dateClosed: { required },
  sequential: { required },
  consent: { requiredIf: requiredIf(!isLevante && noConsent.value === '') },
  assent: { requiredIf: requiredIf(!isLevante && noConsent.value === '') },
};

const v$ = useVuelidate(rules, state);

const minStartDate = computed(() => {
  if (props.adminId && existingAdministrationData.value?.dateOpened) {
    return new Date(existingAdministrationData.value.dateOpened);
  }
  return new Date();
});

const minEndDate = computed(() => {
  if (state.dateStarted) {
    return new Date(state.dateStarted);
  }
  return new Date();
});

// +------------------------------------------------------------------------------------------------------------------+
// | Org Selection
// +------------------------------------------------------------------------------------------------------------------+
const orgsList = computed(() => {
  return {
    districts: existingDistrictsData.value,
    schools: existingSchoolsData.value,
    classes: existingClassesData.value,
    groups: existingGroupData.value,
    families: existingFamiliesData.value,
  };
});

const selection = (selected) => {
  for (const [key, value] of _toPairs(selected)) {
    state[key] = value;
  }
};

// +------------------------------------------------------------------------------------------------------------------+
// | Assessment Selection
// +------------------------------------------------------------------------------------------------------------------+
const variants = ref([]);
const preSelectedVariants = ref([]);
const nonUniqueTasks = ref('');

const variantsByTaskId = computed(() => {
  return _groupBy(allVariants.value, 'task.id');
});

const handleVariantsChanged = (newVariants) => {
  variants.value = newVariants;
};

const handleConsentSelected = (newConsentAssent) => {
  if (newConsentAssent !== 'No Consent') {
    noConsent.value = '';
    state.consent = newConsentAssent.consent;
    state.assent = newConsentAssent.assent;
    state.amount = newConsentAssent.amount;
    state.expectedTime = newConsentAssent.expectedTime;
  } else {
    // Set to "No Consent"
    noConsent.value = newConsentAssent;
    state.consent = newConsentAssent;
    state.assent = newConsentAssent;
  }
};

const checkForUniqueTasks = (assignments) => {
  if (_isEmpty(assignments)) return false;
  const uniqueTasks = _uniqBy(assignments, (assignment) => assignment.taskId);
  return uniqueTasks.length === assignments.length;
};

const getNonUniqueTasks = (assignments) => {
  const grouped = _groupBy(assignments, (assignment) => assignment.taskId);
  const taskIds = _values(grouped);
  const filtered = _filter(taskIds, (taskIdArray) => taskIdArray.length > 1);
  nonUniqueTasks.value = filtered.map((taskIdArray) => taskIdArray[0].taskId);
};

const checkForRequiredOrgs = (orgs) => {
  const filtered = _filter(orgs, (org) => !_isEmpty(org));
  return Boolean(filtered.length);
};

// +------------------------------------------------------------------------------------------------------------------+
// | Form submission
// +------------------------------------------------------------------------------------------------------------------+
const removeNull = (obj) => {
  // eslint-disable-next-line no-unused-vars
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== null));
};

const removeUndefined = (obj) => {
  // eslint-disable-next-line no-unused-vars
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
};

const submit = async () => {
  const isFormValid = await v$.value.$validate();
  if (!isFormValid) {
    return;
  }

  const submittedAssessments = variants.value.map((assessment) =>
    removeUndefined({
      variantId: assessment.variant.id,
      variantName: assessment.variant.name,
      taskId: assessment.task.id,
      params: toRaw(assessment.variant.params),
      // Exclude conditions key if there are no conditions to be set.
      ...(toRaw(assessment.variant.conditions || undefined) && { conditions: toRaw(assessment.variant.conditions) }),
    }),
  );

  const tasksUnique = checkForUniqueTasks(submittedAssessments);

  if (!tasksUnique || _isEmpty(submittedAssessments)) {
    getNonUniqueTasks(submittedAssessments);
    confirm.require({
      group: 'errors',
      header: 'Task Selections',
      icon: 'pi pi-question-circle',
      acceptLabel: 'Close',
      acceptIcon: 'pi pi-times',
    });
    return;
  }

  const orgs = {
    districts: toRaw(state.districts).map((org) => org.id),
    schools: toRaw(state.schools).map((org) => org.id),
    classes: toRaw(state.classes).map((org) => org.id),
    groups: toRaw(state.groups).map((org) => org.id),
    families: toRaw(state.families).map((org) => org.id),
  };

  const orgsValid = checkForRequiredOrgs(orgs);
  if (!orgsValid) {
    // @TODO: Add error handling, i.e. confirmation dialog like the one for non-unique tasks?
    return;
  }

  const dateClose = new Date(state.dateClosed);
  dateClose.setHours(23, 59, 59, 999);

  const args = {
    name: toRaw(state).administrationName,
    publicName: toRaw(state).administrationPublicName,
    assessments: submittedAssessments,
    dateOpen: toRaw(state).dateStarted,
    dateClose,
    sequential: toRaw(state).sequential,
    orgs: orgs,
    isTestData: isTestData.value,
    legal: {
      consent: toRaw(state).consent ?? null,
      assent: toRaw(state).assent ?? null,
      amount: toRaw(state).amount ?? '',
      expectedTime: toRaw(state).expectedTime ?? '',
    },
  };

  if (props.adminId) args.administrationId = props.adminId;

  await upsertAdministration(args, {
    onSuccess: () => {
      toast.add({
        severity: TOAST_SEVERITIES.SUCCESS,
        summary: 'Success',
        detail: props.adminId ? 'Administration updated' : 'Administration created',
        life: TOAST_DEFAULT_LIFE_DURATION,
      });

      router.push({ path: APP_ROUTES.HOME });
    },
    onError: (error) => {
      toast.add({
        severity: TOAST_SEVERITIES.ERROR,
        summary: 'Error',
        detail: error.message,
        life: TOAST_DEFAULT_LIFE_DURATION,
      });

      console.error('Error creating administration:', error.message);
    },
  });
};

// +------------------------------------------------------------------------------------------------------------------+
// | Lifecycle hooks and subscriptions
// +------------------------------------------------------------------------------------------------------------------+
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

watch([existingAdministrationData, allVariants], ([adminInfo, allVariantInfo]) => {
  if (adminInfo && !_isEmpty(allVariantInfo)) {
    state.administrationName = adminInfo.name;
    state.administrationPublicName = adminInfo.publicName;
    state.dateStarted = new Date(adminInfo.dateOpened);
    state.dateClosed = new Date(adminInfo.dateClosed);
    state.sequential = adminInfo.sequential;
    _forEach(adminInfo.assessments, (assessment) => {
      const assessmentParams = assessment.params;
      const taskId = assessment.taskId;
      const allVariantsForThisTask = _filter(allVariantInfo, (variant) => variant.task.id === taskId);
      const found = findVariantWithParams(allVariantsForThisTask, assessmentParams);
      if (found) {
        preSelectedVariants.value = _union(preSelectedVariants.value, [found]);
      }
    });
    state.legal = adminInfo.legal;
    state.consent = adminInfo?.legal?.consent ?? null;
    state.assent = adminInfo?.legal?.assent ?? null;
    isTestData.value = adminInfo.testData;

    if (state.consent === 'No Consent') {
      noConsent.value = state.consent;
    }
  }
});
</script>

<style lang="scss">
.p-datepicker-today span {
  background-color: var(--blue-100) !important; /* Change to your desired color */
}

.p-datepicker-today .p-datepicker-day-selected,.p-datepicker-day-selected span {
  background-color: var(--primary-color) !important; /* Change to your selected date color */
}

.return-button {
  display: block;
  margin: 1rem 1.75rem;
}

.p-checkbox-box.p-highlight {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
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

.p-datepicker .p-datepicker-buttonbar .p-button {
  width: auto;
  background-color: white;
  border: none;
  border-radius: 0.375rem;
  color: var(--primary-color);
  padding: 0.5rem;
  margin: 0.5rem;
}
.p-datepicker .p-datepicker-buttonbar .p-button:hover {
  background-color: var(--surface-100);
}

.divider {
  min-height: 100%;
  max-width: 0;
  border-left: 1px solid var(--surface-d);
}

.confirm .p-confirm-dialog-reject {
  display: none !important;
}

.confirm .p-dialog-header-close {
  display: none !important;
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

  .hide {
    display: none;
  }
}

</style>
