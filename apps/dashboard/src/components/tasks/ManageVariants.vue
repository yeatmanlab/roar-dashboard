<template>
  <PvToast />
  <PvSelectButton
    v-model="viewModel"
    :options="Object.values(MODEL_VIEWS)"
    class="flex my-2 select-button p-2"
    @change="handleViewChange($event.value)"
  />

  <form
    v-show="viewModel === MODEL_VIEWS.CREATE_VARIANT"
    class="p-fluid card px-3"
    @submit.prevent="handleCreateSubmit()"
  >
    <h1 class="text-center font-bold">Create a New Variant</h1>

    <fieldset class="flex flex-column row-gap-4">
      <legend class="sr-only">Variant Details</legend>

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
        <TextInput
          id="variantName"
          v-model="vCreate$.name.$model"
          label="Variant Name"
          :is-invalid="vCreate$.name.$invalid && vCreate$.name.$dirty"
          :errors="vCreate$.name.$errors"
        />

        <TextInput
          id="variantDescription"
          v-model="vCreate$.description.$model"
          label="Description"
          :is-invalid="vCreate$.description.$invalid && vCreate$.description.$dirty"
          :errors="vCreate$.description.$errors"
        />

        <Dropdown
          v-model="createModel.status"
          :data="statusOptions"
          label="Status"
          placeholder="Select a Status"
          :required="true"
        />
      </template>
    </fieldset>

    <fieldset v-if="selectedTaskId" class="mt-4">
      <div>
        <legend class="text-lg font-medium mb-0">Variant Parameters</legend>
        <p class="text-md text-gray-500 mt-2">
          Configure the parameter values for this variant of <b>{{ selectedTask?.name }}</b
          >.
        </p>
      </div>

      <TaskParametersConfigurator v-model="createParamsModel" />
    </fieldset>

    <div v-if="selectedTaskId" class="form-submit">
      <PvButton
        v-tooltip="
          userCan(Permissions.Tasks.CREATE)
            ? false
            : 'You do not have permission to create variants. If you feel this is a mistake, please contact your administrator.'
        "
        :disabled="!userCan(Permissions.Tasks.CREATE)"
        type="submit"
        label="Submit"
        class="submit-button w-2 my-4 bg-primary text-white border-none border-round p-2 hover:bg-red-900"
        severity="primary"
      />
    </div>
  </form>

  <form v-show="viewModel === MODEL_VIEWS.UPDATE_VARIANT" class="p-fluid" @submit.prevent="handleUpdateSubmit()">
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
          v-model="vUpdate$.name.$model"
          label="Variant Name"
          :is-invalid="vUpdate$.name.$invalid && vUpdate$.name.$dirty"
          :errors="vUpdate$.name.$errors"
        />

        <TextInput
          id="updateVariantDescription"
          v-model="vUpdate$.description.$model"
          label="Description"
          :is-invalid="vUpdate$.description.$invalid && vUpdate$.description.$dirty"
          :errors="vUpdate$.description.$errors"
        />

        <Dropdown
          v-model="updateModel.status"
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

        <TaskParametersConfigurator v-model="updateParamsModel" edit-mode />

        <p v-if="updateParamsPassthrough.length > 0" class="text-sm text-gray-500 mt-2">
          The following parameters hold values this editor can't represent (lists, nested objects, or unset values) and
          will be preserved exactly as-is: <b>{{ updateParamsPassthrough.map((entry) => entry.name).join(', ') }}</b>
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
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import _isEqual from 'lodash/isEqual';
import { helpers, maxLength } from '@vuelidate/validators';
import { useVuelidate } from '@vuelidate/core';
import { useToast } from 'primevue/usetoast';
import PvButton from 'primevue/button';
import PvSelectButton from 'primevue/selectbutton';
import PvToast from 'primevue/toast';
import useTasksQuery from '@/composables/queries/useTasksQuery';
import useTaskVariantsByTaskQuery from '@/composables/queries/useTaskVariantsByTaskQuery';
import useAddTaskVariantMutation from '@/composables/mutations/useAddTaskVariantMutation';
import useUpdateTaskVariantMutation from '@/composables/mutations/useUpdateTaskVariantMutation';
import Dropdown from '@/components/Form/Dropdown';
import TextInput from '@/components/Form/TextInput';
import TaskParametersConfigurator from '@/containers/ManageTasks/components/TaskParametersConfigurator.vue';
import { buildVariantParametersFromRows, splitVariantParameters, variantParametersToMap } from '@/helpers/taskConfig';
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

