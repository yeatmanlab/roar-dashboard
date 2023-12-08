<template>
  <div v-if="!computedData">
    <SkeletonTable />
  </div>
  <div v-else>
    <div class="flex flex-row flex-wrap w-full gap-2 pt-4 justify-content-end">
      <span class="p-float-label">
        <PvMultiSelect
          id="ms-columns"
          v-tooltip.top="'Show and hide columns'"
          :model-value="selectedColumns"
          :options="inputColumns"
          option-label="header"
          :max-selected-labels="3"
          class="w-full md:w-20rem"
          selected-items-label="{0} columns selected"
          @update:model-value="onColumnToggle"
        />
        <label for="ms-columns">Select Columns</label>
      </span>
      <span class="p-float-label">
        <PvMultiSelect
          id="ms-freeze"
          :model-value="frozenColumns"
          :options="inputColumns"
          option-label="header"
          :max-selected-labels="3"
          class="w-full md:w-20rem"
          selected-items-label="{0} columns frozen"
          :show-toggle-all="false"
          @update:model-value="onFreezeToggle"
        />
        <label for="ms-columns">Freeze Columns</label>
      </span>
      <span v-if="allowExport" class="flex flex-row flex-wrap justify-content-end">
        <PvButton
          v-tooltip.bottom="'Export all scores for selected students to CSV file for spreadsheet import'"
          label="Export Selected"
          :disabled="selectedRows.length === 0"
          @click="exportCSV(true, $event)"
        />
        <PvButton
          v-tooltip.bottom="'Export all scores for all students to a CSV file for spreadsheet import.'"
          label="Export Whole Table"
          @click="exportCSV(false, $event)"
        />
      </span>
    </div>
    <PvDataTable
      ref="dataTable"
      v-model:filters="refFilters"
      v-model:selection="selectedRows"
      :value="computedData"
      :row-hover="true"
      :reorderable-columns="true"
      :resizable-columns="true"
      :export-filename="exportFilename"
      removable-sort
      sort-mode="multiple"
      show-gridlines
      filter-display="menu"
      paginator
      :rows="props.pageLimit"
      :always-show-paginator="true"
      paginator-position="both"
      :rows-per-page-options="[10, 25, 50, 100]"
      :total-records="props.totalRecords"
      :lazy="props.lazy"
      :loading="props.loading"
      scrollable
      :select-all="selectAll"
      @page="onPage($event)"
      @sort="onSort($event)"
      @filter="onFilter($event)"
      @select-all-change="onSelectAll"
      @row-select="onSelectionChange"
      @row-unselect="onSelectionChange"
    >
      <PvColumn selection-mode="multiple" header-style="width: 3rem" :reorderable-column="false" frozen />
      <PvColumn
        v-for="(col, index) of computedColumns"
        :key="col.field + '_' + index"
        :field="col.field"
        :data-type="col.dataType"
        :sortable="col.sort !== false"
        :show-filter-match-modes="!col.useMultiSelect && col.dataType !== 'score'"
        :show-filter-operator="col.allowMultipleFilters === true"
        :show-add-button="col.allowMultipleFilters === true"
        :frozen="col.pinned"
        align-frozen="left"
      >
        <template #header>
          <div
            v-tooltip.top="`${toolTipByHeader(col.header)}`"
            :style="[
              toolTipByHeader(col.header).length > 0
                ? 'text-decoration: underline dotted #0000CD; text-underline-offset: 3px'
                : null,
            ]"
          >
            {{ col.header }}
          </div>
        </template>
        <template #body="{ data: colData }">
          <div
            v-if="col.tag && _get(colData, col.field) !== undefined"
            v-tooltip.right="`${returnScoreTooltip(col.header, colData)}`"
          >
            <PvTag
              v-if="!col.tagOutlined"
              :severity="_get(colData, col.severityField)"
              :value="_get(colData, col.field)"
              :icon="_get(colData, col.iconField)"
              :style="`background-color: ${_get(colData, col.tagColor)}; min-width: 2rem; ${
                returnScoreTooltip(col.header, colData).length > 0 && 'outline: 1px dotted #0000CD; outline-offset: 3px'
              }`"
              rounded
            />
            <div
              v-else-if="col.tagOutlined && _get(colData, col.tagColor)"
              class="circle"
              style="border: 1px solid black"
            />
          </div>
          <div v-else-if="col.chip && col.dataType === 'array' && _get(colData, col.field) !== undefined">
            <PvChip v-for="chip in _get(colData, col.field)" :key="chip" :label="chip" />
          </div>
          <div v-else-if="col.emptyTag" v-tooltip.right="`${returnScoreTooltip(col.header, colData)}`">
            <div
              v-if="!col.tagOutlined"
              class="circle"
              :style="`background-color: ${_get(colData, col.tagColor)}; color: ${
                _get(colData, col.tagColor) === 'white' ? 'black' : 'white'
              }; ${
                returnScoreTooltip(col.header, colData).length > 0 && 'outline: 1px dotted #0000CD; outline-offset: 3px'
              }`"
            />

            <div
              v-else-if="col.tagOutlined && _get(colData, col.tagColor)"
              class="circle"
              :style="`border: 1px solid black; ${
                returnScoreTooltip(col.header, colData).length > 0 && 'outline: 1px dotted #0000CD; outline-offset: 3px'
              }`"
            />
          </div>
          <div v-else-if="col.link">
            <router-link :to="{ name: col.routeName, params: colData.routeParams }">
              <PvButton
                v-tooltip.top="col.routeTooltip"
                severity="secondary"
                text
                raised
                :label="col.routeLabel"
                :aria-label="col.routeTooltip"
                :icon="col.routeIcon"
                size="small"
              />
            </router-link>
          </div>
          <div v-else-if="col.dataType === 'date'">
            {{ getFormattedDate(_get(colData, col.field)) }}
          </div>
          <div v-else>
            {{ _get(colData, col.field) }}
          </div>
        </template>
        <template v-if="col.dataType" #filter="{ filterModel }">
          <PvInputText
            v-if="col.dataType === 'text' && !col.useMultiSelect"
            v-model="filterModel.value"
            type="text"
            class="p-column-filter"
            placeholder="Search"
          />
          <PvMultiSelect
            v-if="col.useMultiSelect"
            v-model="filterModel.value"
            :options="_get(refOptions, col.field)"
            placeholder="Any"
            :show-toggle-all="false"
            class="p-column-filter"
          />
          <PvCalendar
            v-if="col.dataType === 'date' && !col.useMultiSelect"
            v-model="filterModel.value"
            date-format="mm/dd/yy"
            placeholder="mm/dd/yyyy"
          />
          <div v-if="col.dataType === 'boolean' && !col.useMultiSelect" class="flex flex-row gap-2">
            <PvTriStateCheckbox v-model="filterModel.value" input-id="booleanFilter" style="padding-top: 2px" />
            <label for="booleanFilter">{{ col.header + '?' }}</label>
          </div>
          <div v-if="col.dataType === 'score' && !col.useMultiSelect">
            The Scores Filter
            <PvDropdown v-model="filterModel.value" :options="['Above', 'Average', 'Needs Extra']" />
            <label for="isSixthCheckbox">Below 6th Grade</label>
            <PvCheckbox id="isSixthCheckbox" v-model="filterModel.isBelowSixth" binary />
          </div>
        </template>
      </PvColumn>
      <template #empty> No data found. </template>
    </PvDataTable>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { FilterMatchMode, FilterOperator } from 'primevue/api';
import SkeletonTable from '@/components/SkeletonTable.vue';
import _get from 'lodash/get';
import _set from 'lodash/set';
import _map from 'lodash/map';
import _forEach from 'lodash/forEach';
import _find from 'lodash/find';
import _filter from 'lodash/filter';
import _toUpper from 'lodash/toUpper';
import _startCase from 'lodash/startCase';

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
  totalRecords: { type: Number, required: false, default: 0 },
  loading: { type: Boolean, default: false },
  lazy: { type: Boolean, default: false },
});

const inputColumns = ref(props.columns);
const selectedColumns = ref(props.columns);
// Filter the live data (props.columns) with the selections of selectedColumns
const computedColumns = computed(() => {
  return _map(selectedColumns.value, (col) => {
    return _find(props.columns, (pcol) => pcol.header === col.header);
  });
});
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
      detail: `You selected ${selectedRows.value.length} rows but there are
        ${props.totalRecords} total rows in all of this table's pages. If you
        would like to export all rows, please click the "Export Whole Table"
        button.`,
      life: 5000,
    });
  } else {
    selectedRows.value = [];
  }
  emit('selection', selectedRows.value);
};

const onSelectionChange = () => {
  emit('selection', selectedRows.value);
};

const dataTable = ref();

const exportCSV = (exportSelected) => {
  if (exportSelected) {
    emit('export-selected', selectedRows.value);
    return;
  }
  emit('export-all');
};

// Generate filters and options objects
const valid_dataTypes = ['NUMERIC', 'NUMBER', 'TEXT', 'STRING', 'DATE', 'BOOLEAN', 'SCORE'];
let filters = {};
let options = {};
_forEach(computedColumns.value, (column) => {
  // Check if header text is supplied; if not, generate.
  if (!_get(column, 'header')) {
    column['header'] = _startCase(_get(column, 'field'));
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
    } else if (dataType === 'SCORE') {
      console.log('score filter');
      returnMatchMode = { value: null, matchMode: FilterMatchMode.STARTS_WITH, isBelowSixth: false };
    }

    if (_get(column, 'useMultiSelect')) {
      returnMatchMode = { value: null, matchMode: FilterMatchMode.IN };
      options[column.field] = getUniqueOptions(column);
    }
  }
  if (returnMatchMode) {
    filters[column.field] = {
      operator: FilterOperator.AND,
      constraints: [returnMatchMode],
    };
  }
});
const refOptions = ref(options);
const refFilters = ref(filters);

// Grab list of fields defined as dates
let dateFields = _filter(props.columns, (col) => _toUpper(col.dataType) === 'DATE');
dateFields = _map(dateFields, (col) => col.field);

let toolTipByHeader = (header) => {
  if (header === 'Word') {
    return 'Assesses decoding skills at the word level. \n\n  Percentile ranges from 0-99 \n Raw Score ranges from 100-900';
  } else if (header === 'Letter') {
    return 'Assesses decoding skills at the word level. \n\n Percentile ranges from 0-99 \n Raw Score ranges from 0-90';
  } else if (header === 'Phoneme') {
    return 'Assesses phonological awareness: sound matching and elision. \n\n Percentile ranges from 0-99 \n Raw Score ranges from 0-57';
  } else if (header === 'Sentence') {
    return 'Assesses reading fluency at the sentence level. \n\n Percentile ranges from 0-99 \n Raw Score ranges from 0-130 ';
  } else if (header === 'Palabra') {
    return 'Assesses decoding skills at the word level in Spanish. This test is still in the research phase. \n\n  Percentile ranges from 0-99 \n Raw Score ranges from 100-900';
  }
  return '';
};

let returnScoreTooltip = (colHeader, colData) => {
  let toolTip = '';

  if (colHeader === 'Phoneme' && colData.scores?.pa?.standard) {
    toolTip += colData.scores.pa?.support_level + '\n' + '\n';
    toolTip += 'Percentile: ' + colData.scores?.pa?.percentile + '\n';
    toolTip += 'Raw Score: ' + colData.scores?.pa?.raw + '\n';
    toolTip += 'Standardized Score: ' + colData.scores?.pa?.standard + '\n';
  } else if (colHeader === 'Word' && colData.scores?.swr?.standard) {
    toolTip += colData.scores?.swr?.support_level + '\n' + '\n';
    toolTip += 'Percentile: ' + colData.scores?.swr?.percentile + '\n';
    toolTip += 'Raw Score: ' + colData.scores?.swr?.raw + '\n';
    toolTip += 'Standardized Score: ' + colData.scores?.swr?.standard + '\n';
  } else if (colHeader === 'Sentence' && colData.scores?.sre.standard) {
    toolTip += colData.scores?.sre?.support_level + '\n' + '\n';
    toolTip += 'Percentile: ' + colData.scores?.sre?.percentile + '\n';
    toolTip += 'Raw Score: ' + colData.scores?.sre?.raw + '\n';
    toolTip += 'Standardized Score: ' + colData.scores?.sre?.standard + '\n';
  } else if (colHeader === 'Letter' && colData.scores?.letter) {
    toolTip += 'Raw Score: ' + colData.scores?.letter?.raw + '\n';
  } else if (colHeader === 'Palabra' && colData.scores?.['swr-es']?.standard) {
    toolTip += colData.scores?.['swr-es'].support_level + '\n' + '\n';
    toolTip += 'Percentile: ' + colData.scores?.['swr-es']?.percentile + '\n';
    toolTip += 'Raw Score: ' + colData.scores?.['swr-es']?.raw + '\n';
    toolTip += 'Standardized Score: ' + colData.scores?.['swr-es']?.standard + '\n';
  }

  return toolTip;
};

const computedData = computed(() => {
  const data = JSON.parse(JSON.stringify(props.data));
  _forEach(data, (entry) => {
    // Clean up date fields to use Date objects
    _forEach(dateFields, (field) => {
      let dateEntry = _get(entry, field);
      if (dateEntry !== null) {
        const dateObj = new Date(dateEntry);
        _set(entry, field, dateObj);
      }
    });
  });
  return data;
});

// Generate list of options given a column
function getUniqueOptions(column) {
  const field = _get(column, 'field');
  let options = [];
  _forEach(props.data, (entry) => {
    if (!options.includes(_get(entry, field))) {
      options.push(_get(entry, field));
    }
  });
  return options;
}

function getFormattedDate(date) {
  if (date && !isNaN(date)) {
    return date.toLocaleDateString('en-us', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
  } else return '';
}

const onColumnToggle = (selected) => {
  selectedColumns.value = inputColumns.value.filter((col) => selected.includes(col));
};

const frozenColumns = ref(inputColumns.value.filter((col) => col.pinned));
const onFreezeToggle = (selected) => {
  frozenColumns.value = inputColumns.value.filter((col) => selected.includes(col));
  selectedColumns.value = selectedColumns.value.map((col) => {
    col.pinned = selected.includes(col);
    return col;
  });
};

const emit = defineEmits(['page', 'sort', 'export-all', 'selection', 'filter']);
const onPage = (event) => {
  emit('page', event);
};
const onSort = (event) => {
  emit('sort', event);
};
const onFilter = (event) => {
  emit('filter', event);
};
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
</style>
