<template>
  <div v-if="!props.data">
    <SkeletonTable />
  </div>
  <div v-else>
    <div class="flex flex-wrap gap-1 pt-1 mt-3 w-full justify-content-center align-items-center">
      <slot name="filterbar"></slot>
      <PvButton type="button" icon="pi pi-filter-slash" label="Clear Filters" @click="resetFilters" />
      <PvFloatLabel>
        <PvMultiSelect
          id="ms-columns"
          v-tooltip.top="'Show and hide columns'"
          :model-value="selectedColumns"
          :options="inputColumns"
          option-label="header"
          :max-selected-labels="3"
          class="w-2 md:w-10rem"
          selected-items-label="{0} columns selected"
          @update:model-value="onColumnToggle"
        />
        <label for="ms-columns" class="view-label2">Show/Hide Columns</label>
      </PvFloatLabel>
      <PvFloatLabel>
        <PvMultiSelect
          id="ms-freeze"
          :model-value="frozenColumns"
          :options="inputColumns"
          option-label="header"
          :max-selected-labels="3"
          class="w-2 md:w-10rem"
          selected-items-label="{0} columns frozen"
          :show-toggle-all="false"
          @update:model-value="onFreezeToggle"
        />
        <label for="ms-columns" class="view-label2">Freeze Columns</label>
      </PvFloatLabel>
      <span class="flex flex-row flex-wrap gap-2 max-h-3 justify-content-end export-wrapper">
        <PvButton
          v-tooltip.bottom="'Expand or Compress table rows'"
          text
          :label="rowViewMode"
          class="m-1 my-1 text-sm border-none h-3rem text-primary surface-ground border-round h-2rem hover:bg-gray-300"
          @click="toggleView"
        />
        <PvButton
          v-if="allowExport"
          v-tooltip.bottom="
            `Export scores for ${selectedRows.length} student${
              selectedRows.length > 1 ? 's' : ''
            } to CSV file for spreadsheet import`
          "
          label="Export Selected"
          :badge="selectedRows?.length?.toString()"
          :disabled="selectedRows.length === 0"
          class="m-1 text-sm text-white border-none h-3rem bg-primary border-round h-2rem hover:bg-red-900"
          data-cy="data-table__export-selected-btn"
          @click="exportCSV(true, $event)"
        />
        <PvButton
          v-if="allowExport"
          v-tooltip.bottom="'Export all scores for all students to a CSV file for spreadsheet import.'"
          label="Export Whole Table"
          class="m-1 text-sm text-white border-none h-3rem bg-primary border-round h-2rem hover:bg-red-900"
          data-cy="data-table__export-table-btn"
          @click="exportCSV(false, $event)"
        />
      </span>
    </div>
    <div class="flex flex-column">
      <span style="height: 10px">
        <div class="flex relative mt-0 mr-2 justify-content-end z-1" style="top: 25px; width: 20%; left: 80%">
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
          :value="data"
          :row-hover="true"
          :reorderable-columns="true"
          :resizable-columns="true"
          :export-filename="exportFilename"
          removable-sort
          sort-mode="multiple"
          :multi-sort-meta="lazyPreSorting"
          show-gridlines
          filter-display="menu"
          paginator
          :rows="pageLimit"
          :always-show-paginator="true"
          paginator-position="both"
          :rows-per-page-options="[10, 25, 50, 100]"
          :total-records="totalRecords"
          :loading="loading"
          scrollable
          :select-all="selectAll"
          data-cy="roar-data-table"
          @select-all-change="onSelectAll"
          @row-select="onSelectionChange"
          @row-unselect="onSelectionChange"
        >
          <PvColumn
            selection-mode="multiple"
            header-style="background:color-mix(in srgb, var(--primary-color) 80%, white); border-left:4px solid var(--primary-color); border-right: 2px solid var(--primary-color); border-top:4px solid var(--primary-color); border-bottom: 4px solid var(--primary-color);"
            :reorderable-column="false"
            frozen
          />
          <PvColumn
            v-for="(col, index) of computedColumns"
            :key="col.field + '_' + index"
            :field="col.field"
            :data-type="col.dataType"
            :sortable="col.sort !== false"
            :show-filter-match-modes="!col.useMultiSelect && col.dataType !== 'score' && col.dataType !== 'progress'"
            :show-filter-operator="col.allowMultipleFilters === true"
            :filter-field="col?.filterField ? col.filterField : col.field"
            :show-add-button="col.allowMultipleFilters === true"
            :frozen="col.pinned"
            :style="col.style"
            align-frozen="left"
            header-style="background:color-mix(in srgb, var(--primary-color) 80%, white); color: white; padding-top:0; margin-top:0; padding-bottom:0; margin-bottom:0; border-left:2px solid var(--primary-color); border-right: 2px solid var(--primary-color); border-top:4px solid var(--primary-color); border-bottom: 4px solid var(--primary-color); margin-left:0"
            :pt="{
              pcColumnFilterButton: pcColumnFilterButton,
            }"
          >
            <template #header>
              <div>
                {{ col.header }}
              </div>
              <i
                v-if="toolTipByHeader(col.header).length > 0"
                v-tooltip.top="`${toolTipByHeader(col.header)}`"
                class="pi pi-info-circle"
              />
            </template>
            <template #body="{ data: colData }">
              <!-- If column is a score field, use a dedicated component to render tags and scores -->
              <div v-if="col.field && col.field?.split('.')[0] === 'scores'">
                <TableScoreTag :col-data="colData" :col="col" />
              </div>
              <div v-else-if="col.dataType == 'progress'">
                <PvTag
                  v-if="_get(colData, col.field)"
                  :severity="_get(colData, col.severityField)"
                  :value="_get(colData, col.field)"
                  :icon="_get(colData, col.iconField)"
                  :style="`min-width: 2rem; font-weight: bold;`"
                  rounded
                />
              </div>
              <div
                v-else-if="col.tagOutlined && _get(colData, col.tagColor)"
                class="circle"
                :style="`border: 1px solid black; background-color: ${_get(colData, col.tagColor)}; color: ${
                  _get(colData, col.tagColor) === 'white' ? 'black' : 'white'
                }; outline: 1px dotted #0000CD; outline-offset: 3px`"
              />
              <div v-else-if="col.chip && col.dataType === 'array' && _get(colData, col.field) !== undefined">
                <PvChip v-for="chip in _get(colData, col.field)" :key="chip" :label="chip" />
              </div>
              <div v-else-if="col.link">
                <router-link :to="{ name: col.routeName, params: colData.routeParams }">
                  <PvButton
                    v-tooltip.right="colData.tooltip"
                    severity="secondary"
                    text
                    class="p-2 border border-round surface-200 hover:surface-500"
                    :label="colData.routeParams.buttonLabel"
                    :aria-label="col.routeTooltip"
                    :icon="col.routeIcon"
                    style="color: black !important"
                    data-cy="data-table__entry-details-btn"
                    size="small"
                  />
                </router-link>
              </div>
              <div v-else-if="col.launcher">
                <a :href="'/launch/' + colData.routeParams.userId">
                  <PvButton
                    v-tooltip.right="colData?.launchTooltip"
                    severity="secondary"
                    text
                    class="p-2 border border-round surface-200 hover:surface-500"
                    :label="colData?.routeParams?.buttonLabel"
                    :aria-label="col?.routeTooltip"
                    :icon="col?.routeIcon"
                    style="color: black !important"
                    data-cy="route-button-launch"
                    size="small"
                  />
                </a>
              </div>
              <div v-else-if="col.button">
                <PvButton
                  severity="secondary"
                  text
                  class="p-2 border border-round surface-200 text-primary hover:surface-500 hover:text-white"
                  :label="col.buttonLabel"
                  :aria-label="col.buttonTooltip"
                  :icon="col.buttonIcon"
                  style="color: black !important"
                  size="small"
                  :data-cy="`data-table__event-btn__${col.eventName}`"
                  @click="$emit(col.eventName, colData)"
                />
              </div>

              <div v-else-if="col.dataType === 'date'" class="px-4">
                {{ getFormattedDate(_get(colData, col.field)) }}
              </div>
              <div v-else class="px-4">
                {{ _get(colData, col.field) }}
              </div>
            </template>
            <template v-if="col.dataType" #sorticon="{ sorted, sortOrder }">
              <i v-if="!sorted && currentSort.length === 0" v-tooltip.top="'Sort'" class="ml-2 pi pi-sort-alt" />
              <i
                v-if="sorted && sortOrder === 1"
                v-tooltip.top="'Sort Desecending'"
                class="ml-2 pi pi-sort-amount-down-alt"
              />
              <i
                v-else-if="sorted && sortOrder === -1"
                v-tooltip.top="'Sort Ascending'"
                class="ml-2 pi pi-sort-amount-up-alt"
              />
            </template>
            <template #filtericon>
              <i v-tooltip.top="'Filter Column'" class="pi pi-filter" />
            </template>
            <template v-if="col.dataType && _get(col, 'filter', true)" #filter="{ filterModel, filterCallback }">
              <div v-if="col.dataType === 'text' && !col.useMultiSelect" class="filter-content">
                <PvInputText v-model="filterModel.value" type="text" class="p-column-filter" placeholder="Filter" />
              </div>
              <PvInputNumber
                v-if="col.dataType === 'number' && !col.useMultiSelect"
                v-model="filterModel.value"
                type="text"
                class="p-column-filter"
                placeholder="Search"
              />
              <div v-if="col.useMultiSelect" style="max-width: 12rem">
                <PvMultiSelect
                  v-if="col.useMultiSelect"
                  v-model="filterModel.value"
                  :options="_get(refOptions, col.field)"
                  :placeholder="_get(col, 'multiSelectPlaceholder', 'Any')"
                  :show-toggle-all="false"
                  :max-selected-labels="1"
                  class="p-column-filter"
                  style="width: 12rem"
                  @change="filterCallback()"
                />
              </div>
              <PvDatePicker
                v-if="col.dataType === 'date' && !col.useMultiSelect"
                v-model="filterModel.value"
                date-format="mm/dd/yy"
                placeholder="mm/dd/yyyy"
              />
              <div v-if="col.dataType === 'boolean'" class="flex flex-row gap-2">
                <PvSelect v-model="filterModel.value" :options="['True', 'False']" style="margin-bottom: 0.5rem" />
              </div>
              <div v-if="col.dataType === 'score'">
                <PvSelect
                  v-model="filterModel.value"
                  option-label="label"
                  option-group-label="label"
                  option-group-children="items"
                  :options="taskFilterOptions"
                  data-cy="data-table__score-filter-dropdown"
                  style="margin-bottom: 0.5rem; width: 17vh; height: 4vh"
                >
                  <template #option="{ option }">
                    <div class="flex p-0 align-items-center">
                      <div v-if="supportLevelColors[option]" class="flex gap-2 p-0">
                        <div class="small-circle tooltip" :style="`background-color: ${supportLevelColors[option]};`" />
                        <span class="tooltiptext">{{ option }}</span>
                      </div>
                      <div v-else-if="progressTags[option]">
                        <PvTag
                          :severity="progressTags[option]?.severity"
                          :value="progressTags[option]?.value"
                          :icon="progressTags[option]?.icon"
                          class="p-0.5 m-0 font-bold"
                        />
                      </div>
                      <div v-else>
                        <span class="tooltiptext">{{ option }}</span>
                      </div>
                    </div>
                  </template>
                  <template #value="{ value }">
                    <div v-if="supportLevelColors[value]" class="flex gap-2">
                      <div class="small-circle tooltip" :style="`background-color: ${supportLevelColors[value]};`" />
                      <span class="tooltiptext">{{ value }}</span>
                    </div>
                    <div v-else-if="progressTags[value]">
                      <PvTag
                        :severity="progressTags[value]?.severity"
                        :value="progressTags[value]?.value"
                        :icon="progressTags[value]?.icon"
                        class="p-0.5 m-0 font-bold"
                      />
                    </div>
                    <div v-else>
                      <span class="tooltiptext">{{ value }}</span>
                    </div>
                  </template>
                </PvSelect>
              </div>
              <div v-if="col.dataType === 'progress'">
                <PvSelect
                  v-model="filterModel.value"
                  :options="['Assigned', 'Started', 'Completed', 'Optional']"
                  style="margin-bottom: 0.5rem; width: 12rem"
                  data-cy="data-table__progress-filter-dropdown"
                >
                  <template #option="{ option }">
                    <div v-if="progressTags[option]" class="flex align-items-center">
                      <PvTag
                        :severity="progressTags[option]?.severity"
                        :value="progressTags[option]?.value"
                        :icon="progressTags[option]?.icon"
                        :style="`min-width: 2rem; font-weight: bold`"
                        rounded
                      />
                    </div>
                  </template>
                  <template #value="{ value }">
                    <PvTag
                      v-if="progressTags[value]"
                      :severity="progressTags[value]?.severity"
                      :value="progressTags[value]?.value"
                      :icon="progressTags[value]?.icon"
                      :style="`min-width: 2rem; font-weight: bold`"
                      rounded
                    />
                  </template>
                </PvSelect>
              </div>
            </template>
            <template #filterclear="{ filterCallback }">
              <div class="flex flex-row-reverse">
                <PvButton
                  type="button"
                  text
                  icon="pi pi-times"
                  class="pr-5 pl-5 text-white border-none bg-primary border-round hover:bg-red-900"
                  severity="primary"
                  @click="filterCallback()"
                  >Clear</PvButton
                >
              </div>
            </template>
            <template #filterapply="{ filterCallback }">
              <PvButton
                type="button"
                icon="pi pi-times"
                class="pr-5 pl-5 text-white border-none bg-primary border-round hover:bg-red-900"
                severity="primary"
                @click="filterCallback()"
                >Apply
              </PvButton>
            </template>
          </PvColumn>
          <template #empty>
            <div class="flex my-8 flex-column align-items-center align-text-left">
              <div class="my-2 text-lg font-bold">No results found</div>
              <div class="font-light">The filters applied have no matching results .</div>
              <PvButton
                text
                class="p-2 my-2 text-white border-none bg-primary border-round hover:bg-red-900"
                @click="resetFilters"
                >Reset Filters</PvButton
              >
            </div>
          </template>
        </PvDataTable>
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import PvFloatLabel from 'primevue/floatlabel';
import PvButton from 'primevue/button';
import PvDatePicker from 'primevue/datepicker';
import PvChip from 'primevue/chip';
import PvColumn from 'primevue/column';
import PvDataTable from 'primevue/datatable';
import PvSelect from 'primevue/select';
import PvInputNumber from 'primevue/inputnumber';
import PvInputText from 'primevue/inputtext';
import PvMultiSelect from 'primevue/multiselect';
import PvTag from 'primevue/tag';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import _get from 'lodash/get';
import _map from 'lodash/map';
import _forEach from 'lodash/forEach';
import _find from 'lodash/find';
import _isEmpty from 'lodash/isEmpty';
import _toUpper from 'lodash/toUpper';
import _startCase from 'lodash/startCase';
import _uniq from 'lodash/uniq';
import { supportLevelColors, progressTags } from '@/helpers/reports';
import SkeletonTable from '@/components/SkeletonTable.vue';
import TableScoreTag from '@/components/reports/TableScoreTag.vue';

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
      filter will be a multi-select dropdown. options are passed in or generated
      by the given data.