const MODEL_VIEWS = Object.freeze({
  CREATE_VARIANT: 'Create Variant',
  UPDATE_VARIANT: 'Update Variant',
});

const viewModel = ref(MODEL_VIEWS.CREATE_VARIANT);

const handleViewChange = (value) => {
  const selectedView = Object.values(MODEL_VIEWS).find((view) => view === value);
  if (selectedView) {
    viewModel.value = selectedView;
  }
};

// ─── Task selection (shared between both views) ──────────────────────────────

const { isFetching: isFetchingTasks, data: tasks } = useTasksQuery();

const selectedTaskId = ref('');

const selectedTask = computed(() => {
  if (!selectedTaskId.value) return null;
  return (tasks.value ?? []).find((task) => task.id === selectedTaskId.value) ?? null;
});

const formattedTasks = computed(() => {
  if (!tasks.value) return [];
  return tasks.value.map((task) => {
    return {
      ...task,
      name: task.name ?? task.id,
    };
  });
});

// ─── Variant list (update view) ──────────────────────────────────────────────

const statusOptions = Object.values(TASK_VARIANT_STATUSES);

// `null` omits the status query param: super admins then see all statuses
// (the backend restricts non-super-admins to published regardless).
const ALL_STATUSES_FILTER = { label: 'All statuses', value: null };
const statusFilterOptions = [ALL_STATUSES_FILTER, ...statusOptions.map((status) => ({ label: status, value: status }))];

const statusFilter = ref(TASK_VARIANT_STATUSES.PUBLISHED);

const { isFetching: isFetchingVariants, data: variants } = useTaskVariantsByTaskQuery(selectedTaskId, statusFilter);

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

// ─── Create variant form ─────────────────────────────────────────────────────

const createInitialState = { name: '', description: '', status: TASK_VARIANT_STATUSES.DRAFT };
const createModel = reactive({ ...createInitialState });
const createParamsModel = reactive([]);

const variantNameValidator = helpers.withMessage(
  'Must start with a letter and contain only letters, numbers, spaces, hyphens, and underscores',
  helpers.regex(TASK_NAME_REGEX),
);

const createRules = {
  name: { required: false, maxLength: maxLength(TASK_NAME_MAX_LENGTH), nameFormat: variantNameValidator },
  description: { required: false, maxLength: maxLength(TASK_DESCRIPTION_MAX_LENGTH) },
};

const vCreate$ = useVuelidate(createRules, createModel);

function resetCreateForm() {
  Object.assign(createModel, createInitialState);
  createParamsModel.splice(0, createParamsModel.length);
  vCreate$.value.$reset();
}

const { mutate: addVariant } = useAddTaskVariantMutation();

const handleCreateSubmit = async () => {
  const isFormValid = await vCreate$.value.$validate();

  if (!isFormValid || !selectedTaskId.value) {
    toast.add({
      severity: TOAST_SEVERITIES.WARNING,
      summary: 'Not so fast!',
      detail: 'Invalid input, please check errors.',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });

    return;
  }

  const name = createModel.name.trim();
  const description = createModel.description.trim();

  const body = {
    status: createModel.status,
    parameters: buildVariantParametersFromRows(createParamsModel),
    ...(name ? { name } : {}),
    ...(description ? { description } : {}),
  };

  addVariant(
    { taskId: selectedTaskId.value, body },
    {
      onSuccess: () => {
        toast.add({
          severity: TOAST_SEVERITIES.SUCCESS,
          summary: 'Hoorah!',
          detail: 'Variant successfully created.',
          life: TOAST_DEFAULT_LIFE_DURATION,
        });
        resetCreateForm();
      },
      onError: (error) => {
        const backendMessage = error?.body?.error?.message;
        toast.add({
          severity: TOAST_SEVERITIES.ERROR,
          summary: 'Error',
          detail: backendMessage ?? 'Unable to create variant, please try again.',
          life: TOAST_DEFAULT_LIFE_DURATION,
        });
        console.error('Failed to add variant.', error);
      },
    },
  );
};

