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

      <!-- Import variant definitions as JSON, for one task at a time. -->
      <div class="flex flex-column gap-1 my-3">
        <PvButton
          type="button"
          label="Upload variant definitions (JSON)"
          icon="pi pi-upload"
          outlined
          data-testid="create-variant-form__params-upload"
          aria-describedby="params-upload-hint"
          @click="paramsFileInput?.click()"
        />
        <small id="params-upload-hint" class="text-gray-500">
          Accepts JSON variant definitions — <code>{ "variantName": "…", "params": { … } }</code>, or an array of them.
          Fills the name and the rows below; parameter types are inferred from their values. All definitions must belong
          to the same task, since variants are created under the task selected above.
        </small>
        <input
          ref="paramsFileInput"
          type="file"
          accept="application/json,.json"
          class="hidden"
          data-testid="create-variant-form__params-file"
          @change="handleParamsFileUpload"
        />
      </div>

      <!-- Shown while several definitions were loaded and any remain uncreated; created ones drop out. -->
      <div
        v-if="uploadedVariants.length > 1 && remainingVariants.length > 0"
        class="my-3 flex flex-column gap-2"
        data-testid="create-variant-form__uploaded-variant-picker"
      >
        <Dropdown
          v-model="selectedUploadedName"
          :data="uploadedVariantOptions"
          label="Variant to create"
          placeholder="Select a variant to create"
          label-key="name"
          value-key="id"
        />
        <div v-if="remainingVariants.length > 1" class="flex flex-column gap-1">
          <PvButton
            type="button"
            :label="`Create all ${remainingVariants.length} remaining`"
            icon="pi pi-list-check"
            outlined
            :loading="isCreatingAll"
            :disabled="isCreatingAll || !userCan(Permissions.Tasks.CREATE)"
            data-testid="create-variant-form__create-all"
            @click="createAllVariants()"
          />
          <small class="text-gray-500">
            Creates each remaining definition, using the status it declares or the one selected above. Descriptions are
            not applied.
          </small>
        </div>
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
import { computed, reactive, ref, watch } from 'vue';
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
import { parseVariantDefinitions } from '@/helpers/parseVariantDefinitions';
import { TOAST_SEVERITIES, TOAST_DEFAULT_LIFE_DURATION, TOAST_LONG_LIFE_DURATION } from '@/constants/toasts';
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
  uploadedVariants.value = [];
  selectedUploadedName.value = null;
  createdNames.value = new Set();
});

// ─── Variant definition upload ───────────────────────────────────────────────
// Accepts `{ variantName, params }` definitions so the name and parameter rows
// come from the upload instead of being retyped. Applying one REPLACES the
// current name and rows.
//
// The parser rejects a batch whose definitions span several tasks, since the form
// creates under whichever task is selected. Several variants of one task are
// fine, and offer a picker so the researcher can work down the batch without
// re-uploading.
const paramsFileInput = ref(null);
const uploadedVariants = ref([]);
const selectedUploadedName = ref(null);
const isCreatingAll = ref(false);

// Names created during this session, so a definition drops out of the picker once
// it exists rather than sitting there inviting a duplicate-name conflict.
const createdNames = ref(new Set());

/** Loaded definitions that have not been created yet. */
const remainingVariants = computed(() =>
  uploadedVariants.value.filter((variant) => !createdNames.value.has(variant.variantName.toLowerCase())),
);

/** Dropdown options for the definitions still to be created. */
const uploadedVariantOptions = computed(() =>
  remainingVariants.value.map((variant) => ({ id: variant.variantName, name: variant.variantName })),
);

/**
 * Record a created variant, releasing the upload once nothing is left to create.
 *
 * @param {string} name - The variant name that was created
 * @returns {void}
 */
function markVariantCreated(name) {
  createdNames.value = new Set(createdNames.value).add(name.toLowerCase());
  if (remainingVariants.value.length === 0) {
    uploadedVariants.value = [];
    createdNames.value = new Set();
    selectedUploadedName.value = null;
  }
}

/**
 * Apply an uploaded variant definition to the form, replacing the name and the rows.
 *
 * A definition that declares a `status` moves the dropdown to it, so the selection stays visible
 * and overridable rather than being applied invisibly at submit time. A definition that declares
 * none leaves whatever is already selected.
 *
 * @param {{ variantName: string, status?: string, rows: Array<object> }} variant - Parsed variant to apply
 * @returns {void}
 */
