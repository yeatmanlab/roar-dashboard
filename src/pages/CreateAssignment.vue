<template>
  <div v-if="editAssignmentBlockingLoader" class="levante-spinner-wrapper">
    <LevanteSpinner fullscreen />
  </div>

  <main v-else class="container main">
    <section class="main-body">
      <div class="flex flex-column mb-5">
        <div class="page-title-row flex align-items-center justify-content-start gap-2 mb-2">
          <div class="admin-page-header m-0">{{ header }}</div>
          <DocsButton
            href="https://researcher.levante-network.org/dashboard/create-an-assignment"
            label="Documentation"
          />
        </div>
        <div v-if="!adminId" class="how-to-section mb-4">
          <h3>How to create an assignment</h3>
          <div class="text-md text-gray-500 mb-1 line-height-3">
            An assignment is a collection of tasks. New assignments have a name and date range, are given to certain
            groups, and contain specified tasks. When an assignment is given to a group, all users within that group
            receive those tasks. Before getting started, please read the
            <a
              href="https://researcher.levante-network.org/dashboard/create-an-assignment"
              target="_blank"
              rel="noopener noreferrer"
              >documentation on creating assignments</a
            >.
          </div>
        </div>
      </div>

      <PvDivider />

      <div class="text-sm text-gray-500 mt-3 mr-3 required"><span class="required-asterisk">*</span> Required</div>
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
              <label for="administration-name" class="w-full"
                >Assignment Name <span class="required-asterisk">*</span></label
              >
            </PvFloatLabel>
            <small
              v-if="v$.administrationName.$invalid && submitted"
              class="p-error white-space-nowrap overflow-hidden text-overflow-ellipsis"
              >Please name your assignment</small
            >
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
              <label for="start-date">Start Date <span class="required-asterisk">*</span></label>
            </PvFloatLabel>
            <small v-if="v$.dateStarted.required.$invalid && submitted" class="p-error">
              Please select a start date.
            </small>
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
              <label for="end-date">End Date <span class="required-asterisk">*</span></label>
            </PvFloatLabel>
            <small v-if="v$.dateClosed.required.$invalid && submitted" class="p-error">
              Please select an end date.
            </small>
          </div>
        </div>

        <GroupPicker ref="groupPicker" class="group-picker-component" :orgs="orgsList" @selection="selection($event)" />
        <small
          v-if="
            submitted &&
            !checkForRequiredOrgs({
              districts: state.districts,
              schools: state.schools,
              classes: state.classes,
              groups: state.groups,
            })
          "
          class="p-error mb-8"
        >
          Please select at least one Group (Site, School, Class, or Cohort).
        </small>

        <TaskPicker
          ref="taskPicker"
          class="task-picker-component mt-3"
          :all-variants="variantsByTaskId"
          :input-variants="preSelectedVariants"
          :pre-existing-assessment-info="existingAssessments"
          @variants-changed="handleVariantsChanged"
        />
        <small v-if="submitted && _isEmpty(variants)" class="p-error mb-3">
          Please select at least one task variant.
        </small>

        <div v-if="!isLevante" class="mt-2 flex w-full">
          <ConsentPicker :legal="state.legal" @consent-selected="handleConsentSelected" />
          <small v-if="submitted && v$.consent.$invalid && v$.consent.$invalid" class="p-error mt-2"
            >Please select a consent/assent form.</small
          >
        </div>
        <div class="flex flex-column justify-content-center mt-5">
          <div class="flex flex-column mt-2 align-items-center justify-content-center">
            <div class="flex">
              <label class="mb-2 mx-2 font-semibold"
                >Sequential Task Order <span class="required-asterisk">*</span></label
              >
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
          <div class="mb-2 w-full flex justify-content-center gap-3">
            <PvButton v-if="adminId" severity="danger" variant="outlined" @click="onClickCancelBtn">Cancel</PvButton>

            <PvButton
              :label="submitLabel"
              class="text-white bg-primary border-none border-round h-3rem p-3 hover:bg-red-900"
              data-cy="button-create-administration"
              style="margin: 0"
              :disabled="!state.administrationName || isSubmitting"
              @click="submit"
            >
              <i v-if="isSubmitting" class="pi pi-spinner pi-spin mr-2"></i>
              {{ submitLabel }}
            </PvButton>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref, toRaw, toRef, toValue, watch } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';