- multiSelectOptions (optional) is an array of strings that will be used for
      the multi-select dropdown. If not provided, options will be generated from
      the given data.
- Pinned (optional) is a boolean field allowing the column to persist when
      scrolled left-to-right. It is suggested that this only be used on
      the leftmost column.
*/
const rowViewMode = ref('Expand View');
const countForVisualize = ref(false); //for starting compress
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
  isInsideListOrgs: {
    type: Boolean,
    default: false,
  },
  groupheaders: { type: Boolean, default: false },
});

const inputColumns = ref(props.columns);
const selectedColumns = ref(props.columns.filter((col) => !_get(col, 'hidden', false)));
// Filter the live data (props.columns) with the selections of selectedColumns
const computedColumns = computed(() => {
  return _map(selectedColumns.value, (col) => {
    return _find(props.columns, (pcol) => pcol.header === col.header);
  });
});

const toast = useToast();

const dataTable = ref();
const selectAll = ref(false);
const currentSort = ref([]);
const selectedRows = ref([]);

const taskFilterOptions = ref([
  {
    label: 'Support Categories',
    code: 'SupportCategories',
    items: ['Green', 'Yellow', 'Pink'],
  },
  {
    label: 'Progress Status',
    code: 'ProgressStatus',
    items: ['Completed', 'Started', 'Assigned'],
  },
  {
    label: 'Other Filters',
    code: 'Other',
    items: ['Optional', 'Assessed', 'Unreliable'],
  },
]);

