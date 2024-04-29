<template>
  <div v-if="!computedData">
    <SkeletonTable />
  </div>
  <div v-else>
    <div class="w-full gap-2 pt-4 flex justify-content-center flex-wrap mt-3">
      <slot name="filterbar"></slot>
      <span class="p-float-label">
        <PvMultiSelect
          id="ms-columns"
          v-tooltip.top="'Show and hide columns'"
          :model-value="selectedColumns"
          :options="inputColumns"
          option-label="header"
          :max-selected-labels="3"
          class="w-2 md:w-20rem"
          selected-items-label="{0} columns selected"
          @update:model-value="onColumnToggle"
        />
        <label for="ms-columns" class="view-label2">Select Columns</label>
      </span>
      <span class="p-float-label">
        <PvMultiSelect
          id="ms-freeze"
          :model-value="frozenColumns"
          :options="inputColumns"
          option-label="header"
          :max-selected-labels="3"
          class="w-2 md:w-20rem"
          selected-items-label="{0} columns frozen"
          :show-toggle-all="false"
          @update:model-value="onFreezeToggle"
        />
        <label for="ms-columns" class="view-label2">Freeze Columns</label>
      </span>
      <span class="flex flex-row flex-wrap justify-content-end gap-2">
        <PvButton
          v-if="allowExport"
          v-tooltip.bottom="'Export all scores for selected students to CSV file for spreadsheet import'"
          label="Export Selected"
          :disabled="selectedRows.length === 0"
          @click="exportCSV(true, $event)"
        />
        <PvButton
          v-if="allowExport"
          v-tooltip.bottom="'Export all scores for all students to a CSV file for spreadsheet import.'"
          label="Export Whole Table"
          @click="exportCSV(false, $event)"
        />
        <PvButton :label="nameForVisualize" @click="toggleView" />
      </span>
    </div>
    <div class="flex flex-column">
      <span style="height: 10px">
        <div class="relative flex justify-content-end mt-0 mr-2 z-1" style="top: 25px; width: 20%; left: 80%">
          <slot />
        </div>
      </span>
      <span>
        <PvDataTable
          ref="dataTable"
          v-model:filters="refFilters"
          v-model:selection="selectedRows"
          class="scrollable-container"
          :class="{ compressed: compressedRows }"
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
          :multi-sort-meta="lazyPreSorting"
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
            :show-filter-match-modes="!col.useMultiSelect && col.dataType !== 'score' && col.dataType !== 'progress'"
            :show-filter-operator="col.allowMultipleFilters === true"
            :filter-field="col.dataType === 'score' ? `scores.${col.field?.split('.')[1]}.percentile` : col.field"
            :show-add-button="col.allowMultipleFilters === true"
            :frozen="col.pinned"
            align-frozen="left"
            :class="{ 'filter-button-override': hideFilterButtons }"
            :filter-menu-style="enableFilter(col) ? '' : 'display: none;'"
            header-style="background:var(--primary-color); color:white; padding-top:0; margin-top:0; padding-bottom:0; margin-bottom:0; border:0; margin-left:0"
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
                v-if="col.tag && (_get(colData, col.field) !== undefined || _get(colData, 'optional'))"
                v-tooltip.right="`${returnScoreTooltip(col.header, colData, col.field)}`"
              >
                <PvTag
                  v-if="!col.tagOutlined"
                  :severity="_get(colData, col.severityField)"
                  :value="_get(colData, col.field)"
                  :icon="_get(colData, col.iconField)"
                  :style="`background-color: ${_get(colData, col.tagColor)}; min-width: 2rem; ${
                    returnScoreTooltip(col.header, colData, col.field).length > 0 &&
                    'outline: 1px dotted #0000CD; outline-offset: 3px'
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
              <div v-else-if="col.emptyTag" v-tooltip.right="`${returnScoreTooltip(col.header, colData, col.field)}`">
                <div
                  v-if="!col.tagOutlined"
                  class="circle"
                  :style="`background-color: ${_get(colData, col.tagColor)}; color: ${
                    _get(colData, col.tagColor) === 'white' ? 'black' : 'white'
                  }; ${
                    returnScoreTooltip(col.header, colData, col.field).length > 0 &&
                    'outline: 1px dotted #0000CD; outline-offset: 3px'
                  }`"
                />

                <div
                  v-else-if="col.tagOutlined && _get(colData, col.tagColor)"
                  class="circle"
                  :style="`border: 1px solid black; background-color: ${_get(colData, col.tagColor)}; color: ${
                    _get(colData, col.tagColor) === 'white' ? 'black' : 'white'
                  }; outline: 1px dotted #0000CD; outline-offset: 3px`"
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
            <template v-if="col.dataType" #sorticon="{ sorted, sortOrder }">
              <i v-if="!sorted && currentSort.length === 0 && !scoreFilterApplied" class="pi pi-sort-alt ml-2" />
              <i v-if="sorted && sortOrder === 1 && !scoreFilterApplied" class="pi pi-sort-amount-down-alt ml-2" />
              <i v-else-if="sorted && sortOrder === -1 && !scoreFilterApplied" class="pi pi-sort-amount-up-alt ml-2" />
            </template>
            <template v-if="col.dataType" #filtericon>
              <i v-if="enableFilter(col)" class="pi pi-filter" />
            </template>
            <template v-if="col.dataType" #filter="{ filterModel }">
              <div v-if="col.dataType === 'text' && !col.useMultiSelect" class="filter-content">
                <PvInputText v-model="filterModel.value" type="text" class="p-column-filter" placeholder="Filter" />
                <small>Filter is case sensitive.</small>
              </div>
              <PvInputNumber
                v-if="col.dataType === 'number' && !col.useMultiSelect"
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
              <div v-if="col.dataType === 'score'">
                <PvDropdown
                  v-model="filterModel.value"
                  :options="['Green', 'Yellow', 'Pink']"
                  style="margin-bottom: 0.5rem"
                />
              </div>
              <div v-if="col.dataType === 'progress'">
                <PvDropdown
                  v-model="filterModel.value"
                  :options="['Assigned', 'Started', 'Completed']"
                  style="margin-bottom: 0.5rem"
                />
              </div>
            </template>
          </PvColumn>
          <template #empty> No data found. </template>
        </PvDataTable>
      </span>
    </div>
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
import _head from 'lodash/head';
import _isEmpty from 'lodash/isEmpty';
import _forEach from 'lodash/forEach';
import _find from 'lodash/find';
import _filter from 'lodash/filter';
import _toUpper from 'lodash/toUpper';
import _startCase from 'lodash/startCase';
import _lowerCase from 'lodash/lowerCase';
import { scoredTasks, rawOnlyTasks } from '@/helpers/reports';

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
// const compressedRows = ref(false);
const nameForVisualize = ref('Expand View');
const countForVisualize = ref(2); //for starting compress
const toggleView = () => {
  compressedRows.value = !compressedRows.value;
  increasePadding();
};

