<template>
  <PvButton label="Show" @click="visible = true" />
  <PvDialog
    v-model:visible="visible"
    :draggable="false"
    modal
    header="Edit Task Variant"
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
      <div class="flex w-8">
        <img :src="assessment.task.image" class="w-4" />
      </div>
    </div>
    <PvTabView>
      <PvTabPanel header="Edit Assignment Conditions">
        <div class="flex flex-column w-full my-3 gap-2">
          <span class="p-text-secondary block mb-5">Update Conditions for Assignment</span>

          <div class="card p-fluid">
            <PvDataTable
              v-model:editingRows="editingRows"
              :value="conditionals"
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
              <PvColumn field="referenceField" header="referenceField" style="width: 20%">
                <template #editor="{ data, field }">
                  <PvInputText v-model="data[field]" />
                </template>
              </PvColumn>
              <PvColumn field="operator" header="Operator" style="width: 20%">
                <template #editor="{ data, field }">
                  <PvDropdown
                    v-model="data[field]"
                    :options="statuses"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Select an Operator"
                  >
                    <template #option="slotProps">
                      <PvTag :value="slotProps.option.value" :severity="getStatusLabel(slotProps.option.value)" />
                    </template>
                  </PvDropdown>
                </template>
                <template #body="slotProps">
                  <PvTag
                    :value="slotProps.data.inventoryStatus"
                    :severity="getStatusLabel(slotProps.data.inventoryStatus)"
                  />
                </template>
              </PvColumn>
              <PvColumn field="value" header="Value" style="width: 20%">
                <template #body="{ data, field }">
                  {{ formatCurrency(data[field]) }}
                </template>
                <template #editor="{ data, field }">
                  <PvInputNumber v-model="data[field]" mode="currency" currency="USD" locale="en-US" />
                </template>
              </PvColumn>
              <PvColumn :rowEditor="true" style="width: 10%; min-width: 8rem" bodyStyle="text-align:center"></PvColumn>
            </PvDataTable>
            <div>
              <PvButton label="Add Condtion" @click="addCondition" />
            </div>
          </div>

          <!-- <PvDataTable :value="data" editable>
            <PvColumn field="name" header="Name"></PvColumn>
            <PvColumn field="age" header="Age"></PvColumn>
            <PvColumn field="action" header="Action" :editable="false">
              <template #body="rowData">
                <PvButton icon="pi pi-plus" @click="addRow(rowDataIndex)" v-show="rowDataIndex === data.length - 1">
                </PvButton>
                <PvButton icon="pi pi-minus" @click="removeRow(rowDataIndex)" v-show="data.length > 0"></PvButton>
              </template>
            </PvColumn>
          </PvDataTable> -->
        </div>
      </PvTabPanel>
      <PvTabPanel header="View Variant Parameters">
        <div class="flex flex-column w-full my-3 gap-2"></div>
      </PvTabPanel>
    </PvTabView>
  </PvDialog>
</template>

<script setup>
import { ref } from 'vue';

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
});

const data = ref([
  {
    name: 'John',
    age: 30,
  },
  {
    name: 'Mary',
    age: 25,
  },
  {
    name: 'Jane',
    age: 35,
  },
]);

const addCondition = () => {
  conditionals.value.push({ field: '', op: '', age: '' });
  // editingRows.value.push({field : '', op: '', age: '' });
};

const removeRow = (index) => {
  data.value.splice(index, 1);
};


const conditionals = ref([
  {
    referenceField: 'Data',
    op: 'EQUALS',
    value: '5',
  },
  {
    referenceField: 'Data',
    op: 'EQUALS',
    value: '5',
  },
]);
const editingRows = ref([]);
const statuses = ref([
  { label: 'In Stock', value: 'INSTOCK' },
  { label: 'Low Stock', value: 'LOWSTOCK' },
  { label: 'Out of Stock', value: 'OUTOFSTOCK' },
]);

const onRowEditSave = (event) => {
  let { newData, index } = event;

  products.value[index] = newData;
};
const getStatusLabel = (status) => {
  switch (status) {
    case 'INSTOCK':
      return 'success';

    case 'LOWSTOCK':
      return 'warning';

    case 'OUTOFSTOCK':
      return 'danger';

    default:
      return null;
  }
};
</script>
