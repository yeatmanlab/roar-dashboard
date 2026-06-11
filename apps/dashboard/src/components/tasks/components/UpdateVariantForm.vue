<template>
  <form class="p-fluid" @submit.prevent="handleSubmit()">
    <h1 class="text-center font-bold">Update a Variant</h1>

    <fieldset class="flex flex-column row-gap-4 mb-4 p-4">
      <legend class="sr-only">Variant Selection</legend>

      <Dropdown
        v-model="selectedTaskId"
        :data="formattedTasks"
        :loading-data="isFetchingTasks"
        label="Select an Existing Task"
        placeholder="Select a Task"
        label-key="name"
        value-key="id"
        :required="true"
      />

      <template v-if="selectedTaskId">
        <Dropdown
          v-model="statusFilter"
          :data="statusFilterOptions"
          label="Variant Status"
          label-key="label"
          value-key="value"
          placeholder="Filter by Status"
        />

        <Dropdown
          v-model="selectedVariantId"
          :data="formattedVariants"
          :loading-data="isFetchingVariants"
          label="Select an Existing Variant"
          placeholder="Select a Variant"
          label-key="name"
          value-key="id"
          :required="true"
        />
      </template>
    </fieldset>

    <template v-if="selectedVariant">
      <fieldset class="flex flex-column row-gap-4 p-4">
        <legend class="sr-only">Variant Details</legend>

        <TextInput
          id="updateVariantName"
          v-model="v$.name.$model"
          label="Variant Name"
          :is-invalid="v$.name.$invalid && v$.name.$dirty"
          :errors="v$.name.$errors"
        />

        <TextInput
          id="updateVariantDescription"
          v-model="v$.description.$model"
          label="Description"
          :is-invalid="v$.description.$invalid && v$.description.$dirty"
          :errors="v$.description.$errors"
        />

        <Dropdown
          v-model="formModel.status"
          :data="statusOptions"
          label="Status"
          placeholder="Select a Status"
          :required="true"
        />
      </fieldset>

      <fieldset class="flex flex-column row-gap-2 p-4">
        <div>
          <legend class="text-lg font-medium mb-0">Variant Parameters</legend>
          <p class="text-md text-gray-500 mt-2">
            Adjust the parameter values for this variant. Saving replaces the variant's entire parameter set.
          </p>
        </div>

        <!-- Passthrough names are blacklisted: a new row reusing one would otherwise
             produce a duplicate parameter name and a confusing backend 409. -->
        <TaskParametersConfigurator
          v-model="paramsModel"
          edit-mode
          :validation-key-blacklist="paramsPassthroughNames"
        />

        <p v-if="paramsPassthroughNames.length > 0" class="text-sm text-gray-500 mt-2">
          The following parameters hold values this editor can't represent (lists, nested objects, or unset values) and
          will be preserved exactly as-is: <b>{{ paramsPassthroughNames.join(', ') }}</b>
        </p>
      </fieldset>

      <div class="form-submit">
        <PvButton
          v-tooltip="
            userCan(Permissions.Tasks.UPDATE)
              ? false
              : 'You do not have permission to update variants. If you feel this is a mistake, please contact your administrator.'
          "
          :disabled="!userCan(Permissions.Tasks.UPDATE)"
          type="submit"
          label="Update Variant"
          class="submit-button w-2 my-4 bg-primary text-white border-none border-round p-2 hover:bg-red-900"
          severity="primary"
        />
      </div>
    </template>
  </form>

  <PvToast />
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { helpers, maxLength } from '@vuelidate/validators';
import { useVuelidate } from '@vuelidate/core';
import { useToast } from 'primevue/usetoast';
import PvButton from 'primevue/button';
import PvToast from 'primevue/toast';
import useTasksQuery from '@/composables/queries/useTasksQuery';
import useTaskVariantsByTaskQuery from '@/composables/queries/useTaskVariantsByTaskQuery';
import useUpdateTaskVariantMutation from '@/composables/mutations/useUpdateTaskVariantMutation';
import Dropdown from '@/components/Form/Dropdown';
import TextInput from '@/components/Form/TextInput';
import TaskParametersConfigurator from '@/components/TaskParametersConfigurator/TaskParametersConfigurator.vue';
import { buildVariantPatchBody, splitVariantParameters } from '@/helpers/taskConfig';
import { TOAST_SEVERITIES, TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';
import {
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_NAME_MAX_LENGTH,
  TASK_NAME_REGEX,
  TASK_VARIANT_STATUSES,
} from '@/constants/tasks';
import { usePermissions } from '@/composables/usePermissions';

const toast = useToast();
const { userCan, Permissions } = usePermissions();

// Task selection is owned by the parent (ManageVariants) so it survives
// toggling between the create and update views.
const selectedTaskId = defineModel('selectedTaskId', {
  type: String,
  required: true,
});

// ─── Task selection ──────────────────────────────────────────────────────────

const { isFetching: isFetchingTasks, data: tasks } = useTasksQuery();

const formattedTasks = computed(() => {
  if (!tasks.value) return [];
  return tasks.value.map((task) => {
    return {
      ...task,
      name: task.name ?? task.id,
    };
  });
});

// ─── Variant selection ───────────────────────────────────────────────────────

const statusOptions = Object.values(TASK_VARIANT_STATUSES);

// "All statuses" uses a string sentinel rather than null: PvSelect treats a null
// model as "no selection" and would show the placeholder instead of the active
// filter. The sentinel maps to omitting the status query param, which lets super
// admins see all statuses (the backend restricts non-super-admins to published
// regardless).
const ALL_STATUSES_FILTER = 'all';
const statusFilterOptions = [
  { label: 'All statuses', value: ALL_STATUSES_FILTER },
  ...statusOptions.map((status) => ({ label: status, value: status })),
];

const statusFilter = ref(TASK_VARIANT_STATUSES.PUBLISHED);
const statusQueryParam = computed(() => (statusFilter.value === ALL_STATUSES_FILTER ? null : statusFilter.value));

const { isFetching: isFetchingVariants, data: variants } = useTaskVariantsByTaskQuery(selectedTaskId, statusQueryParam);

const selectedVariantId = ref('');

const selectedVariant = computed(() => {
  if (!selectedVariantId.value) return null;
  return (variants.value ?? []).find((variant) => variant.id === selectedVariantId.value) ?? null;
});

const formattedVariants = computed(() => {
  return (variants.value ?? []).map((variant) => {
    return {
      ...variant,
      name: variant.name ?? variant.id,
    };
  });
});

// Switching tasks (or the status filter) invalidates the variant selection.
watch([selectedTaskId, statusFilter], () => {
  selectedVariantId.value = '';
});

// ─── Update variant form ─────────────────────────────────────────────────────

const formModel = reactive({ name: '', description: '', status: TASK_VARIANT_STATUSES.DRAFT });
const paramsModel = reactive([]);
const paramsPassthrough = ref([]);

const paramsPassthroughNames = computed(() => paramsPassthrough.value.map((entry) => entry.name));

// The format rule only applies to CHANGED names: legacy variants may hold names
// that predate the contract's format constraint, and validating the seeded value
// would block unrelated updates (e.g. a status-only change) until the user
// renames the variant — which would then PATCH the name as a side effect.
const variantNameValidator = helpers.withMessage(
  'Must start with a letter and contain only letters, numbers, spaces, hyphens, and underscores',
  (value) => !value || value === (selectedVariant.value?.name ?? '') || TASK_NAME_REGEX.test(value),
);

const formRules = {
  // Optional fields simply omit `required` — vuelidate treats every key as a validator function.
  name: { maxLength: maxLength(TASK_NAME_MAX_LENGTH), nameFormat: variantNameValidator },
  description: { maxLength: maxLength(TASK_DESCRIPTION_MAX_LENGTH) },
};

const v$ = useVuelidate(formRules, formModel);

// Seed the update form whenever a DIFFERENT variant is selected. Keyed on the
// id — not the computed variant object — so background refetches can't re-seed
// the form and wipe in-progress edits.
watch(selectedVariantId, (variantId) => {
  if (!variantId) return;

  const variant = (variants.value ?? []).find((candidate) => candidate.id === variantId);
  if (!variant) return;

  Object.assign(formModel, {
    name: variant.name ?? '',
    description: variant.description ?? '',
    status: variant.status,
  });

  const { editableRows, passthrough } = splitVariantParameters(variant.parameters);
  paramsModel.splice(0, paramsModel.length, ...editableRows);
  paramsPassthrough.value = passthrough;
  v$.value.$reset();
});

/**
 * Reset the form to its initial state.
 *
 * @returns {void}
 */
function resetForm() {
  selectedVariantId.value = '';
  paramsModel.splice(0, paramsModel.length);
  paramsPassthrough.value = [];
  v$.value.$reset();
}

const { mutate: updateVariant } = useUpdateTaskVariantMutation();

/**
 * Handle form submission
 *
 * Executes a final form validation before compiling the diffed PATCH body and submitting it to the API via the
 * updateVariant mutation. No-op submissions (nothing changed) are short-circuited with an informational toast since
 * the contract rejects empty PATCH bodies.
 *
 * @returns {void}
 */
const handleSubmit = async () => {
  const isFormValid = await v$.value.$validate();

  if (!isFormValid || !selectedVariant.value) {
    toast.add({
      severity: TOAST_SEVERITIES.WARNING,
      summary: 'Not so fast!',
      detail: 'Invalid input, please check errors.',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });

    return;
  }

  const variant = selectedVariant.value;
  const body = buildVariantPatchBody(variant, formModel, paramsModel, paramsPassthrough.value);

  if (Object.keys(body).length === 0) {
    toast.add({
      severity: TOAST_SEVERITIES.INFO,
      summary: 'Nothing to update',
      detail: 'No fields were changed.',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });

    return;
  }

  updateVariant(
    { taskId: variant.taskId, variantId: variant.id, body },
    {
      onSuccess: () => {
        toast.add({
          severity: TOAST_SEVERITIES.SUCCESS,
          summary: 'Hoorah!',
          detail: 'Variant successfully updated.',
          life: TOAST_DEFAULT_LIFE_DURATION,
        });
        resetForm();
      },
      onError: (error) => {
        const backendMessage = error?.body?.error?.message;
        toast.add({
          severity: TOAST_SEVERITIES.ERROR,
          summary: 'Error',
          detail: backendMessage ?? 'Unable to update variant, please try again.',
          life: TOAST_DEFAULT_LIFE_DURATION,
        });
        console.error('Failed to update variant.', error);
      },
    },
  );
};
</script>