const onSelectAll = (event) => {
  selectAll.value = event.checked;

  if (!selectAll.value) {
    selectedRows.value = [];
    emit('selection', selectedRows.value);
    return;
  }

  // Get the currently visible dataset using the internal PrimeVue dataToRender method.
  // This is a workaround as PrimeVue does not provide a public API for this functionality (see
  // https://github.com/primefaces/primevue/issues/3477). The dataToRender method is not
  // exposed in the public API, but it is available on the ref of the DataTable component.
  selectedRows.value = dataTable.value.dataToRender();

  // Show a toast if the user has selected less rows than the total number of rows in the table as the "select all"
  // checkbox only selects the currently visible rows.
  if (selectedRows.value.length < props.totalRecords) {
    toast.add({
      severity: 'info',
      summary: `${selectedRows.value.length} rows selected`,
      detail: `You've selected ${selectedRows.value.length} out of ${props.totalRecords} rows in this table. To include all rows in your export, click Export Whole Table.`,
      life: 5000,
    });
  }

  emit('selection', selectedRows.value);
};

const onSelectionChange = () => {
  emit('selection', selectedRows.value);
};

const exportCSV = (exportSelected) => {
  if (exportSelected) {
    emit('export-selected', selectedRows.value);
    return;
  }
  emit('export-all');
};

