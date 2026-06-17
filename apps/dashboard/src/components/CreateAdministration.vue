<template>
  <main class="container main">
    <section class="main-body">
      <div class="flex flex-column mb-5">
        <div class="flex justify-content-between mb-2">
          <div class="flex align-items-center gap-3">
            <i class="pi pi-sliders-h text-gray-400 rounded" style="font-size: 1.6rem" />
            <div class="admin-page-header">{{ header }}</div>
          </div>
        </div>
        <div class="text-md text-gray-500 ml-6">{{ description }}</div>
      </div>

      <PvDivider />
      <div v-if="formType !== 'create' && !statePopulated" class="loading-container">
        <AppSpinner class="mb-4" />
        <span class="uppercase font-light text-sm text-gray-600"> Fetching Administration Data </span>
      </div>
      <div v-else class="bg-gray-100 rounded p-5">
        <div class="formgrid grid mt-5">
          <div class="field col-12 xl:col-6">
            <PvFloatLabel>
              <PvInputText
                id="administration-name"
                v-model="state.administrationName"
                class="w-full"
                data-cy="input-administration-name"
              />
              <label for="administration-name" class="w-full">Administration Name</label>
              <small
                v-if="v$.administrationName.$invalid && submitted"
                class="p-error white-space-nowrap overflow-hidden text-overflow-ellipsis"
                >Please name your administration</small
              >
            </PvFloatLabel>
          </div>

          <div class="field col-12 xl:col-6">
            <PvFloatLabel>
              <PvInputText
                id="administration-public-name"
                v-model="state.administrationPublicName"
                class="w-full"
                data-cy="input-administration-name-public"
              />
              <label for="administration-public-name" class="w-full">Public Administration Name</label>
              <small
                v-if="v$.administrationPublicName.$invalid && submitted"
                class="p-error white-space-nowrap overflow-hidden text-overflow-ellipsis"
                >Please provide a public-facing name for this administration</small
              >
            </PvFloatLabel>
          </div>
        </div>

        <AdministrationDatePicker
          v-model:start-date="state.dateStarted"
          v-model:end-date="state.dateClosed"
          :min-start-date="minStartDate"
          :min-end-date="minEndDate"
        />

        <PvConfirmDialog
          group="org-errors"
          class="confirm"
          :draggable="false"
          :pt="{ pcRejectButton: { root: { class: 'hidden' } } }"
        >
          <template #message>
            <span>Organization selections are not valid. Please select at least one district, school, or group.</span>
          </template>
        </PvConfirmDialog>

        <OrgPicker :orgs="orgsList" @selection="selection($event)" />

        <PvConfirmDialog
          group="task-errors"
          class="confirm"
          :draggable="false"
          :pt="{ pcRejectButton: { root: { class: 'hidden' } } }"
        >
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
          :all-task-bundles="allTaskBundles"
          :input-variants="preSelectedVariants"
          :pre-existing-assessment-info="existingAssessments"
          @variants-changed="handleVariantsChanged"
        />

        <div class="mt-2 flex w-full">
          <ConsentPicker
            :consent-id="existingConsentId"
            :assent-id="existingAssentId"
            :no-consent="existingNoConsent"
            @consent-selected="handleConsentSelected"
          />
          <small v-if="submitted && v$.consent.$invalid && v$.consent.$invalid" class="p-error mt-2"
            >Please select a consent/assent form.</small
          >
        </div>
        <div class="flex flex-column justify-content-center mt-5">
          <div class="flex flex-column mt-2 align-items-center justify-content-center">
            <div class="flex">
              <label style="font-weight: bold" class="mb-2 mx-2">Sequential?</label>
              <span class="flex gap-2">
                <PvRadioButton v-model="state.sequential" input-id="Yes" :value="true" />
                <label for="Yes">Yes</label>
                <PvRadioButton
                  v-model="state.sequential"
                  data-cy="radio-button-not-sequential"
                  input-id="No"
                  :value="false"
                />
                <label for="No">No</label>
              </span>
              <small v-if="v$.sequential.$invalid && submitted" class="p-error mt-2"
                >Please specify sequential behavior.</small
              >
            </div>
          </div>
          <div class="divider mx-2 my-3" />
          <div class="mb-2 w-full flex justify-content-center">
            <PvButton
              :label="submitLabel"
              class="text-white bg-primary border-none border-round h-3rem p-3 hover:bg-red-900"
              data-cy="button-create-administration"
              style="margin: 0"
              :disabled="isSubmitting || !userCan(submitPermission)"
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
import _union from 'lodash/union';
import _groupBy from 'lodash/groupBy';
import _values from 'lodash/values';
import _cloneDeep from 'lodash/cloneDeep';
import { useVuelidate } from '@vuelidate/core';
import { required, requiredIf } from '@vuelidate/validators';
import { useAuthStore } from '@/store/auth';
import useAdministrationQuery from '@/composables/queries/useAdministrationQuery';
import useAdministrationAssigneesQuery from '@/composables/queries/useAdministrationAssigneesQuery';
import useAdministrationTaskVariantsQuery from '@/composables/queries/useAdministrationTaskVariantsQuery';
import useAdministrationAgreementsQuery from '@/composables/queries/useAdministrationAgreementsQuery';
import useTaskVariantsListQuery from '@/composables/queries/useTaskVariantsListQuery';
import { adaptVariantsForPicker } from '@/helpers/adaptVariantsForPicker';
import useTaskBundlesQuery from '@/composables/queries/useTaskBundlesQuery';
import useUpsertAdministrationMutation from '@/composables/mutations/useUpsertAdministrationMutation';
import TaskPicker from './TaskPicker';
import ConsentPicker from './ConsentPicker.vue';
import OrgPicker from '@/components/OrgPicker.vue';
import { APP_ROUTES, ADMINISTRATION_FORM_TYPES } from '@/constants/routes';
import { TOAST_SEVERITIES, TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';
import { AGREEMENT_TYPES } from '@/constants/agreements';
import { usePermissions } from '@/composables/usePermissions';
import AdministrationDatePicker from '@/components/AdministrationDatePicker';
const { userCan, Permissions } = usePermissions();

const initialized = ref(false);
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();

const { mutate: upsertAdministration, isPending: isSubmitting } = useUpsertAdministrationMutation();

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const props = defineProps({
  adminId: { type: String, required: false, default: null },
  formType: { type: String, required: false, default: ADMINISTRATION_FORM_TYPES.CREATE },
});

const header = computed(() => {
  if (props.formType === ADMINISTRATION_FORM_TYPES.EDIT) {
    return 'Edit an administration';
  } else if (props.formType === ADMINISTRATION_FORM_TYPES.DUPLICATE) {
    return 'Duplicate an administration';
  }

  return 'Create a new administration';
});

const description = computed(() => {
  if (props.formType === ADMINISTRATION_FORM_TYPES.EDIT) {
    return 'Use this form to edit an existing administration.';
  } else if (props.formType === ADMINISTRATION_FORM_TYPES.DUPLICATE) {
    return 'Use this form to duplicate an existing administration.';
  }

  return 'Use this form to create a new administration and assign it to organizations.';
});

const submitLabel = computed(() => {
  if (props.formType === ADMINISTRATION_FORM_TYPES.EDIT) {
    return 'Update Administration';
  }

  return 'Create Administration';
});

const submitPermission = computed(() => {
  if (props.formType === ADMINISTRATION_FORM_TYPES.EDIT) {
    return Permissions.Administrations.UPDATE;
  }

  return Permissions.Administrations.CREATE;
});

// +------------------------------------------------------------------------------------------------------------------+
// | Variant catalog (picker source) and task bundles
// +------------------------------------------------------------------------------------------------------------------+
// `useTaskVariantsListQuery` returns the flat backend shape; adapt it to the
// nested shape the TaskPicker/VariantCard components consume.
const { data: flatVariants } = useTaskVariantsListQuery({ enabled: initialized });
const allVariants = computed(() => adaptVariantsForPicker(flatVariants.value ?? []));

const { data: allTaskBundles } = useTaskBundlesQuery({
  enabled: initialized,
});

// +------------------------------------------------------------------------------------------------------------------+
// | Pre-existing administration data when editing or duplicating
// +------------------------------------------------------------------------------------------------------------------+
const fetchAdminitrations = computed(() => initialized.value && !!props.adminId);

const { data: existingAdministration } = useAdministrationQuery(() => props.adminId, {
  enabled: fetchAdminitrations,
});

const { data: existingAssignees } = useAdministrationAssigneesQuery(() => props.adminId, {
  enabled: fetchAdminitrations,
});

const { data: existingTaskVariants } = useAdministrationTaskVariantsQuery(() => props.adminId, {
  enabled: fetchAdminitrations,
});

const { data: existingAgreements } = useAdministrationAgreementsQuery(() => props.adminId, {
  enabled: fetchAdminitrations,
});

// Resolve the assigned consent/assent agreements (by type) to pre-fill the picker
// on edit/duplicate. An administration with no assigned agreements means no
// consent/assent is required.
const existingConsentId = computed(
  () =>
    (existingAgreements.value ?? []).find((agreement) => agreement.agreementType === AGREEMENT_TYPES.CONSENT)?.id ??
    null,
);
const existingAssentId = computed(
  () =>
    (existingAgreements.value ?? []).find((agreement) => agreement.agreementType === AGREEMENT_TYPES.ASSENT)?.id ??
    null,
);
const existingNoConsent = computed(
  () => Boolean(props.adminId) && Array.isArray(existingAgreements.value) && existingAgreements.value.length === 0,
);

// Conditions adapters: the read shape (`assigned_if`/`optional_if`) maps to the
// picker's `assigned`/`optional`, and back out to the write shape
// (`conditionsEligibility`/`conditionsRequirement`).
const adaptConditionsRead = (conditions) => ({
  assigned: conditions?.assigned_if ?? undefined,
  optional: conditions?.optional_if ?? undefined,
});

const adaptConditionsWrite = (condition) => (condition === undefined || condition === null ? undefined : condition);

// Pre-existing assessment info supplied to the TaskPicker for conditions display.
const existingAssessments = computed(() =>
  (existingTaskVariants.value ?? []).map((tv) => ({
    variantId: tv.id,
    taskId: tv.task.id,
    conditions: adaptConditionsRead(tv.conditions),
  })),
);

// +------------------------------------------------------------------------------------------------------------------+
// | Form state and validation rules
// +------------------------------------------------------------------------------------------------------------------+
let noConsent = ref('');

const submitted = ref(false);
const statePopulated = ref(false);

const state = reactive({
  administrationName: '',
  administrationPublicName: '',
  dateStarted: null,
  dateClosed: null,
  sequential: null,
  consent: null,
  assent: null,
  districts: [],
  schools: [],
  classes: [],
  groups: [],
});

const rules = {
  administrationName: { required },
  administrationPublicName: { required },
  dateStarted: { required },
  dateClosed: { required },
  sequential: { required },
  consent: { requiredIf: requiredIf(noConsent.value === '') },
  assent: { requiredIf: requiredIf(noConsent.value === '') },
};

const v$ = useVuelidate(rules, state);

const minStartDate = computed(() => {
  // When editing, allow selecting any date (no minimum restriction)
  // When creating new, use today as minimum
  if (props.adminId) {
    return null;
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
const orgsList = computed(() => ({
  districts: existingAssignees.value?.districts ?? [],
  schools: existingAssignees.value?.schools ?? [],
  classes: existingAssignees.value?.classes ?? [],
  groups: existingAssignees.value?.groups ?? [],
}));

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

const handleFoundVariant = (assessment, allVariantInfo) => {
  const found = _find(allVariantInfo, (variant) => variant.id === assessment.variantId);
  if (found) {
    const clonedFound = _cloneDeep(found);
    // Attach the assignment conditions for this administration, if any.
    clonedFound.variant.conditions = !_isEmpty(assessment.conditions) ? assessment.conditions : undefined;
    preSelectedVariants.value = _union(preSelectedVariants.value, [clonedFound]);
    variants.value = _union(variants.value, [clonedFound]);
  }
};

const handleVariantsChanged = (newVariants) => {
  variants.value = newVariants;
};

const handleConsentSelected = (selectionResult) => {
  if (selectionResult === 'No Consent') {
    noConsent.value = 'No Consent';
    state.consent = 'No Consent';
    state.assent = 'No Consent';
  } else if (selectionResult === '') {
    noConsent.value = '';
    state.consent = null;
    state.assent = null;
  } else {
    noConsent.value = '';
    state.consent = selectionResult.consent;
    state.assent = selectionResult.assent;
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
const removeUndefined = (obj) => {
  // eslint-disable-next-line no-unused-vars
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
};

const submit = async () => {
  submitted.value = true;
  const isFormValid = await v$.value.$validate();
  if (!isFormValid) {
    return;
  }

  // One variant per task — check uniqueness on the selected variants' tasks.
  const selectedTasks = variants.value.map((assessment) => ({ taskId: assessment.task.id }));
  const tasksUnique = checkForUniqueTasks(selectedTasks);

  if (!tasksUnique || _isEmpty(variants.value)) {
    getNonUniqueTasks(selectedTasks);
    confirm.require({
      group: 'task-errors',
      header: 'Task Selections',
      icon: 'pi pi-question-circle',
      acceptLabel: 'Close',
      acceptIcon: 'pi pi-times',
    });
    return;
  }

  const taskVariants = variants.value.map((assessment, index) =>
    removeUndefined({
      taskVariantId: assessment.variant.id,
      orderIndex: index,
      conditionsEligibility: adaptConditionsWrite(assessment.variant.conditions?.assigned),
      conditionsRequirement: adaptConditionsWrite(assessment.variant.conditions?.optional),
    }),
  );

  // The write contract merges districts + schools into `orgs`; classes and groups are separate.
  const orgs = [...toRaw(state.districts).map((org) => org.id), ...toRaw(state.schools).map((org) => org.id)];
  const classes = toRaw(state.classes).map((org) => org.id);
  const groups = toRaw(state.groups).map((org) => org.id);

  const orgsValid = checkForRequiredOrgs([orgs, classes, groups]);
  if (!orgsValid) {
    confirm.require({
      group: 'org-errors',
      header: 'Organization Selections',
      icon: 'pi pi-question-circle',
      acceptLabel: 'Close',
      acceptIcon: 'pi pi-times',
    });
    return;
  }

  const dateEnd = new Date(state.dateClosed);
  dateEnd.setHours(23, 59, 59, 999);

  const agreements =
    noConsent.value === 'No Consent' ? [] : [state.consent, state.assent].filter((id) => id && id !== 'No Consent');

  const body = {
    name: toRaw(state).administrationName,
    namePublic: toRaw(state).administrationPublicName,
    dateStart: new Date(state.dateStarted).toISOString(),
    dateEnd: dateEnd.toISOString(),
    isOrdered: toRaw(state).sequential,
    orgs,
    classes,
    groups,
    taskVariants,
    agreements,
  };

  // Duplicate mode creates a new administration (POST); only edit targets an existing id (PATCH).
  const administrationId = props.formType === ADMINISTRATION_FORM_TYPES.EDIT ? props.adminId : undefined;

  await upsertAdministration(
    { administrationId, body },
    {
      onSuccess: () => {
        toast.add({
          severity: TOAST_SEVERITIES.SUCCESS,
          summary: 'Success',
          detail: administrationId ? 'Administration updated' : 'Administration created',
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

        console.error('Error saving administration:', error.message);
      },
    },
  );
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
  if (state.roarfirekit.restConfig?.()) init();
});

onMounted(async () => {
  if (roarfirekit.value.restConfig?.()) init();
});

watch(
  [existingAdministration, existingAssignees, existingTaskVariants, existingAgreements, allVariants],
  ([adminInfo, assignees, taskVariants, agreements, allVariantInfo]) => {
    if (!adminInfo || _isEmpty(allVariantInfo)) return;

    // Exclude name and publicName from duplicate formType
    if (props.formType === ADMINISTRATION_FORM_TYPES.DUPLICATE) {
      state.administrationName = `${adminInfo.name} - Copy`;
      state.administrationPublicName = `${adminInfo.publicName} - Copy`;
    } else {
      state.administrationName = adminInfo.name;
      state.administrationPublicName = adminInfo.publicName;
    }

    // The assignees endpoint returns full `{ id, name, ... }` objects per bucket.
    state.districts = assignees?.districts ?? [];
    state.schools = assignees?.schools ?? [];
    state.classes = assignees?.classes ?? [];
    state.groups = assignees?.groups ?? [];

    state.dateStarted = new Date(adminInfo.dates.start);
    state.dateClosed = new Date(adminInfo.dates.end);

    _forEach(taskVariants ?? [], (tv) => {
      handleFoundVariant({ variantId: tv.id, conditions: adaptConditionsRead(tv.conditions) }, allVariantInfo);
    });

    state.sequential = adminInfo.isOrdered;

    // Pre-fill consent/assent from the administration's assigned agreements.
    // No assigned agreements means the administration requires no consent/assent.
    if (Array.isArray(agreements)) {
      if (agreements.length === 0) {
        noConsent.value = 'No Consent';
        state.consent = 'No Consent';
        state.assent = 'No Consent';
      } else {
        noConsent.value = '';
        state.consent = agreements.find((agreement) => agreement.agreementType === AGREEMENT_TYPES.CONSENT)?.id ?? null;
        state.assent = agreements.find((agreement) => agreement.agreementType === AGREEMENT_TYPES.ASSENT)?.id ?? null;
      }
    }
  },
  { immediate: true },
);

watch(
  state,
  (newState) => {
    if (
      newState?.administrationName &&
      newState?.administrationPublicName &&
      newState?.dateStarted &&
      newState?.dateClosed
    ) {
      statePopulated.value = true;
    }
  },
  { immediate: true },
);
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
.p-radiobutton.p-component.p-radiobutton-checked {
  position: relative;
  width: 20px;
  height: 20px;
  background-color: var(--primary-color);
  border-color: var(--primary-color) !important;
  border-radius: 50%;
}

.p-radiobutton.p-component.p-radiobutton-checked::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 5px;
  height: 5px;
  background-color: white;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
</style>
