<template>
  <div v-if="!props.data">
    <SkeletonTable />
  </div>
  <div v-else class="options-container">
    <div class="flex justify-content-end mr-3 mt-2 button-container">
      <button type="button" class="text-red-700 cursor-pointer options-toggle" @click.prevent="toggleControls">
        {{ showControls ? 'Hide Options' : 'Show Options' }}
      </button>
    </div>
    <div v-if="showControls" class="w-full gap-1 pt-1 flex justify-content-center align-items-center flex-wrap mb-4">
      <div
        v-if="props.allowFiltering || props.allowColumnSelection || props.allowExport"
        class="w-full gap-1 pt-1 flex justify-content-center align-items-center flex-wrap mt-3"
      >
        <slot name="filterbar"></slot>
        <PvFloatLabel v-if="props.allowColumnSelection">
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
          <label for="ms-columns" class="view-label2">Select Columns</label>
        </PvFloatLabel>
        <PvFloatLabel v-if="props.allowColumnSelection">
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
        <!-- <span v-if="props.allowExport" class="flex flex-row flex-wrap justify-content-end gap-2 max-h-3 export-wrapper">
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
            class="m-1 m-1 h-3rem bg-primary text-white border-none border-round h-2rem text-sm hover:bg-red-900"
            @click="exportCSV(true, $event)"
          />
          <PvButton
            v-if="allowExport"
            v-tooltip.bottom="'Export all scores for all students to a CSV file for spreadsheet import.'"
            label="Export Whole Table"
            class="m-1 h-3rem bg-primary text-white border-none border-round h-2rem text-sm hover:bg-red-900"
            @click="exportCSV(false, $event)"
          />
        </span> -->
      </div>
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
            header-style="background-color: var(--primary-color); border:none;"
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
                  class="progress-tag"
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
                    class="border border-round surface-200 p-2 hover:surface-500"
                    :label="colData.routeParams.buttonLabel"
                    :aria-label="col.routeTooltip"
                    :icon="col.routeIcon"
                    style="color: black !important"
                    data-cy="route-button"
                    size="small"
                  />
                </router-link>
                <span
                  v-if="colData.userCount !== undefined && colData.userCount !== null"
                  class="font-semibold text-sm ml-2"
                >
                  {{ colData.userCount }}
                </span>
              </div>
              <div v-else-if="col.button">
                <PvButton
                  severity="secondary"
                  text
                  class="column-button border border-round surface-200 text-primary p-2 hover:surface-500 hover:text-white"
                  :label="col.buttonLabel"
                  :aria-label="col.buttonTooltip"
                  :icon="col.buttonIcon"
                  data-cy="event-button"
                  size="small"
                  @click="$emit(col.eventName, colData)"
                />
              </div>
              <div v-else-if="col.dataType === 'date'">
                {{ getFormattedDate(_get(colData, col.field)) }}
              </div>
              <div v-else-if="col.field === 'user.lastName'">
                {{ _get(colData, col.field) }}
              </div>
              <div v-else-if="col.field === 'userType' && _get(colData, col.field) === 'parent'">Caregiver</div>
              <div v-else>
                {{ _get(colData, col.field) }}
              </div>
            </template>
            <template v-if="col.dataType" #sorticon="{ sorted, sortOrder }">
              <i v-if="!sorted && currentSort.length === 0" class="pi pi-sort-alt ml-2" />
              <i v-if="sorted && sortOrder === 1" class="pi pi-sort-amount-down-alt ml-2" />
              <i v-else-if="sorted && sortOrder === -1" class="pi pi-sort-amount-up-alt ml-2" />
            </template>
            <template v-if="col.dataType" #filter="{ filterModel }">
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
              <PvMultiSelect
                v-if="col.useMultiSelect"
                v-model="filterModel.value"
                :options="_get(refOptions, col.field)"
                placeholder="Any"
                :show-toggle-all="false"
                class="p-column-filter"
              />
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
                  data-cy="score-filter-dropdown"
                  style="margin-bottom: 0.5rem; width: 17vh; height: 4vh"
                >
                  <template #option="{ option }">
                    <div class="flex align-items-center p-0">
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
                  style="margin-bottom: 0.5rem"
                  data-cy="progress-filter-dropdown"
                >
                  <template #option="{ option }">
                    <div v-if="progressTags[option]" class="flex align-items-center">
                      <PvTag
                        :severity="progressTags[option]?.severity"
                        :value="progressTags[option]?.value"
                        :icon="progressTags[option]?.icon"
                        class="progress-tag"
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
                      class="progress-tag"
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
                  class="pl-5 pr-5 bg-primary text-white border-round border-none hover:bg-red-900"
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
                class="pl-5 pr-5 bg-primary text-white border-round border-none hover:bg-red-900"
                severity="primary"
                @click="filterCallback()"
                >Apply
              </PvButton>
            </template>
          </PvColumn>
          <template #empty>
            <div class="flex flex-column align-items-center align-text-left my-8">
              <div class="text-lg font-bold my-2">No results found</div>
              <div class="font-light">The filters applied have no matching results .</div>
              <PvButton
                text
                class="my-2 bg-primary p-2 border-none border-round text-white hover:bg-red-900"
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
import PvButton from 'primevue/button';
import PvDatePicker from 'primevue/datepicker';
import PvChip from 'primevue/chip';
import PvColumn from 'primevue/column';
import PvDataTable from 'primevue/datatable';
import PvFloatLabel from 'primevue/floatlabel';
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
import _toUpper from 'lodash/toUpper';
import _startCase from 'lodash/startCase';
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
      filter will be a multi-select dropdown. options are generated by the
      given data.