import PvFloatLabel from 'primevue/floatlabel';
import PvButton from 'primevue/button';
import PvDatePicker from 'primevue/datepicker';
import PvCheckbox from 'primevue/checkbox';
import PvDivider from 'primevue/divider';
import PvInputText from 'primevue/inputtext';
import PvRadioButton from 'primevue/radiobutton';
import _filter from 'lodash/filter';
import _isEmpty from 'lodash/isEmpty';
import _toPairs from 'lodash/toPairs';
import _forEach from 'lodash/forEach';
import _find from 'lodash/find';
import _isEqual from 'lodash/isEqual';
import _union from 'lodash/union';
import _groupBy from 'lodash/groupBy';
import { useVuelidate } from '@vuelidate/core';
import { required, requiredIf } from '@vuelidate/validators';
import { useAuthStore } from '@/store/auth';
import useAdministrationsQuery from '@/composables/queries/useAdministrationsQuery';
import useDistrictsQuery from '@/composables/queries/useDistrictsQuery';
import useSchoolsQuery from '@/composables/queries/useSchoolsQuery';
import useClassesQuery from '@/composables/queries/useClassesQuery';
import useGroupsQuery from '@/composables/queries/useGroupsQuery';
import useTaskVariantsQuery from '@/composables/queries/useTaskVariantsQuery';
import useUpsertAdministrationMutation from '@/composables/mutations/useUpsertAdministrationMutation';
import TaskPicker from '@/components/TaskPicker.vue';
import ConsentPicker from '@/components/ConsentPicker.vue';
import DocsButton from '@/components/DocsButton.vue';
import GroupPicker from '@/components/GroupPicker.vue';
import { APP_ROUTES } from '@/constants/routes';
import { TOAST_SEVERITIES, TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';
import { isLevante, isPlainObject, normalizeToLowercase } from '@/helpers';
import { useQueryClient } from '@tanstack/vue-query';
import useAssignmentExistsQuery from '@/composables/queries/useAssignmentExistsQuery';
import { ADMINISTRATIONS_LIST_QUERY_KEY, ADMINISTRATIONS_QUERY_KEY, DSGF_ORGS_QUERY_KEY } from '@/constants/queryKeys';
import LevanteSpinner from '@/components/LevanteSpinner.vue';
import { useLevanteStore } from '@/store/levante';
import { logger } from '@/logger';

const initialized = ref(false);
const isFormPopulated = ref(false);
const editTasksHydrated = ref(false);
const router = useRouter();
const toast = useToast();
const queryClient = useQueryClient();

const { mutate: upsertAdministration, isPending: isSubmitting } = useUpsertAdministrationMutation();

const levanteStore = useLevanteStore();
const { hasUserConfirmed } = storeToRefs(levanteStore);
const { setHasUserConfirmed, setShouldUserConfirm } = levanteStore;
const authStore = useAuthStore();
const { roarfirekit, userData } = storeToRefs(authStore);

const props = defineProps({
  adminId: { type: String, required: false, default: null },
});

const header = computed(() => {
  if (!props.adminId) return 'Create Assignment';
  const name = state.administrationName?.trim();
  return name ? `Edit Assignment: ${name}` : 'Edit assignment';
});

const submitLabel = computed(() => (props.adminId ? 'Update Assignment' : 'Create Assignment'));

const creatorName = computed(() => {
  const firstName = userData.value?.name?.first || '';
  const middleName = userData.value?.name?.middle || '';
  const lastName = userData.value?.name?.last || '';

  return userData.value?.displayName || `${firstName} ${middleName} ${lastName}`;
});

const onClickCancelBtn = () => router.back();

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

function resolveVariantForAssessment(assessment, allVariantInfo) {
  const taskId = String(assessment?.taskId ?? '').toLowerCase();
  const forTask = _filter(allVariantInfo, (variant) => String(variant.task?.id ?? '').toLowerCase() === taskId);

  let found = findVariantWithParams(forTask, assessment.params ?? {});

  const variantId = assessment.variantId;
  if (!found && variantId) {
    found = _find(forTask, (v) => v.id === variantId) ?? _find(allVariantInfo, (v) => v.id === variantId);
  }

  return found;
}

const { data: allVariants, isFetched: isVariantsFetched } = useTaskVariantsQuery(true, {
  enabled: initialized,
});

// +------------------------------------------------------------------------------------------------------------------+
// | Fetch pre-existing administration data when editing an administration
// +------------------------------------------------------------------------------------------------------------------+
// Fetch the data of the currently being edited administration, incl. its assigned assessments.
const administrationIdsForEdit = computed(() => (props.adminId ? [props.adminId] : []));
const fetchAdminitrations = computed(() => initialized.value && !!props.adminId);
const {
  data: existingData,
  isLoading: isLoadingExistingData,
  error: errorExistingData,
  isFetched: isAdministrationFetched,
} = useAdministrationsQuery(administrationIdsForEdit, {
  enabled: fetchAdminitrations,
  select: (data) => data[0],
  staleTime: 0,
  gcTime: 0,
});

watch(
  [existingData, isLoadingExistingData, errorExistingData],
  ([newExistingData, newIsLoadingExistingData, newErrorExistingData]) => {
    if (!props.adminId) return;
    if (!newIsLoadingExistingData && !newExistingData) {
      logger.error('Failed to fetch administration by id', {
        assignmentId: props.adminId,
        error: newErrorExistingData,
      });

      toast.add({
        severity: TOAST_SEVERITIES.ERROR,
        summary: 'Failed to fetch assignment',
        detail: "We could not fetch this assignment's data. Please try again later",
        life: TOAST_DEFAULT_LIFE_DURATION,
      });

      router.go(-1);
    }
  },
);

const existingAssessments = computed(() => existingData?.value?.assessments ?? []);

const existingAdminMinimalOrgs = computed(() => minimalOrgsFromDoc(existingData?.value));

// Fetch the districts assigned to the administration.
const districtIds = computed(() => existingAdminMinimalOrgs.value?.districts ?? []);

const { data: existingDistrictsData, isFetched: isDistrictsFetched } = useDistrictsQuery(districtIds, {
  enabled: initialized,
});

// Fetch the schools assigned to the administration.
const schoolIds = computed(() => existingAdminMinimalOrgs.value?.schools ?? []);

const { data: existingSchoolsData, isFetched: isSchoolsFetched } = useSchoolsQuery(schoolIds, {
  enabled: initialized,
});

// Fetch the classes assigned to the administration.
const classIds = computed(() => existingAdminMinimalOrgs.value?.classes ?? []);

const { data: existingClassesData, isFetched: isClassesFetched } = useClassesQuery(classIds, {
  enabled: initialized,
});

// Fetch the groups assigned to the administration.
const groupIds = computed(() => existingAdminMinimalOrgs.value?.groups ?? []);

const { data: existingGroupData, isFetched: isGroupsFetched } = useGroupsQuery(groupIds, {
  enabled: initialized,
});

const editOrgsHydrated = computed(() => {
  const mo = existingAdminMinimalOrgs.value ?? {};
  const ready = (ids, isFetchedRef) => !ids?.length || isFetchedRef.value;
  return (
    ready(mo.districts, isDistrictsFetched) &&
    ready(mo.schools, isSchoolsFetched) &&
    ready(mo.classes, isClassesFetched) &&
    ready(mo.groups, isGroupsFetched)
  );
});

const editAssignmentBlockingLoader = computed(() => {
  if (!props.adminId) return false;
  if (!initialized.value) return true;
  if (errorExistingData?.value != null) return false;

  const admin = existingData?.value;
  if (!admin) {
    return isLoadingExistingData.value || !isAdministrationFetched.value;
  }

  if (!administrationMatchesRoute(admin, props.adminId)) return true;

  return !isFormPopulated.value || !editTasksHydrated.value || !editOrgsHydrated.value;
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
  amount: '',
  expectedTime: '',
});

const { refetch: refetchAssignmentExists } = useAssignmentExistsQuery(
  toRef(state, 'administrationName'),
  props.adminId,
);

const rules = {
  administrationName: { required },
  dateStarted: { required },
  dateClosed: { required },
  sequential: { required },
  consent: { requiredIf: requiredIf(!isLevante && noConsent.value === '') },
  assent: { requiredIf: requiredIf(!isLevante && noConsent.value === '') },
};

const v$ = useVuelidate(rules, state);

const minStartDate = computed(() => new Date());

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

const variantsByTaskId = computed(() => {
  return _groupBy(allVariants.value, 'task.id');
});

const handleVariantsChanged = (newVariants) => {
  variants.value = newVariants;
};

const handleConsentSelected = (newConsentAssent) => {
  const isNoConsent = typeof newConsentAssent === 'string' && newConsentAssent.toLowerCase() === 'no consent';
  if (!isNoConsent) {
    noConsent.value = '';
    state.consent = newConsentAssent.consent;
    state.assent = newConsentAssent.assent;
    state.amount = newConsentAssent.amount;
    state.expectedTime = newConsentAssent.expectedTime;
  } else {
    noConsent.value = newConsentAssent;
    state.consent = newConsentAssent;
    state.assent = newConsentAssent;
  }
};

const checkForRequiredOrgs = (orgs) => {
  const filtered = _filter(orgs, (org) => !_isEmpty(org));
  return Boolean(filtered.length);
};

// +------------------------------------------------------------------------------------------------------------------+
// | Form submission
// +------------------------------------------------------------------------------------------------------------------+
const removeNull = (obj) => {
  if (!isPlainObject(obj)) return {};
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== null));
};

