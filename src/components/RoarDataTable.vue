<template>
  <div v-if="!computedData">
    <SkeletonTable />
  </div>
  <div v-else>
    <div class="flex flex-row flex-wrap w-full gap-2 pt-4 justify-content-end">
      <span class="p-float-label">
        <MultiSelect id="ms-columns" :modelValue="selectedColumns" :options="inputColumns" optionLabel="header"
          :maxSelectedLabels="3" @update:modelValue="onColumnToggle" class="w-full md:w-20rem"
          selectedItemsLabel="{0} columns selected" />
        <label for="ms-columns">Select Columns</label>
      </span>
      <span class="p-float-label">
        <MultiSelect id="ms-freeze" :modelValue="frozenColumns" :options="inputColumns" optionLabel="header"
          :maxSelectedLabels="3" @update:modelValue="onFreezeToggle" class="w-full md:w-20rem"
          selectedItemsLabel="{0} columns frozen" :showToggleAll="false" />
        <label for="ms-columns">Freeze Columns</label>
      </span>
      <span v-if="allowExport" class="flex flex-row flex-wrap justify-content-end">
        <Button label="Export Selected" :disabled="selectedRows.length === 0" @click="exportCSV(true, $event)" />
        <Button label="Export Whole Table" @click="exportCSV(false, $event)" />
      </span>
    </div>
    <DataTable ref="dataTable" :value="computedData" :rowHover="true" :reorderableColumns="true" :resizableColumns="true"
      :exportFilename="exportFilename" removableSort sortMode="multiple" showGridlines v-model:filters="refFilters"
      filterDisplay="menu" paginator :rows="props.pageLimit" :alwaysShowPaginator="true" paginatorPosition="both"
      :rowsPerPageOptions="[10, 25, 50, 100]" :totalRecords="props.totalRecords" :lazy="props.lazy"
      :loading="props.loading" scrollable @page="onPage($event)" @sort="onSort($event)" v-model:selection="selectedRows"
      :selectAll="selectAll" @select-all-change="onSelectAll" @row-select="onSelectionChange"
      @row-unselect="onSelectionChange">
      <Column selectionMode="multiple" headerStyle="width: 3rem" :reorderableColumn="false" frozen />
      <Column v-for="(col, index) of computedColumns" :key="col.field + '_' + index" :header="col.header"
        :field="col.field" :dataType="col.dataType" :sortable="(col.sort !== false)"
        :showFilterMatchModes="!col.useMultiSelect" :showFilterOperator="col.allowMultipleFilters === true"
        :showAddButton="col.allowMultipleFilters === true" :frozen="col.pinned" alignFrozen="left">
        <template #body="{ data }">
          <div v-if="col.tag && _get(data, col.field) !== undefined">
            <Tag v-if="!col.tagOutlined" :severity="_get(data, col.severityField)" :value="_get(data, col.field)"
              :icon="_get(data, col.iconField)" :style="`background-color: ${_get(data, col.tagColor)}; min-width: 2rem;`"
              rounded />
            <div v-else-if="col.tagOutlined && _get(data, col.tagColor)" class="circle" style="border: 1px solid black" />
          </div>
          <div v-else-if="col.chip && col.dataType === 'array' && _get(data, col.field) !== undefined">
            <Chip v-for="chip in _get(data, col.field)" :key="chip" :label="chip" />
          </div>
          <div v-else-if="col.emptyTag">
            <div class="circle" v-if="!col.tagOutlined"
                 :style="`background-color: ${_get(data, col.tagColor)};
                          color: ${_get(data, col.tagColor) === 'white' ? 'black' : 'white'}`" />
            <div v-else-if="col.tagOutlined && _get(data, col.tagColor)" class="circle" style="border: 1px solid black" />
          </div>
          <div v-else-if="col.dataType === 'date'">
            {{ getFormattedDate(_get(data, col.field)) }}
          </div>
          <div v-else>
            {{ _get(data, col.field) }}
          </div>
        </template>
        <template v-if="col.dataType" #filter="{ filterModel }">
          <InputText v-if="col.dataType === 'text' && !col.useMultiSelect" type="text" v-model="filterModel.value"
            class="p-column-filter" placeholder="Search" />
          <MultiSelect v-if="col.useMultiSelect" v-model="filterModel.value" :options="_get(refOptions, col.field)"
            placeholder="Any" :showToggleAll="false" class="p-column-filter" />
          <Calendar v-if="col.dataType === 'date' && !col.useMultiSelect" v-model="filterModel.value"
            dateFormat="mm/dd/yy" placeholder="mm/dd/yyyy" />
          <div v-if="col.dataType === 'boolean' && !col.useMultiSelect" class="flex flex-row gap-2">
            <TriStateCheckbox inputId="booleanFilter" v-model="filterModel.value" style="padding-top: 2px;" />
            <label for="booleanFilter">{{ col.header + '?' }}</label>
          </div>
        </template>
      </Column>
      <template #empty> No data found. </template>
    </DataTable>
  </div>
</template>
<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { FilterMatchMode, FilterOperator } from "primevue/api";
import SkeletonTable from "@/components/SkeletonTable.vue"
import _get from 'lodash/get'
import _set from 'lodash/set'
import _map from 'lodash/map'
import _forEach from 'lodash/forEach'
import _find from 'lodash/find'
import _filter from 'lodash/filter'
import _toUpper from 'lodash/toUpper'
import _startCase from 'lodash/startCase'
import _flatMap from 'lodash/flatMap'

/*
Using the DataTable
Required Props: columns, data
Optional Props: allowExport (default: true), exportFilename (default: 'datatable-export')

Columns:
Array of objects consisting of a field and header at minimum.
- Field must match the key of the entry in the data object.
- Header is an optional string that is displayed at the top of 
      the column.
- dataType is a string that defines the data type of the column.
      options are TEXT, NUMERIC, or DATE
- Sort (optional) is a boolean field that determines whether sorting
      is to be allowed on the field. If it is not present, defaults to true.
- allowMultipleFilters (optional) is a boolean field that determines whether
      users have the option of apply multiple filters.
- useMultiSelect is an optional boolean field that determines whether the
      filter will be a multi-select dropdown. options are generated by the 
      given data.
- Pinned (optional) is a boolean field allowing the column to persist when 
      scrolled left-to-right. It is suggested that this only be used on
      the leftmost column. 
*/

const props = defineProps({
  columns: { type: Array, required: true },
  data: { type: Array, required: true },
  allowExport: { type: Boolean, default: true },
  exportFilename: { type: String, default: 'datatable-export' },
  pageLimit: { type: Number, default: 15 },
  totalRecords: { type: Number, required: false },
  loading: { type: Boolean, default: false },
  lazy: { type: Boolean, default: false },
});

const inputColumns = ref(props.columns);
const selectedColumns = ref(props.columns);
// Filter the live data (props.columns) with the selections of selectedColumns
const computedColumns = computed(() => {
  return _map(selectedColumns.value, col => {
    return _find(props.columns, pcol => pcol.header === col.header)
  })
})
const selectedRows = ref([]);
const toast = useToast();
const selectAll = ref(false);
const onSelectAll = () => {
  selectAll.value = !selectAll.value;
  if (selectAll.value) {
    selectedRows.value = computedData.value;
    toast.add({
      severity: 'info',
      summary: 'Rows selected',
      detail:
        `You selected ${selectedRows.value.length} rows but there are
        ${props.totalRecords} total rows in all of this table's pages. If you
        would like to export all rows, please click the "Export Whole Table"
        button.`,
      life: 5000
    });
  } else {
    selectedRows.value = [];
  }
  emit("selection", selectedRows.value);
}
const onSelectionChange = (event) => {
  emit("selection", selectedRows.value);
}

const dataTable = ref();

const exportCSV = (exportSelected) => {
  if (exportSelected) {
    emit('export-selected', selectedRows.value)
    return;
  }
  emit('export-all');
};

// Generate filters and options objects
const valid_dataTypes = ['NUMERIC', 'NUMBER', 'TEXT', 'STRING', 'DATE', 'BOOLEAN'];
let filters = {};
let options = {};
_forEach(props.columns, column => {
  // Check if header text is supplied; if not, generate.
  if (!_get(column, 'header')) {
    column['header'] = _startCase(_get(column, 'field'))
  }
  const dataType = _toUpper(_get(column, 'dataType'));
  let returnMatchMode = null;
  if (valid_dataTypes.includes(dataType)) {
    if (dataType === 'NUMERIC' || dataType === 'NUMBER' || dataType === 'BOOLEAN') {
      returnMatchMode = { value: null, matchMode: FilterMatchMode.EQUALS };
    } else if (dataType === 'TEXT' || dataType === 'STRING') {
      returnMatchMode = { value: null, matchMode: FilterMatchMode.STARTS_WITH };
    } else if (dataType === 'DATE') {
      returnMatchMode = { value: null, matchMode: FilterMatchMode.DATE_IS };
    }

    if (_get(column, 'useMultiSelect')) {
      returnMatchMode = { value: null, matchMode: FilterMatchMode.IN };
      options[column.field] = getUniqueOptions(column);
    }
  }
  if (returnMatchMode) {
    filters[column.field] = {
      operator: FilterOperator.AND,
      constraints: [returnMatchMode]
    }
  }
})
const refOptions = ref(options);
const refFilters = ref(filters);

// Grab list of fields defined as dates
let dateFields = _filter(props.columns, col => _toUpper(col.dataType) === 'DATE');
dateFields = _map(dateFields, col => col.field);

const computedData = computed(() => {
  const data = JSON.parse(JSON.stringify(props.data));
  _forEach(data, (entry) => {
    // Clean up date fields to use Date objects
    _forEach(dateFields, field => {
      let dateEntry = _get(entry, field);
      if (dateEntry !== null) {
        const dateObj = new Date(dateEntry);
        _set(entry, field, dateObj);
      }
    })
  });
  return data;
});

// Generate list of options given a column
function getUniqueOptions(column) {
  const field = _get(column, 'field');
  let options = [];
  _forEach(props.data, entry => {
    if (!options.includes(_get(entry, field))) {
      options.push(_get(entry, field));
    }
  });
  return options
}

function getFormattedDate(date) {
  if (date && !isNaN(date)) {
    return date.toLocaleDateString('en-us', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })
  } else return ''
}

const onColumnToggle = (selected) => {
  selectedColumns.value = inputColumns.value.filter((col) => selected.includes(col));
};

const frozenColumns = ref(inputColumns.value.filter((col) => col.pinned));
const onFreezeToggle = (selected) => {
  frozenColumns.value = inputColumns.value.filter((col) => selected.includes(col));
  selectedColumns.value = selectedColumns.value.map((col) => {
    col.pinned = selected.includes(col);
    return col
  })
};

const emit = defineEmits(['page', 'sort', 'export-all', 'selection']);
const onPage = (event) => { emit('page', event) };
const onSort = (event) => { emit('sort', event) };
</script>
<style>
.circle {
  border-color: white;
  display: inline-block;
  border-radius: 50%;
  border-width: 5px;
  height: 25px;
  width: 25px;
  vertical-align: middle;
  margin-right: 10px;
}

.circle.empty {
  border: 2px solid black;
  background-color: red;
}
</style>