const compressedRows = ref(false);
const padding = '0rem 0.5rem 0rem 0.5rem';

function increasePadding() {
  if (!countForVisualize.value) {
    document.documentElement?.style.setProperty('--padding-value', padding);
    rowViewMode.value = 'Compact View';
  } else {
    rowViewMode.value = 'Expand View';
    document.documentElement?.style.setProperty('--padding-value', '0.5rem 1.5rem 0.5rem 1.5rem');
  }
  countForVisualize.value = !countForVisualize.value;
}

// Generate filters and options objects
const dataTypesToFilterMatchMode = {
  NUMERIC: FilterMatchMode.EQUALS,
  NUMBER: FilterMatchMode.EQUALS,
  TEXT: FilterMatchMode.CONTAINS,
  STRING: FilterMatchMode.CONTAINS,
  DATE: FilterMatchMode.DATE_IS,
  BOOLEAN: FilterMatchMode.EQUALS,
  SCORE: FilterMatchMode.CONTAINS,
  PROGRESS: FilterMatchMode.CONTAINS,
};

const computedFilters = computed(() => {
  let filters = {};
  let options = {};
  _forEach(computedColumns.value, (column) => {
    // Check if header text is supplied; if not, generate.
    if (!_get(column, 'header')) {
      column['header'] = _startCase(_get(column, 'field'));
    }
    // Choose whether to default to field or a custom filterField (e.g. tag based filters)
    const fieldOrFilterField = column?.filterField ? column.filterField : column.field;
    const dataType = _toUpper(_get(column, 'dataType'));
    let returnMatchMode = null;

    // generate return matchmode
    if (dataTypesToFilterMatchMode[dataType]) {
      returnMatchMode = { value: null, matchMode: dataTypesToFilterMatchMode[dataType] };
    }

    // For multiselect columns, populate options
    if (_get(column, 'useMultiSelect')) {
      returnMatchMode = { value: null, matchMode: FilterMatchMode.IN };
      const suppliedOptions = _get(column, 'multiSelectOptions');
      if (suppliedOptions && !_isEmpty(suppliedOptions)) {
        options[column.field] = suppliedOptions;
      } else {
        options[column.field] = getUniqueOptions(column);
      }
    }

    if (returnMatchMode) {
      filters[fieldOrFilterField] = {
        operator: FilterOperator.AND,
        constraints: [returnMatchMode],
      };
    }
  });
  return { computedOptions: options, computedFilters: filters };
});

