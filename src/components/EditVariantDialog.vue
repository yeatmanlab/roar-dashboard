<template>
  <!-- <PvButton @click="visible = true"> -->
  <PvButton
    class="surface-hover border-1 border-300 border-circle m-0 hover:bg-primary p-0 m-2"
    @click="visible = true"
  >
    <i class="pi pi-pencil text-primary hover:text-white-alpha-90 p-2" style="font-size: 1rem"></i>
  </PvButton>

  <PvDialog
    v-model:visible="visible"
    :draggable="false"
    modal
    header="Edit Conditions for Assessment"
    :closeOnEscape="false"
    :style="{ width: '65vw' }"
    :breakpoints="{ '1199px': '85vw', '575px': '95vw' }"
  >
    <div class="flex w-full align-items-center justify-content-space-between">
      <div class="flex flex-column w-full my-3 gap-2">
        <div>
          <div class="text-sm font-light uppercase text-gray-400">Task Name</div>
          <div class="text-3xl font-bold uppercase">
            {{ assessment.task.id }}
          </div>
        </div>
        <div v-if="assessment.variant?.params?.taskName" class="gap-2">
          <div class="text-sm font-light uppercase text-gray-400">Variant Name</div>
          <div class="text-xl uppercase">
            {{ assessment.variant?.params?.taskName }}
          </div>
        </div>
      </div>
      <div class="flex w-8 justify-content-end">
        <img :src="assessment.task.image" class="w-8" />
      </div>
    </div>
    <div class="flex flex-column w-full my-3 gap-2">
      <div class="card p-fluid">
        <div class="flex flex-row justify-content-end align-items-center gap-2 mr-2">
          <div class="uppercase text-md font-bold text-gray-600">Make Assessment Optional For All</div>
          <PvInputSwitch v-model="optionalForAllFlag" />
        </div>
        <PvDataTable
          v-if="conditions.length > 0"
          v-model:editingRows="editingRows"
          :value="conditions"
          editMode="row"
          dataKey="id"
          @row-edit-save="onRowEditSave"
          :pt="{
            table: { style: 'min-width: 50rem' },
            column: {
              bodycell: ({ state }) => ({
                style: state['d_editing'] && 'padding-top: 0.6rem; padding-bottom: 0.6rem',
              }),
            },
          }"
        >
          <PvColumn field="field" header="Field" style="width: 20%; min-width: 8rem" bodyStyle="text-align:center">
            <template #editor="{ data, field }">
              <PvDropdown
                v-model="data[field]"
                :options="fieldExamples"
                optionLabel="label"
                optionValue="value"
                editable
                placeholder="Type or choose field"
              >
              </PvDropdown>
            </template>
          </PvColumn>
          <PvColumn field="op" header="Operator" style="width: 5%" bodyStyle="text-align:center">
            <template #editor="{ data, field }">
              <PvDropdown
                v-model="data[field]"
                :options="operators"
                optionLabel="label"
                optionValue="value"
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
          <PvColumn field="value" header="Value" style="width: 10%" bodyStyle="text-align:center">
            <template #editor="{ data, field }">
              <PvInputText v-model="data[field]" />
            </template>
          </PvColumn>
          <PvColumn
            field="conditionalLevel"
            header="Conditional Level"
            style="width: 12%"
            bodyStyle="text-align:center"
          >
            <template #editor="{ data, field }">
              <PvDropdown
                v-model="data[field]"
                :options="conditionalLevels"
                optionLabel="label"
                optionValue="value"
                placeholder="Select Level"
              >
                <template #option="slotProps">
                  <PvTag
                    :value="_toUpper(slotProps.option.label)"
                    :severity="getConditionalLevelStatusLabel(slotProps.option.label)"
                  />
                </template>
              </PvDropdown>
            </template>
            <template #body="slotProps">
              <PvTag
                :value="_toUpper(slotProps.data.conditionalLevel)"
                :severity="getConditionalLevelStatusLabel(slotProps.data.conditionalLevel)"
              />
            </template>
          </PvColumn>
          <PvColumn :rowEditor="true" style="width: 8%; min-width: 8%" bodyStyle="text-align:center"> </PvColumn>
          <PvColumn :rowEditor="true" style="width: 5%; max-width: 1rem" bodyStyle="text-align:center">
            <template #body="{ index }">
              <PvButton icon="pi pi-trash" @click="removeRow(index)" />
            </template>
          </PvColumn>
        </PvDataTable>
        <div class="mt-2 flex gap-2">
          <PvButton label="Add Condition" @click="addCondition" class="" />
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
        <PvButton type="button" label="Save" @click="handleSubmit"></PvButton>
      </div>
    </div>
  </PvDialog>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import _toUpper from 'lodash/toUpper';

