<template>
  <!-- <PvButton @click="visible = true"> -->
  <PvButton
    class="surface-hover border-1 border-300 border-circle m-0 hover:bg-primary p-0 m-2"
    data-cy="button-edit-variant"
    @click="visible = true"
  >
    <i class="pi pi-pencil text-primary hover:text-white-alpha-90 p-2" style="font-size: 1rem"></i>
  </PvButton>

  <PvDialog
    v-model:visible="visible"
    :draggable="false"
    modal
    header="Edit Conditions for Assignment"
    :close-on-escape="false"
    :style="{ width: '65vw' }"
    :breakpoints="{ '1199px': '85vw', '575px': '95vw' }"
  >
    <div class="flex w-full align-items-center justify-content-around">
      <div class="flex flex-column w-full my-3 gap-2">
        <div>
          <div class="text-sm font-light uppercase text-gray-400">Task Name</div>
          <div class="text-3xl font-bold uppercase">
            {{ assessment.task.id }}
          </div>
        </div>
        <div v-if="assessment.variant?.params?.taskName" class="gap-2">
          <div class="text-sm font-light uppercase text-gray-500">Variant Name</div>
          <div class="text-xl uppercase">
            {{ assessment.variant?.params?.taskName }}
          </div>
        </div>
      </div>
      <div class="flex w-6 justify-content-end">
        <img :src="assessment.task.image" class="w-5" />
      </div>
    </div>
    <div class="flex flex-column w-full my-2 gap-2">
      <div class="card p-fluid bg-gray-100 p-3">
        <div class="text-lg font-normal text-gray-500 uppercase mb-2">Assigned Conditions</div>
        <div
          v-if="assignedConditions.length == 0"
          class="flex flex-column align-items-center justify-content-center py-2 gap-2"
        >
          <div class="text-xl uppercase font-bold">No Conditions Added</div>
          <div class="text-sm uppercase text-gray-700">
            Assignment will be <PvTag severity="warning" class="mx-1">ASSIGNED</PvTag> to all students in the
            administration.
          </div>
        </div>
        <PvDataTable
          v-if="assignedConditions.length > 0"
          v-model:editingRows="assignedEditingRows"
          :value="assignedConditions"
          edit-mode="row"
          data-key="id"
          :pt="{
            table: { style: 'min-width: 50rem' },
            column: {
              bodycell: ({ state }) => ({
                style: state['d_editing'] && 'padding-top: 0.6rem; padding-bottom: 0.6rem',
              }),
            },
          }"
          data-cy="button-assigned-accept"
          @row-edit-save="onAssignedRowEditSave"
        >
          <PvColumn field="field" header="Field" style="width: 20%; min-width: 8rem" body-style="text-align:center">
            <template #editor="{ data, field }">
              <PvDropdown
                v-model="data[field]"
                :options="fieldExamples"
                option-label="label"
                option-value="value"
                editable
                placeholder="Type or choose field"
                data-cy="dropdown-assigned-field"
              >
              </PvDropdown>
            </template>
          </PvColumn>
          <PvColumn field="op" header="Operator" style="width: 5%" body-style="text-align:center">
            <template #editor="{ data, field }">
              <PvDropdown
                v-model="data[field]"
                :options="operators"
                option-label="label"
                option-value="value"
                placeholder="Select Operator"
                data-cy="dropdown-assigned-operator"
              >
                <template #option="slotProps">
                  <PvTag :value="slotProps.option.label" severity="warning" />
                </template>
              </PvDropdown>
            </template>
            <template #body="slotProps">
              <PvTag :value="slotProps.data.op" severity="warning" />
            </template>
          </PvColumn>
          <PvColumn field="value" header="Value" style="width: 10%" body-style="text-align:center">
            <template #editor="{ data, field }">
              <PvInputText v-model="data[field]" data-cy="assigned-value-content" />
            </template>
          </PvColumn>
          <PvColumn :row-editor="true" style="width: 8%; min-width: 8%" body-style="text-align:center"> </PvColumn>
          <PvColumn :row-editor="true" style="width: 5%; max-width: 1rem" body-style="text-align:center">
            <template #body="{ index }">
              <PvButton text icon="pi pi-trash" @click="removeAssignedRow(index)" />
            </template>
          </PvColumn>
        </PvDataTable>
        <div class="flex flex-row-reverse justify-content-between align-items-center">
          <div class="mt-2 flex">
            <PvButton
              label="Add Assigned Condition"
              icon="pi pi-plus"
              class=""
              data-cy="button-assigned-condition"
              @click="addAssignedCondition"
            />
          </div>
        </div>
      </div>
      <div class="mt-2 flex flex-column gap-2">
        <div class="card p-fluid bg-gray-100 p-3">
          <div class="text-lg font-normal text-gray-500 uppercase mb-2">Optional Conditions</div>
          <div
            v-if="optionalConditions.length == 0"
            class="flex flex-column align-items-center justify-content-center py-2 gap-2"
          >
            <div class="text-xl uppercase font-bold">No Conditions Added</div>
            <div v-if="optionalForAllFlag" class="text-sm uppercase text-gray-700">
              Assignment will be <PvTag severity="success" class="mx-1">OPTIONAL</PvTag> for all students in the
              administration.
            </div>
            <div v-else class="text-sm uppercase text-gray-700">
              Assignment will <PvTag severity="danger" class="mx-1">NOT BE OPTIONAL</PvTag> for any students in the
              administration.
            </div>
          </div>
          <PvDataTable
            v-if="optionalConditions.length > 0"
            v-model:editingRows="optionalEditingRows"
            :value="optionalConditions"
            edit-mode="row"
            data-key="id"
            :pt="{
              table: { style: 'min-width: 50rem' },
              column: {
                bodycell: ({ state }) => ({
                  style: state['d_editing'] && 'padding-top: 0.6rem; padding-bottom: 0.6rem',
                }),
              },
            }"
            @row-edit-save="onOptionalRowEditSave"
          >
            <PvColumn field="field" header="Field" style="width: 20%; min-width: 8rem" body-style="text-align:center">
              <template #editor="{ data, field }">
                <PvDropdown
                  v-model="data[field]"
                  :options="fieldExamples"
                  option-label="label"
                  option-value="value"
                  editable
                  placeholder="Type or choose field"
                >
                </PvDropdown>
              </template>
            </PvColumn>
            <PvColumn field="op" header="Operator" style="width: 5%" body-style="text-align:center">
              <template #editor="{ data, field }">
                <PvDropdown
                  v-model="data[field]"
                  :options="operators"
                  option-label="label"
                  option-value="value"
                  placeholder="Select Operator"
                >
                  <template #option="slotProps">
                    <PvTag :value="slotProps.option.label" severity="warning" />
                  </template>
                </PvDropdown>
              </template>
              <template #body="slotProps">
                <PvTag :value="slotProps.data.op" severity="warning" />
              </template>
            </PvColumn>
            <PvColumn field="value" header="Value" style="width: 10%" body-style="text-align:center">
              <template #editor="{ data, field }">
                <PvInputText v-model="data[field]" />
              </template>
            </PvColumn>
            <PvColumn :row-editor="true" style="width: 8%; min-width: 8%" body-style="text-align:center"> </PvColumn>
            <PvColumn :row-editor="true" style="width: 5%; max-width: 1rem" body-style="text-align:center">
              <template #body="{ index }">
                <PvButton icon="pi pi-trash" @click="removeOptionalRow(index)" />
              </template>
            </PvColumn>
          </PvDataTable>
          <div class="flex flex-row justify-content-between align-items-center">
            <div class="flex flex-row justify-content-end align-items-center gap-2 mr-2">
              <div class="uppercase text-md font-bold text-gray-600">Make Assessment Optional For All Students</div>
              <PvInputSwitch
                v-model="optionalForAllFlag"
                data-cy="switch-optional-for-everyone"
                @update:model-value="handleOptionalForAllSwitch"
              />
            </div>
            <div class="mt-2 flex gap-2">
              <PvButton
                label="Add Optional Condition"
                icon="pi pi-plus"
                class=""
                :disabled="optionalForAllFlag === true"
                @click="addOptionalCondition"
              />
            </div>
          </div>
        </div>
      </div>
      <PvDivider />
      <div class="flex flex-column align-items-center gap-1 mx-2">
        <div v-if="optionalAllFlagAndOptionalConditionsPresent" class="text-sm">
          <PvTag icon="pi pi-info-circle" severity="info">
            Making the assessment optional for all will override any optional conditions you have added.
          </PvTag>
        </div>
        <div v-if="errorSubmitText.length > 0" class="text-sm">
          <PvTag icon="pi pi-exclamation-triangle" severity="error">{{ errorSubmitText }}</PvTag>
        </div>
      </div>
      <div class="flex justify-content-center gap-2">
        <PvButton type="button" label="Cancel" text severity="error" @click="handleClose"></PvButton>
        <PvButton type="button" label="Save" data-cy="button-save-conditions" @click="handleSubmit"></PvButton>
      </div>
    </div>
  </PvDialog>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import _isEmpty from 'lodash/isEmpty';

