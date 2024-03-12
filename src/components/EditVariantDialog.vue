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
    header="Edit Conditions for Assignment"
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
              <!-- <PvInputText v-model="data[field]" /> -->
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
                  <PvTag :value="slotProps.option.label" severity="info" />
                </template>
              </PvDropdown>
            </template>
            <template #body="slotProps">
              <PvTag :value="slotProps.data.op" severity="info" />
            </template>
          </PvColumn>
          <PvColumn field="value" header="Value" style="width: 10%" bodyStyle="text-align:center">
            <template #editor="{ data, field }">
              <PvInputNumber v-model="data[field]" />
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
        <div class="mt-2">
          <PvButton label="Add Condition" @click="addCondition" />
        </div>
      </div>
      <PvDivider />
      <div class="flex justify-content-center gap-2">
        <PvButton type="button" label="Cancel" severity="secondary" @click="visible = false"></PvButton>
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

onMounted(() => {
  console.log('mounted');
  if (props.assessment?.conditions) {
    conditions.value = props.assessment?.conditions;
  }
  // TODO: set conditions to prestored
});

const handleSubmit = () => {
  console.log('submit called');
  props.updateVariant(props.assessment.id, computedConditions.value);
  visible.value = false;
};

const removeRow = (index) => {
  conditions.value.splice(index, 1);
};

const conditions = ref([
  {
    id: 0,
    field: 'studentData.grade',
    op: 'GREATER_THAN',
    value: 5,
    conditionalLevel: 'required',
  },
  {
    id: 1,
    field: 'studentData.grade',
    op: 'LESS_THAN',
    value: 12,
    conditionalLevel: 'required',
  },
  {
    id: 2,
    field: 'studentData.grade',
    op: 'LESS_THAN',
    value: 5,
    conditionalLevel: 'optional',
  },
  {
    id: 3,
    field: 'studentData.grade',
    op: 'GREATER_THAN_OR_EQUAL',
    value: 1,
    conditionalLevel: 'optional',
  },
]);

const computedConditions = computed(() => {
  return conditions.value.reduce((acc, conditional) => {
    if (!acc[conditional.conditionalLevel]) {
      acc[conditional.conditionalLevel] = [];
      acc[conditional.conditionalLevel].push({
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
  console.log(status);
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