const removeUndefined = (obj) => {
  if (!isPlainObject(obj)) return {};
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
};

const scrollToError = (elementId) => {
  // Add a small delay to ensure the DOM is updated
  setTimeout(() => {
    const element = document.getElementById(elementId);
    if (element) {
      // Get the element's position relative to the viewport
      const rect = element.getBoundingClientRect();
      // Calculate the scroll position
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const targetPosition = rect.top + scrollTop - 100; // Offset by 100px to account for any fixed headers

      // Smooth scroll to the element
      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth',
      });

      // Add highlight effect
      element.classList.add('error-highlight');
      setTimeout(() => {
        element.classList.remove('error-highlight');
      }, 2000);
    }
  }, 100);
};

const hasAssignmentChanges = () => {
  const original = existingData.value;
  const current = state;

  // If no original data exists (new assignment), there are always changes
  if (!original) return true;

  const originalName = original.name ?? original.publicName ?? '';
  if (current.administrationName !== originalName) {
    return true;
  }

  const normalizeDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };

  const originalStartDate = normalizeDate(original.dateOpened ?? original.dateOpen);
  const currentStartDate = normalizeDate(current.dateStarted);
  if (originalStartDate !== currentStartDate) {
    return true;
  }

  const originalEndDate = normalizeDate(original.dateClosed ?? original.dateClose);
  const currentEndDate = normalizeDate(current.dateClosed);
  if (originalEndDate !== currentEndDate) {
    return true;
  }

  // Compare sequential
  if (current.sequential !== original.sequential) {
    return true;
  }

  // Compare testData
  if (isTestData.value !== original.testData) {
    return true;
  }

  // Compare orgs - extract IDs and sort for comparison
  const getOrgIds = (orgs) => {
    return toRaw(orgs)
      .map((org) => org.id)
      .sort();
  };

  const originalOrgs = minimalOrgsFromDoc(original);
  const currentDistricts = getOrgIds(current.districts);
  const currentSchools = getOrgIds(current.schools);
  const currentClasses = getOrgIds(current.classes);
  const currentGroups = getOrgIds(current.groups);

  const originalDistricts = (originalOrgs.districts ?? []).slice().sort();
  const originalSchools = (originalOrgs.schools ?? []).slice().sort();
  const originalClasses = (originalOrgs.classes ?? []).slice().sort();
  const originalGroups = (originalOrgs.groups ?? []).slice().sort();

  if (!_isEqual(currentDistricts, originalDistricts)) {
    return true;
  }
  if (!_isEqual(currentSchools, originalSchools)) {
    return true;
  }
  if (!_isEqual(currentClasses, originalClasses)) {
    return true;
  }
  if (!_isEqual(currentGroups, originalGroups)) {
    return true;
  }

  // Compare assessments/variants
  const normalizeAssessment = (assessment) => {
    return {
      taskId: assessment.taskId,
      variantId: assessment.variantId,
      params: removeNull(assessment.params ?? {}),
      conditions: assessment.conditions ? removeNull(assessment.conditions) : undefined,
    };
  };

  const currentAssessments = variants.value
    .map((variant) => {
      return normalizeAssessment({
        taskId: variant.task.id,
        variantId: variant.variant.id,
        params: toRaw(variant.variant.params),
        conditions: toRaw(variant.variant.conditions),
      });
    })
    .sort((a, b) => {
      if (a.taskId !== b.taskId) return a.taskId.localeCompare(b.taskId);
      if (a.variantId !== b.variantId) return (a.variantId || '').localeCompare(b.variantId || '');
      return JSON.stringify(a.params).localeCompare(JSON.stringify(b.params));
    });

  const originalAssessments = (original.assessments ?? []).map(normalizeAssessment).sort((a, b) => {
    if (a.taskId !== b.taskId) return a.taskId.localeCompare(b.taskId);
    if (a.variantId !== b.variantId) return (a.variantId || '').localeCompare(b.variantId || '');
    return JSON.stringify(a.params).localeCompare(JSON.stringify(b.params));
  });

  if (currentAssessments.length !== originalAssessments.length) {
    return true;
  }

  for (let i = 0; i < currentAssessments.length; i++) {
    if (!_isEqual(currentAssessments[i], originalAssessments[i])) {
      return true;
    }
  }

  return false;
};