function applyUploadedVariant(variant) {
  formModel.name = variant.variantName;
  if (variant.status) formModel.status = variant.status;
  paramsModel.splice(0, paramsModel.length, ...variant.rows);
  toast.add({
    severity: TOAST_SEVERITIES.SUCCESS,
    summary: 'Variant loaded',
    detail: `Loaded "${variant.variantName}" with ${variant.rows.length} parameter${
      variant.rows.length === 1 ? '' : 's'
    }.`,
    life: TOAST_DEFAULT_LIFE_DURATION,
  });
}

// Selecting a different variant from the picker re-applies it over the form.
watch(selectedUploadedName, (name) => {
  if (!name) return;
  const variant = uploadedVariants.value.find((candidate) => candidate.variantName === name);
  if (variant) applyUploadedVariant(variant);
});

const handleParamsFileUpload = (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const variants = parseVariantDefinitions(String(reader.result));
      uploadedVariants.value = variants;
      selectedUploadedName.value = null;
      createdNames.value = new Set();

      if (variants.length === 1) {
        applyUploadedVariant(variants[0]);
      } else {
        toast.add({
          severity: TOAST_SEVERITIES.INFO,
          summary: 'Select a variant',
          detail: `${variants.length} variants were loaded for this task. Choose which one to create.`,
          life: TOAST_LONG_LIFE_DURATION,
        });
      }
    } catch (error) {
      toast.add({
        severity: TOAST_SEVERITIES.ERROR,
        summary: 'Invalid variant definitions',
        detail: error.message,
        life: TOAST_LONG_LIFE_DURATION,
      });
    } finally {
      // Reset so re-selecting the same file re-fires `change`.
      event.target.value = '';
    }
  };
  reader.onerror = () => {
    toast.add({
      severity: TOAST_SEVERITIES.ERROR,
      summary: 'Could not read file',
      detail: 'The selected file could not be read. Please try again.',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
    event.target.value = '';
  };
  reader.readAsText(file);
};

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
  // The loaded definitions are deliberately kept: a researcher creates several
  // variants of one task in turn, and dropping the picker here would force a
  // re-upload per variant. Only the applied selection is released.
  selectedUploadedName.value = null;
  v$.value.$reset();
}

const { mutate: addVariant, mutateAsync: addVariantAsync } = useAddTaskVariantMutation();

/**
 * Handle form submission
 *
 * Executes a final form validation before compiling the request body and submitting it to the API via the addVariant
 * mutation. Optional fields are omitted when blank — the contract's strict schema rejects empty strings. Once
 * submitted, the form is reset to its initial state to allow for further variant creation.
 *
 * @returns {void}
 */
/**
 * Create every remaining loaded definition for the selected task, in order.
 *
 * Sequential rather than concurrent so a failure is attributable to one definition, and it
 * continues past failures rather than abandoning the batch — a definition that already exists
 * comes back as a 409, and that should not stop the ones that do not. The outcome is reported
 * as a summary, and each success drops out of the picker.
 *
 * Names and parameters come from the upload. `status` comes from the definition when it declares
 * one and from the form otherwise — a single dropdown cannot express a batch where some variants
 * publish and others stay draft. Description is deliberately not applied, since it is free text
 * with no per-definition source.
 *
 * @returns {Promise<void>}
 */
async function createAllVariants() {
  if (isCreatingAll.value || !selectedTaskId.value) return;

  isCreatingAll.value = true;
  const pending = [...remainingVariants.value];
  const failures = [];
  let createdCount = 0;

  for (const variant of pending) {
    try {
      await addVariantAsync({
        taskId: selectedTaskId.value,
        body: {
          status: variant.status ?? formModel.status,
          parameters: buildVariantParametersFromRows(variant.rows),
          name: variant.variantName,
        },
      });
      createdCount += 1;
      markVariantCreated(variant.variantName);
    } catch (error) {
      failures.push(`${variant.variantName}: ${error?.body?.error?.message ?? error.message}`);
    }
  }

  isCreatingAll.value = false;

  if (failures.length === 0) {
    resetForm();
    toast.add({
      severity: TOAST_SEVERITIES.SUCCESS,
      summary: 'Variants created',
      detail: `Created ${createdCount} variant${createdCount === 1 ? '' : 's'}.`,
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
    return;
  }

  toast.add({
    severity: TOAST_SEVERITIES.WARNING,
    summary: `Created ${createdCount} of ${pending.length}`,
    detail: `Not created — ${failures.join('; ')}`,
    life: TOAST_LONG_LIFE_DURATION,
  });
}

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
        if (name) markVariantCreated(name);
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
