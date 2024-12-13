<template>
  <fieldset class="flex gap-2 align-content-start flex-grow-0 params-container" data-testId="task-parameters-row">
    <div class="relative w-1/4 min-w-32">
      <TextInput
        v-model="v$.row.name.$model"
        label="Parameter Name"
        placeholder="Name"
        label-hidden
        :required="true"
        :disabled="editMode && !row.isNew"
        :is-invalid="v$.row.name.$invalid && v$.row.name.$dirty"
        :errors="v$.row.name.$errors"
        test-id="task-parameters-row__name"
      />
    </div>

    <div class="w-32">
      <Dropdown
        v-model="v$.row.type.$model"
        :data="typeOptions"
        label="Parameter Type"
        label-hidden
        placeholder="Select"
        :required="true"
        :disabled="editMode && !row.isNew"
        test-id="task-parameters-row__type"
      />
    </div>

    <div class="flex-1">
      <TextInput
        v-if="row.type === TASK_PARAMETER_TYPES.STRING"
        v-model="v$.row.value.$model"
        label="Parameter Value"
        label-hidden
        placeholder="Value"
        :required="true"
        :is-invalid="v$.row.value.$invalid && v$.row.value.$dirty"
        :errors="v$.row.value.$errors"
        test-id="task-parameters-row__value-string"
      />

      <Dropdown
        v-else-if="row.type === TASK_PARAMETER_TYPES.BOOLEAN"
        v-model="v$.row.value.$model"
        :data="booleanDropdownOptions"
        label-key="label"
        value-key="value"
        label="Parameter Type"
        label-hidden
        placeholder="Select"
        :required="true"
        :is-invalid="v$.row.value.$invalid && v$.row.value.$dirty"
        :errors="v$.row.value.$errors"
        test-id="task-parameters-row__value-bool"
      />

      <NumberInput
        v-if="row.type === TASK_PARAMETER_TYPES.NUMBER"
        v-model="v$.row.value.$model"
        label="Parameter Value"
        label-hidden
        placeholder="0"
        :required="true"
        :is-invalid="v$.row.value.$invalid && v$.row.value.$dirty"
        :errors="v$.row.value.$errors"
        test-id="task-parameters-row__value-number"
      />
    </div>

    <PvButton
      icon="pi pi-trash"
      text
      class="delete-btn bg-primary text-white border-none border-round p-2 px-3 hover:bg-red-900 flex-shrink-0"
      :pt="{ root: { 'data-testid': 'task-parameters-row__delete-button' } }"
      @click="$emit('removeRow', rowIndex)"
    />
  </fieldset>
</template>

<script setup>
import { computed } from 'vue';
import { required } from '@vuelidate/validators';
import useVuelidate from '@vuelidate/core';
import PvButton from 'primevue/button';
import { hasNoDuplicates, notInBlacklist } from '@/helpers/formValidators';
import TextInput from '@/components/Form/TextInput';
import NumberInput from '@/components/Form/NumberInput';
import Dropdown from '@/components/Form/Dropdown';
import { TASK_PARAMETER_TYPES } from '@/constants/tasks';

const typeOptions = Object.values(TASK_PARAMETER_TYPES);
const booleanDropdownOptions = [
  { label: 'true', value: true },
  { label: 'false', value: false },
];

defineEmits(['removeRow']);

const model = defineModel({
  required: true,
  type: Object,
});

const props = defineProps({
  rowIndex: {
    type: Number,
    required: true,
  },
  editMode: {
    type: Boolean,
    default: false,
  },
  validationKeyBlacklist: {
    type: Array,
    default: () => [],
  },
});

const row = computed(() => model.value[props.rowIndex]);

const rules = {
  row: {
    name: {
      required,
      noDuplicates: hasNoDuplicates(model.value, 'name', 'Parameter names should be unique'),
      notInBlacklist: notInBlacklist(props.validationKeyBlacklist, 'Parameter name is reserved'),
    },
    type: { required },
    value: { required },
  },
};

const v$ = useVuelidate(rules, { row });
</script>