const submit = async () => {
  submitted.value = true;

  state.administrationPublicName = state.administrationName;

  // First check dates
  if (!state.dateStarted || !state.dateClosed) {
    if (!state.dateStarted) {
      toast.add({
        severity: TOAST_SEVERITIES.ERROR,
        summary: 'Required Field Missing',
        detail: 'Please select a start date',
        life: TOAST_DEFAULT_LIFE_DURATION,
      });
      scrollToError('start-date');
    } else {
      toast.add({
        severity: TOAST_SEVERITIES.ERROR,
        summary: 'Required Field Missing',
        detail: 'Please select an end date',
        life: TOAST_DEFAULT_LIFE_DURATION,
      });
      scrollToError('end-date');
    }
    return;
  }

  // Then check groups
  const orgs = {
    districts: toRaw(state.districts).map((org) => org.id),
    schools: toRaw(state.schools).map((org) => org.id),
    classes: toRaw(state.classes).map((org) => org.id),
    groups: toRaw(state.groups).map((org) => org.id),
  };

  const orgsValid = checkForRequiredOrgs(orgs);
  if (!orgsValid) {
    toast.add({
      severity: TOAST_SEVERITIES.ERROR,
      summary: 'Missing Selection',
      detail: 'Please select at least one Group (Site, School, Class, or Cohort).',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
    // Scroll to the GroupPicker component
    const groupPickerElement = document.querySelector('.group-picker-component');
    if (groupPickerElement) {
      const rect = groupPickerElement.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const targetPosition = rect.top + scrollTop - 100;
      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth',
      });
      groupPickerElement.classList.add('error-highlight');
      setTimeout(() => {
        groupPickerElement.classList.remove('error-highlight');
      }, 2000);
    }
    return;
  }

  // Then check tasks
  const submittedAssessments = variants.value.map((assessment) =>
    removeUndefined({
      variantId: assessment.variant.id,
      variantName: assessment.variant.name,
      taskId: assessment.task.id,
      params: toRaw(assessment.variant.params),
      ...(toRaw(assessment.variant.conditions || undefined) && {
        conditions: toRaw(assessment.variant.conditions),
      }),
    }),
  );

  if (_isEmpty(submittedAssessments)) {
    toast.add({
      severity: TOAST_SEVERITIES.ERROR,
      summary: 'Task Selections',
      detail: 'No variants selected. You must select at least one variant to be assigned.',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
    // Scroll to the TaskPicker component
    const taskPickerElement = document.querySelector('.task-picker-component');
    if (taskPickerElement) {
      const rect = taskPickerElement.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const targetPosition = rect.top + scrollTop - 100;
      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth',
      });
      taskPickerElement.classList.add('error-highlight');
      setTimeout(() => {
        taskPickerElement.classList.remove('error-highlight');
      }, 2000);
    }
    return;
  }

  // Finally check sequential
  if (v$.value.sequential.$invalid) {
    toast.add({
      severity: TOAST_SEVERITIES.ERROR,
      summary: 'Required Field Missing',
      detail: 'Please specify whether tasks should be completed sequentially or not',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
    scrollToError('radio-button-not-sequential');
    return;
  }

  const dateClose = new Date(state.dateClosed);
  dateClose.setHours(23, 59, 59, 999);

  const args = {
    name: toRaw(state).administrationName,
    publicName: toRaw(state).administrationName,
    normalizedName: normalizeToLowercase(toRaw(state).administrationName),
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
    creatorName: toValue(creatorName),
    siteId: authStore.currentSite,
  };

  if (props.adminId) {
    args.administrationId = props.adminId;
  }

  if (!hasAssignmentChanges()) {
    toast.add({
      severity: TOAST_SEVERITIES.WARN,
      summary: 'No assignment change was detected.',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });

    return router.push({ path: APP_ROUTES.VIEW_ASSIGNMENTS });
  }

  const { data: assignmentExists } = await refetchAssignmentExists();

  if (assignmentExists) {
    return toast.add({
      severity: 'error',
      summary: 'Assignment Creation Error',
      detail: 'An assignment with that name already exists.',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
  }

  upsertAdministration(args, {
    onSuccess: () => {
      toast.add({
        severity: TOAST_SEVERITIES.SUCCESS,
        summary: 'Success',
        detail: props.adminId
          ? 'Your assignment edits are being processed. Please check back in a few minutes.'
          : 'Your new assignment is being processed. Please check back in a few minutes.',
        life: TOAST_DEFAULT_LIFE_DURATION,
      });

      queryClient.invalidateQueries({ queryKey: [ADMINISTRATIONS_LIST_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ADMINISTRATIONS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [DSGF_ORGS_QUERY_KEY] });

      router.push({ path: APP_ROUTES.VIEW_ASSIGNMENTS });
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

const resetUserProgress = () => {
  state.administrationName = '';
  state.administrationPublicName = '';
  state.dateStarted = null;
  state.dateClosed = null;
  state.sequential = null;
  state.legal = null;
  state.consent = null;
  state.assent = null;
  state.districts = [];
  state.schools = [];
  state.classes = [];
  state.groups = [];
  state.amount = '';
  state.expectedTime = '';

  // Reset tasks
  variants.value = [];
  preSelectedVariants.value = [];

  // Reset user confirmation
  setHasUserConfirmed(false);
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

watch(
  [state, variants],
  ([newState, newVariants]) => {
    if (
      newState.administrationName !== '' ||
      newState.administrationPublicName !== '' ||
      newState.dateStarted !== null ||
      newState.dateClosed !== null ||
      newState.sequential !== null ||
      newState.legal !== null ||
      newState.consent !== null ||
      newState.assent !== null ||
      newState.schools.length > 0 ||
      newState.classes.length > 0 ||
      newState.groups.length > 0 ||
      newState.amount !== '' ||
      newState.expectedTime !== '' ||
      newVariants.length > 0
    ) {
      // If there is any progress, user should confirm the site changing
      setShouldUserConfirm(true);
    } else {
      // Otherwise, don't ask for confirmation
      setShouldUserConfirm(false);
    }
  },
  {
    deep: true,
  },
);

watch(hasUserConfirmed, (userConfirmed) => {
  if (userConfirmed && !props.adminId) resetUserProgress();
});

function normalizeOrgListForState(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === 'string' ? { id: item } : item));
}

function minimalOrgsFromDoc(admin) {
  if (!admin) return {};
  return admin.minimalOrgs ?? admin.assignedOrgs ?? {};
}

function administrationMatchesRoute(admin, routeAdminId) {
  if (!admin || !routeAdminId) return false;
  const docId = admin.id;
  if (docId == null) return true;
  return String(docId) === String(routeAdminId);
}

function applyAdministrationMetadataToForm(adminInfo) {
  const displayName = adminInfo.name ?? adminInfo.publicName ?? '';
  state.administrationName = displayName;
  state.administrationPublicName = adminInfo.publicName ?? adminInfo.name ?? displayName;

  const opened = adminInfo.dateOpened ?? adminInfo.dateOpen;
  const closed = adminInfo.dateClosed ?? adminInfo.dateClose;
  state.dateStarted = opened ? new Date(opened) : null;
  state.dateClosed = closed ? new Date(closed) : null;

  const mo = minimalOrgsFromDoc(adminInfo);
  const expectsFetchedOrgs =
    (mo.districts?.length ?? 0) + (mo.schools?.length ?? 0) + (mo.classes?.length ?? 0) + (mo.groups?.length ?? 0) > 0;

  if (expectsFetchedOrgs) {
    state.districts = existingDistrictsData.value ?? [];
    state.schools = existingSchoolsData.value ?? [];
    state.classes = existingClassesData.value ?? [];
    state.groups = existingGroupData.value ?? [];
  } else {
    state.districts = normalizeOrgListForState(adminInfo.districts);
    state.schools = normalizeOrgListForState(adminInfo.schools);
    state.classes = normalizeOrgListForState(adminInfo.classes);
    state.groups = normalizeOrgListForState(adminInfo.groups);
  }

  state.sequential = adminInfo.sequential;
  state.legal = adminInfo.legal;
  state.consent = adminInfo?.legal?.consent ?? null;
  state.assent = adminInfo?.legal?.assent ?? null;
  isTestData.value = adminInfo.testData;

  if (state.consent?.toLowerCase() === 'no consent') {
    noConsent.value = state.consent;
  }
}

watch(
  () => props.adminId,
  (nextId, prevId) => {
    if (nextId === prevId) return;
    preSelectedVariants.value = [];
    variants.value = [];
    isFormPopulated.value = false;
    editTasksHydrated.value = false;
  },
);

watch(
  [() => props.adminId, existingData, editOrgsHydrated],
  ([adminId, admin, orgsHydrated]) => {
    if (isFormPopulated.value) return;
    if (!adminId || !admin) return;
    if (!administrationMatchesRoute(admin, adminId)) return;
    if (!orgsHydrated) return;
    applyAdministrationMetadataToForm(admin);
    isFormPopulated.value = true;
  },
  { immediate: true },
);

watch(
  [existingData, allVariants, isVariantsFetched],
  ([adminInfo, allVariantInfo, variantsFetched]) => {
    if (!props.adminId) return;
    if (!adminInfo || !administrationMatchesRoute(adminInfo, props.adminId)) return;
    if (!variantsFetched || !Array.isArray(allVariantInfo)) return;

    preSelectedVariants.value = [];
    _forEach(adminInfo.assessments, (assessment) => {
      const found = resolveVariantForAssessment(assessment, allVariantInfo);
      if (found) {
        preSelectedVariants.value = _union(preSelectedVariants.value, [found]);
      }
    });
    variants.value = preSelectedVariants.value.slice();
    editTasksHydrated.value = true;
  },
  { immediate: true },
);
</script>

<style lang="scss" scoped>
.page-title-row :deep(.docs-button) {
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
}

.how-to-section {
  background-color: #f8f9fa;
  border-radius: 0.5rem;
  padding: 1.5rem;
  margin: 2rem 0;

  h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: var(--primary-color);
    font-size: 1.2rem;
    font-weight: bold;
  }
}
</style>

<style lang="scss">
.required {
  float: right;
}
.p-datepicker-today span {
  background-color: var(--blue-100) !important; /* Change to your desired color */
}

.p-datepicker-today .p-datepicker-day-selected,
.p-datepicker-day-selected span {
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

.confirm .p-dialog-footer {
  display: flex;
  justify-content: center;
}

.confirm .p-dialog-footer .p-button {
  min-width: 100px;
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
.required-asterisk {
  color: var(--red-500);
}

.error-highlight {
  animation: highlight 2s ease-out;
}

@keyframes highlight {
  0% {
    background-color: var(--red-100);
  }
  100% {
    background-color: transparent;
  }
}

.levante-spinner-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  width: 100vw;
  pointer-events: none;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
}
</style>