const visible = ref(false);
const props = defineProps({
  assessment: {
    type: Object,
    required: true,
  },
  updateVariant: {
    type: Function,
    required: true,
  },
});

const addOptionalCondition = () => {
  optionalConditions.value.push({ id: assignedConditions.value.length, field: '', op: '', value: '' });
  optionalEditingRows.value = [
    ...optionalEditingRows.value,
    optionalConditions.value[optionalConditions.value.length - 1],
  ];
};

const addAssignedCondition = () => {
  assignedConditions.value.push({ id: assignedConditions.value.length, field: '', op: '', value: '' });
  assignedEditingRows.value = [
    ...assignedEditingRows.value,
    assignedConditions.value[assignedConditions.value.length - 1],
  ];
};

const optionalForAllFlag = ref(false);

const errorSubmitText = ref('');

const handleOptionalForAllSwitch = () => {
  if (optionalForAllFlag.value === true) {
    optionalConditions.value = [];
  }
};

const optionalAllFlagAndOptionalConditionsPresent = computed(() => {
  return optionalForAllFlag.value && computedConditions.value['optional']?.conditions?.length > 0;
});

onMounted(() => {
  if (props.assessment?.conditions) {
    optionalConditions.value = props.assessments?.conditions?.optional?.conditions;
    assignedConditions.value = props.assessments?.conditions?.assigned?.conditions;
  }
});