- Pinned (optional) is a boolean field allowing the column to persist when
      scrolled left-to-right. It is suggested that this only be used on
      the leftmost column.
*/
const showControls = ref(false);
const toggleControls = () => {
  showControls.value = !showControls.value;
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
  allowFiltering: { type: Boolean, default: true },
  allowColumnSelection: { type: Boolean, default: true },
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

const toast = useToast();
const selectAll = ref(false);
const onSelectAll = () => {
  selectAll.value = !selectAll.value;
  if (selectAll.value) {
    selectedRows.value = props.data;
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
      returnMatchMode = {
        value: null,
        matchMode: dataTypesToFilterMatchMode[dataType],
      };
    }

    // case for where multiselect ( can affect any type of data type)
    if (_get(column, 'useMultiSelect')) {
      returnMatchMode = { value: null, matchMode: FilterMatchMode.IN };
      options[column.field] = getUniqueOptions(column);
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
  if (date instanceof Date) {
    return date.toLocaleDateString('en-us', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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

// Pass through data table events
const emit = defineEmits(['export-all', 'selection', 'reset-filters', 'export-selected', 'export-org-users']);
</script>
<style>
.column-button {
  color: black !important;
}

.column-button > .p-button-label {
  font-weight: normal !important;
}

.options-container {
  .button-container {
    position: relative;
    min-height: 34px;
  }

  .options-toggle {
    position: absolute;
    top: 10px;
    background: transparent;
    border: 1px solid transparent;
    padding: 0;
    margin: 0;
    font: inherit;
    cursor: pointer;
  }
}

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

.p-component {
  position: relative;
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
  margin-top: 5px;
  margin-bottom: 5px;
  padding: 0.6rem 1rem !important;
}

.p-datatable-popover-filter {
  display: none !important;
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
  width: 110px;
}

button.p-column-filter-menu-button.p-link:hover {
  background: var(--surface-500);
}

.compressed .p-datatable .p-datatable-tbody > tr > td {
  text-align: left;
  border: 1px solid var(--surface-c);
  border-width: 0 0 3px 0;
  padding: 0.6rem 1rem !important;
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

/* Add standardized styling for progress tags */
.progress-tag {
  min-width: 7rem !important;
  display: inline-block !important;
  text-align: center !important;
  font-weight: bold !important;
}

/* Add spacing between icon and text in tags */
.progress-tag .p-tag-icon {
  margin-right: 0.5rem !important;
}
</style>