const visible = ref(false);
const props = defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
  assessment: {
    type: Object,
    required: true,
  },
  updateVariant: {
    type: Function,
    required: true,
  },
});

const addCondition = () => {
  conditions.value.push({ id: conditions.value.length, field: '', op: '', value: '', conditionalLevel: '' });
  editingRows.value = [...editingRows.value, conditions.value[conditions.value.length - 1]];
};

const optionalForAllFlag = ref(false);
const errorSubmitText = ref('');

const optionalAllFlagAndOptionalConditionsPresent = computed(() => {
  return optionalForAllFlag.value && computedConditions.value['optional']?.conditions?.length > 0;
});

onMounted(() => {
  if (props.assessment?.conditions) {
    conditions.value = props.assessment?.conditions;
  }
});

const handleClose = () => {
  if (editingRows.value.length > 0) {
    editingRows.value = [];
  }
  visible.value = false;
};

const handleSubmit = () => {
  let error = false;

  // Check for error where any conditional attribute is empty
  for (const condition of conditions.value) {
    for (const [key, value] of Object.entries(condition)) {
      if (key != 'id' && value == '') {
        errorSubmitText.value = 'Please fill in all empty conditional fields';
        error = true;
      }
    }
  }

  // Check for error where rows are still being edited
  if (editingRows.value.length > 0) {
    console.log(editingRows.value);
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
    console.log(conditionsCopy);
    props.updateVariant(props.assessment.id, conditionsCopy);
    visible.value = false;
  }
  return;
};

const removeRow = (index) => {
  conditions.value.splice(index, 1);
};

const conditions = ref([]);

const computedConditions = computed(() => {
  let precomputedConditions = conditions.value.reduce((acc, conditional) => {
    if (!acc[conditional.conditionalLevel]) {
      acc[conditional.conditionalLevel] = { op: 'AND', conditions: [] };
      acc[conditional.conditionalLevel].conditions.push({
        op: conditional.op,
        field: conditional.field,
        value: conditional.value,
      });
    } else {
      acc[conditional.conditionalLevel].push({
        op: conditional.op,
        field: conditional.field,
        value: conditional.value,
      });
    }
    return acc;
  }, {});
  return precomputedConditions;
});

const editingRows = ref([]);

const fieldExamples = ref([
  { label: 'studentData.grade', value: 'studentData.grade' },
  { label: 'studentData.schoolLevel', value: 'studentData.schoolLevel' },
]);

const conditionalLevels = ref([
  { label: 'Optional', value: 'optional' },
  { label: 'Required', value: 'required' },
]);
const operators = ref([
  { label: 'Less Than (<)', value: 'LESS_THAN' },
  { label: 'Greater Than (>)', value: 'GREATER_THAN' },
  { label: 'Less Than or Equal (<=)', value: 'LESS_THAN_OR_EQUAL' },
  { label: 'Greater Than or Equal (>=)', value: 'GREATER_THAN_OR_EQUAL' },
  { label: 'Equal (==)', value: 'EQUAL' },
  { label: 'Not Equal (!=)', value: 'NOT_EQUAL' },
]);

const onRowEditSave = (event) => {
  let { newData, index } = event;
  // Update the specific row in the conditions array
  conditions.value[index] = newData;

  // Remove the index from the editingRows array to stop editing
  editingRows.value.splice(editingRows.value.indexOf(index), 1);
};

const getConditionalLevelStatusLabel = (status) => {
  switch (status) {
    case 'optional':
      return 'success';

    case 'required':
      return 'danger';

    default:
      return null;
  }
};
</script>