const props = defineProps({
  columns: { type: Array, required: true },
  data: { type: Array, required: true },
  allowExport: { type: Boolean, default: true },
  exportFilename: { type: String, default: 'datatable-export' },
  pageLimit: { type: Number, default: 15 },
  totalRecords: { type: Number, required: false, default: 0 },
  loading: { type: Boolean, default: false },
  lazy: { type: Boolean, default: false },
  lazyPreSorting: { type: Array, required: false, default: () => [] },
  allowFiltering: { type: Boolean, required: false, default: true },
});

const inputColumns = ref(props.columns);
const selectedColumns = ref(props.columns);
// Filter the live data (props.columns) with the selections of selectedColumns
const computedColumns = computed(() => {
  return _map(selectedColumns.value, (col) => {
    return _find(props.columns, (pcol) => pcol.header === col.header);
  });
});
const currentSort = ref([]);
const currentFilter = ref([]);
const hideFilterButtons = computed(() => !_isEmpty(currentFilter.value) || !props.allowFiltering);
const scoreFilterApplied = computed(() => {
  const scoreFilter = _find(currentFilter.value, (filter) => {
    if (filter.split('.')[0] === 'scores') {
      return true;
    } else return false;
  });
  return Boolean(scoreFilter);
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

const compressedRows = ref(false);
const padding = '1rem 1.5rem';

function increasePadding() {
  if (countForVisualize.value % 2 === 0) {
    document.documentElement.style.setProperty('--padding-value', padding);
    nameForVisualize.value = 'Compact View';
  } else {
    nameForVisualize.value = 'Expand View';
    document.documentElement.style.setProperty('--padding-value', '1px 1.5rem 2px 1.5rem');
  }
  countForVisualize.value = countForVisualize.value + 1;
}

// Generate filters and options objects
const valid_dataTypes = ['NUMERIC', 'NUMBER', 'TEXT', 'STRING', 'DATE', 'BOOLEAN', 'SCORE', 'PROGRESS'];
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
      returnMatchMode = { value: null, matchMode: FilterMatchMode.EQUALS };
    } else if (dataType === 'DATE') {
      returnMatchMode = { value: null, matchMode: FilterMatchMode.DATE_IS };
    } else if (dataType === 'SCORE') {
      // The FilterMatchMode does not matter as we are using this in conjunction with 'lazy',
      //   so the filter event is being handled in an external handler.
      if (scoredTasks.includes(column.field.split('.')[1])) {
        returnMatchMode = { value: null, matchMode: FilterMatchMode.STARTS_WITH };
      }
    } else if (dataType === 'PROGRESS') {
      returnMatchMode = { value: null, matchMode: FilterMatchMode.STARTS_WITH };
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

const enableFilter = (column) => {
  // If column is specified to have filtering disabled
  if (_get(column, 'filter') === false) return false;

  // If the field is not defined, turn off filtering
  const field = column.field;
  if (!field) return false;

  // If the field is a score, and the taskId is on
  //   the filter blacklist, turn off filtering
  const path = field.split('.');
  if (path[0] === 'scores') {
    if (!scoredTasks.includes(path[1])) return false;
  }

  // Otherwise, enable filtering
  return true;
};

// Grab list of fields defined as dates
let dateFields = _filter(props.columns, (col) => _toUpper(col.dataType) === 'DATE');
dateFields = _map(dateFields, (col) => col.field);

let toolTipByHeader = (header) => {
  const headerToTooltipMap = {
    Word: 'Assesses decoding skills at the word level. \n\n  Percentile ranges from 0-99 \n Raw Score ranges from 100-900',
    Letter:
      'Assesses decoding skills at the word level. \n\n Percentile ranges from 0-99 \n Raw Score ranges from 0-90',
    Phoneme:
      'Assesses phonological awareness: sound matching and elision. \n\n Percentile ranges from 0-99 \n Raw Score ranges from 0-57',
    Sentence:
      'Assesses reading fluency at the sentence level. \n\n Percentile ranges from 0-99 \n Raw Score ranges from 0-130 ',
    Palabra:
      'Assesses decoding skills at the word level in Spanish. This test is still in the research phase. \n\n  Percentile ranges from 0-99 \n Raw Score ranges from 100-900',
  };

  return headerToTooltipMap[header] || '';
};

function getIndexTask(colData, task) {
  for (let index = 0; index < colData.assignment.assessments.length; index++) {
    if (colData.assignment.assessments[index].taskId === task) {
      return index;
    }
  }
}

function getFlags(index, colData) {
  const assessment = colData.assignment.assessments[index];

  // Check if assessment and engagementFlags are defined
  if (!assessment || !assessment.engagementFlags) {
    return ''; // Return an empty string if assessment or engagementFlags are undefined
  }

  const flags = assessment.engagementFlags;
  const flagMessages = {
    accuracyTooLow: '- Responses were inaccurate',
    notEnoughResponses: '- Assessment was incomplete',
    responseTimeTooFast: '- Responses were too fast',
  };

  // If there are flags and the assessment is not reliable, return the flags
  if (!assessment.reliable) {
    const reliabilityFlags = Object.keys(flags).map((flag) => {
      return flagMessages[flag] || flag.toLowerCase(); // Use toLowerCase() instead of _lowerCase(flag)
    });
    // Join the returned flags with a newline character, then add two newlines for spacing
    return reliabilityFlags.join('\n') + '\n\n';
  } else {
    return '';
  }
}

function handleToolTip(_taskId, _toolTip, _colData) {
  // Get the support level and flags, if they exist
  _toolTip += _colData.scores?.[_taskId]?.support_level + '\n' + '\n';
  _toolTip += getFlags(getIndexTask(_colData, _taskId), _colData);

  // If the task does not have a raw score, then display no scores
  if (!_colData.scores?.[_taskId]?.raw) {
    _toolTip += 'Awaiting scores';
  }
  // If the task is in the rawOnlyTasks list, display only the raw score and that the scores are under development
  else if (rawOnlyTasks.includes(_taskId)) {
    _toolTip += 'Raw Score: ' + _colData.scores?.[_taskId]?.raw + '\n' + '\n';
    _toolTip += 'These scores are under development';
  }
  // If the task is a scored task and has a raw score, then display all scores
  else {
    _toolTip += 'Raw Score: ' + _colData.scores?.[_taskId]?.raw + '\n';
    _toolTip += 'Percentile: ' + _colData.scores?.[_taskId]?.percentile + '\n';
    _toolTip += 'Standard Score: ' + Math.round(_colData.scores?.[_taskId]?.standard) + '\n';
  }
  return _toolTip;
}

let returnScoreTooltip = (colHeader, colData, fieldPath) => {
  const taskId = fieldPath.split('.')[0] === 'scores' ? fieldPath.split('.')[1] : null;
  let toolTip = '';

  const headerToTaskIdMap = {
    Phoneme: 'pa',
    Word: 'swr',
    Sentence: 'sre',
    Letter: 'letter',
    Palabra: 'swr-es',
  };

  const selectedTaskId = headerToTaskIdMap[colHeader];
  if (selectedTaskId && colData.scores?.[selectedTaskId]?.support_level) {
    // Handle scored tasks
    return handleToolTip(selectedTaskId, toolTip, colData);
    // Handle raw only tasks
  } else if (taskId && !scoredTasks.includes(taskId)) {
    return handleToolTip(taskId, toolTip, colData);
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

// Pass through data table events
const emit = defineEmits(['page', 'sort', 'export-all', 'selection', 'filter']);
const onPage = (event) => {
  emit('page', event);
};
const onSort = (event) => {
  currentSort.value = _get(event, 'multiSortMeta') ?? [];
  emit('sort', event);
};
const onFilter = (event) => {
  const filters = [];
  for (const filterKey in _get(event, 'filters')) {
    const filter = _get(event, 'filters')[filterKey];
    const constraint = _head(_get(filter, 'constraints'));
    if (_get(constraint, 'value')) {
      filters.push(filterKey);
    }
  }
  currentFilter.value = filters;
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
  margin-left: 10px;
  margin-top: 5px;
  margin-bottom: 5px;
}

button.p-button.p-component.softer {
  background: #f3adad;
  color: black;
}

button.p-column-filter-menu-button.p-link,
g {
  color: white;
  margin-left: 10px;
}

.p-datatable .p-datatable-tbody > tr > td {
  text-align: left;
  border: 1px solid var(--surface-c);
  border-width: 0 0 1px 0;
  padding: var(--padding-value, '1px 1.5rem 2px 1.5rem');
  margin-top: 5px;
  margin-bottom: 5px;
}

.view-label {
  background-color: white;
  font-size: smaller;
  color: var(--surface-500);
}

.view-label2 {
  position: absolute;
  top: -15px;
  left: 5px;
  background-color: white;
  z-index: 1;
  font-size: smaller;
  color: var(--surface-500);
  width: 110px;
}

button.p-column-filter-menu-button.p-link:hover {
  background: var(--surface-500);
}

.compressed .p-datatable .p-datatable-tbody > tr > td {
  text-align: left;
  border: 1px solid var(--surface-c);
  border-width: 0 0 3px 0;
  padding: 1px 1.5rem 2px 1.5rem;
}

.filter-content {
  width: 12rem;
}

.filter-button-override .p-column-filter-menu-button:not(.p-column-filter-menu-button-active) {
  display: none;
}

.p-column-filter-matchmode-dropdown {
  /* Our current filtering queries do not support options other than equals
     for strings. To reduce confusion for end users, remove the dropdown
     offering different matchmodes */
  display: none;
}

.scrollable-container::-webkit-scrollbar {
  width: 10px;
}

.scrollable-container::-webkit-scrollbar-thumb,
.scrollable-container::-webkit-scrollbar-track {
  background-color: var(--primary-color);
}

.scrollable-container {
  scrollbar-color: var(--primary-color) white;
}
</style>