const refOptions = ref(computedFilters.value.computedOptions);
const refFilters = ref(computedFilters.value.computedFilters);

const resetFilters = () => {
  refFilters.value = computedFilters.value.computedFilters;
  // emit('reset-filters');
};

let toolTipByHeader = (header) => {
  const headerToTooltipMap = {
    'ROAR - Word':
      'Assesses decoding skills at the word level. \n\n  Percentile ranges from 0-99 \n Raw Score ranges from 100-900',
    'ROAR - Letter':
      'Assesses decoding skills at the word level. \n\n Percentile ranges from 0-99 \n Raw Score ranges from 0-90',
    'ROAR - Phoneme':
      'Assesses phonological awareness: sound matching and elision. \n\n Percentile ranges from 0-99 \n Raw Score ranges from 0-57',
    'ROAR - Sentence':
      'Assesses reading fluency at the sentence level. \n\n Percentile ranges from 0-99 \n Raw Score ranges from 0-130 ',
    'ROAR - Palabra':
      'Assesses decoding skills at the word level in Spanish. This test is still in the research phase. \n\n  Percentile ranges from 0-99 \n Raw Score ranges from 100-900',
    Report: 'Individual Score Report',
  };

  return headerToTooltipMap[header] || '';
};

// Generate list of options given a column
function getUniqueOptions(column) {
  const field = _get(column, 'field');
  const values = props.data.map((item) => _get(item, field));
  return _uniq(values);
}

