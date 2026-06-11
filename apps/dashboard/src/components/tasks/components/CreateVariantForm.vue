<template>
  <form class="p-fluid card px-3" @submit.prevent="handleSubmit()">
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
          v-model="v$.name.$model"
          label="Variant Name"
          :is-invalid="v$.name.$invalid && v$.name.$dirty"
          :errors="v$.name.$errors"
        />

        <TextInput
          id="variantDescription"
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

      <TaskParametersConfigurator v-model="paramsModel" />
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
</template>

<script setup>
import { computed, reactive, watch } from 'vue';
import { helpers, maxLength } from '@vuelidate/validators';
import { useVuelidate } from '@vuelidate/core';
import { useToast } from 'primevue/usetoast';
import PvButton from 'primevue/button';
import useTasksQuery from '@/composables/queries/useTasksQuery';
import useAddTaskVariantMutation from '@/composables/mutations/useAddTaskVariantMutation';
import Dropdown from '@/components/Form/Dropdown';
import TextInput from '@/components/Form/TextInput';
import TaskParametersConfigurator from '@/components/TaskParametersConfigurator/TaskParametersConfigurator.vue';
import { buildVariantParametersFromRows } from '@/helpers/taskConfig';
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

// ─── Create variant form ─────────────────────────────────────────────────────

const statusOptions = Object.values(TASK_VARIANT_STATUSES);

const initialFormState = { name: '', description: '', status: TASK_VARIANT_STATUSES.DRAFT };
const formModel = reactive({ ...initialFormState });
const paramsModel = reactive([]);

// Parameters are task-specific: switching tasks clears the form's rows so
// parameters drafted for one task can't silently carry over to another.
watch(selectedTaskId, () => {
  paramsModel.splice(0, paramsModel.length);
});

const variantNameValidator = helpers.withMessage(
  'Must start with a letter and contain only letters, numbers, spaces, hyphens, and underscores',
  helpers.regex(TASK_NAME_REGEX),
);

const formRules = {
  // Optional fields simply omit `required` — vuelidate treats every key as a validator function.
  name: { maxLength: maxLength(TASK_NAME_MAX_LENGTH), nameFormat: variantNameValidator },
  description: { maxLength: maxLength(TASK_DESCRIPTION_MAX_LENGTH) },
};

const v$ = useVuelidate(formRules, formModel);

/**
 * Reset the form to its initial state.
 *
 * @returns {void}
 */
function resetForm() {
  Object.assign(formModel, initialFormState);
  paramsModel.splice(0, paramsModel.length);
  v$.value.$reset();
}

const { mutate: addVariant } = useAddTaskVariantMutation();

/**
 * Handle form submission
 *
 * Executes a final form validation before compiling the request body and submitting it to the API via the addVariant
 * mutation. Optional fields are omitted when blank — the contract's strict schema rejects empty strings. Once
 * submitted, the form is reset to its initial state to allow for further variant creation.
 *
 * @returns {void}
 */
const handleSubmit = async () => {
  const isFormValid = await v$.value.$validate();

  if (!isFormValid || !selectedTaskId.value) {
    toast.add({
      severity: TOAST_SEVERITIES.WARNING,
      summary: 'Not so fast!',
      detail: 'Invalid input, please check errors.',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });

    return;
  }

  const name = formModel.name.trim();
  const description = formModel.description.trim();

  const body = {
    status: formModel.status,
    parameters: buildVariantParametersFromRows(paramsModel),
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
        resetForm();
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
</script>