const handleClose = () => {
  if (assignedEditingRows.value.length > 0) {
    assignedEditingRows.value = [];
  }
  if (optionalEditingRows.value.length > 0) {
    optionalEditingRows.value = [];
  }
  visible.value = false;
};

const handleSubmit = () => {
  let error = false;

  // Check for error where any conditional attribute is empty
  for (const condition of assignedConditions.value) {
    for (const [key, value] of Object.entries(condition)) {
      if (key != 'id' && value == '') {
        errorSubmitText.value = 'Please fill in all empty conditional fields or delete unused rows';
        error = true;
      }
    }
  }
  for (const condition of optionalConditions.value) {
    for (const [key, value] of Object.entries(condition)) {
      if (key != 'id' && value == '') {
        errorSubmitText.value = 'Please fill in all empty conditional fields or delete unused rows';
        error = true;
      }
    }
  }

  // Check for error where rows are still being edited
  if (optionalEditingRows.value.length > 0 && assignedEditingRows.value.length > 0) {
    error = true;
    errorSubmitText.value = 'Please save all rows before submitting.';
  }

  if (!error) {
    errorSubmitText.value = '';
    // If optionalForAllFlag is true, then overwrite optional conditions by setting optional to true
    let conditionsCopy = computedConditions.value;
    if (optionalForAllFlag.value === true) {
      conditionsCopy['optional'] = true;
    }
    // if optionalForAllFlag is false, and there are no optional conditions, then set optional to false
    if (optionalForAllFlag.value === false && !_isEmpty(optionalConditions.value)) {
      conditionsCopy['optional'] = { conditions: optionalConditions.value, op: 'AND' };
    }
    props.updateVariant(props.assessment.id, conditionsCopy);
    visible.value = false;
  }
  return;
};

const removeAssignedRow = (index) => {
  assignedConditions.value.splice(index, 1);
};
const removeOptionalRow = (index) => {
  optionalConditions.value.splice(index, 1);
};

const optionalConditions = ref([]);
const assignedConditions = ref([]);

const computedConditions = computed(() => {
  return {
    ...(!_isEmpty(optionalConditions.value) && {
      optional: { op: 'AND', conditions: optionalConditions.value },
    }),
    ...(!_isEmpty(assignedConditions.value) && {
      assigned: { op: 'AND', conditions: assignedConditions.value },
    }),
  };
});

const assignedEditingRows = ref([]);
const optionalEditingRows = ref([]);

const fieldExamples = ref([
  { label: 'studentData.grade', value: 'studentData.grade' },
  { label: 'studentData.schoolLevel', value: 'studentData.schoolLevel' },
]);

const operators = ref([
  { label: 'Less Than (<)', value: 'LESS_THAN' },
  { label: 'Greater Than (>)', value: 'GREATER_THAN' },
  { label: 'Less Than or Equal (<=)', value: 'LESS_THAN_OR_EQUAL' },
  { label: 'Greater Than or Equal (>=)', value: 'GREATER_THAN_OR_EQUAL' },
  { label: 'Equal (==)', value: 'EQUAL' },
  { label: 'Not Equal (!=)', value: 'NOT_EQUAL' },
]);

const onAssignedRowEditSave = (event) => {
  let { newData, index } = event;
  // Update the specific row in the conditions array
  assignedConditions.value[index] = newData;

  // Remove the index from the editingRows array to stop editing
  assignedEditingRows.value.splice(assignedEditingRows.value.indexOf(index), 1);
};

const onOptionalRowEditSave = (event) => {
  let { newData, index } = event;
  // Update the specific row in the conditions array
  optionalConditions.value[index] = newData;

  // Remove the index from the editingRows array to stop editing
  optionalEditingRows.value.splice(optionalEditingRows.value.indexOf(index), 1);
};
</script>