// ─── Update variant form ─────────────────────────────────────────────────────

const updateModel = reactive({ name: '', description: '', status: TASK_VARIANT_STATUSES.DRAFT });
const updateParamsModel = reactive([]);
const updateParamsPassthrough = ref([]);

const updateRules = {
  name: { required: false, maxLength: maxLength(TASK_NAME_MAX_LENGTH), nameFormat: variantNameValidator },
  description: { required: false, maxLength: maxLength(TASK_DESCRIPTION_MAX_LENGTH) },
};

const vUpdate$ = useVuelidate(updateRules, updateModel);

// Seed the update form whenever a DIFFERENT variant is selected. Keyed on the
// id — not the computed variant object — so background refetches can't re-seed
// the form and wipe in-progress edits.
watch(selectedVariantId, (variantId) => {
  if (!variantId) return;

  const variant = (variants.value ?? []).find((candidate) => candidate.id === variantId);
  if (!variant) return;

  Object.assign(updateModel, {
    name: variant.name ?? '',
    description: variant.description ?? '',
    status: variant.status,
  });

  const { editableRows, passthrough } = splitVariantParameters(variant.parameters);
  updateParamsModel.splice(0, updateParamsModel.length, ...editableRows);
  updateParamsPassthrough.value = passthrough;
  vUpdate$.value.$reset();
});

function resetUpdateForm() {
  selectedVariantId.value = '';
  updateParamsModel.splice(0, updateParamsModel.length);
  updateParamsPassthrough.value = [];
  vUpdate$.value.$reset();
}

/**
 * Build the diffed PATCH body for the selected variant.
 *
 * Only changed fields are included — the contract rejects empty bodies, so
 * no-op submissions are short-circuited by the caller. Cleared nullable fields
 * (name, description) are sent as null. The parameters array replaces the
 * variant's entire parameter set, so it's only included when actually changed;
 * the comparison is by name → value map since entry order carries no meaning.
 *
 * @param {Object} variant – The original variant from the catalog.
 * @returns {Object} The PATCH body containing only changed fields.
 */
function buildVariantPatchBody(variant) {
  const body = {};

  for (const field of ['name', 'description']) {
    const trimmed = updateModel[field].trim();
    if (trimmed !== (variant[field] ?? '')) {
      body[field] = trimmed === '' ? null : trimmed;
    }
  }

  if (updateModel.status !== variant.status) {
    body.status = updateModel.status;
  }

  const editedParameters = buildVariantParametersFromRows(updateParamsModel, updateParamsPassthrough.value);
  if (!_isEqual(variantParametersToMap(editedParameters), variantParametersToMap(variant.parameters))) {
    body.parameters = editedParameters;
  }

  return body;
}

const { mutate: updateVariant } = useUpdateTaskVariantMutation();

const handleUpdateSubmit = async () => {
  const isFormValid = await vUpdate$.value.$validate();

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
  const body = buildVariantPatchBody(variant);

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
        resetUpdateForm();
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

<style>
.submit-button {
  margin: auto;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  display: flex;
  border: none;
  width: 11.75rem;
}

.submit-button:hover {
  background-color: #2b8ecb;
  color: black;
}

.select-button .p-button:last-of-type:not(:only-of-type) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-top-right-radius: 25rem;
  border-bottom-right-radius: 25rem;
}

.select-button .p-button:first-of-type:not(:only-of-type) {
  border-top-left-radius: 25rem;
  border-bottom-left-radius: 25rem;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
</style>