function getFormattedDate(date) {
  if (date instanceof Date) {
    return date.toLocaleDateString('en-us', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
  } else if (typeof date === 'string') {
    try {
      const dateObj = new Date(date);
      return dateObj.toLocaleDateString('en-us', {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return '';
    }
  }
  return '';
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

function pcColumnFilterButton({ context }) {
  return {
    style: context.active ? 'background-color: var(--primary-color)' : '',
  };
}

// Pass through data table events
const emit = defineEmits(['export-all', 'selection', 'reset-filters', 'export-selected', 'export-org-users']);
</script>
<style>
.small-circle {
  border-color: white;
  display: inline-block;
  border-radius: 50%;
  border-width: 5px;
  height: 15px;
  width: 15px;
  vertical-align: middle;
  margin-right: 5px;
  margin-left: 5px;
  margin-top: 3px;
  margin-bottom: 3px;
}

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

button.p-button.p-component.p-button-outlined.p-button-sm.p-button-outlined.p-button-sm,
button.p-button.p-component.p-button-sm.p-button-sm {
  background-color: var(--primary-color);
  color: white;
  border: none;
  padding: 0.5rem;
  margin: 0.5rem;
  border-radius: 0.35rem;
}

button.p-column-filter-menu-button.p-link,
g {
  color: white;
  padding: 5px;
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

.export-wrapper {
  max-height: 4rem;
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
  width: 120px;
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

.filter-button-override .p-column-filter-menu-button:not(.p-column-filter-menu-button-active) {
  display: none;
}

.p-datatable-column-filter-button.p-button-text.p-button-secondary:not(:disabled):hover {
  background: var(--primary-color) !important;
}

.p-column-filter-matchmode-dropdown {
  /* Our current filtering queries do not support options other than equals
     for strings. To reduce confusion for end users, remove the dropdown
     offering different matchmodes */
  display: none;
}

.p-datatable-emptyMessage {
  width: auto; /* or set it to a specific width */
  margin: 0 auto; /* Center the message horizontally */
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
.p-datatable-gridlines .p-datatable-paginator-top,
.p-datatable-gridlines .p-datatable-paginator-bottom {
  border: none !important;
}
.p-button-text.p-button-secondary {
  color: white !important;
}
.p-button-text.p-button-secondary:hover {
  color: var(--gray-300) !important;
}
.p-tag {
  margin: 5px;
}
</style>
