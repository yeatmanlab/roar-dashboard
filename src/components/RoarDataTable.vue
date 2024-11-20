<template>
  <div v-if="!props.data">
    <SkeletonTable />
  </div>
  <div v-else>
    <div v-if="props.allowFiltering || props.allowColumnSelection || props.allowExport" class="w-full gap-1 pt-1 flex justify-content-center align-items-center flex-wrap mt-3">
      <slot name="filterbar"></slot>
      <span v-if="props.allowColumnSelection" class="p-float-label my-3">
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
      </span>
      <span v-if="props.allowColumnSelection" class="p-float-label my-3">
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
      </span>
      <span v-if="props.allowExport" class="flex flex-row flex-wrap justify-content-end gap-2 max-h-3 export-wrapper">
        <PvButton
          v-tooltip.bottom="'Expand or Compress table rows'"
          text
          :label="rowViewMode"
          class="my-1 m-1 h-3rem text-primary surface-ground border-none border-round h-2rem text-sm hover:bg-gray-300"
          @click="toggleView"
        />
        <PvButton
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
          v-tooltip.bottom="'Export all scores for all students to a CSV file for spreadsheet import.'"
          label="Export Whole Table"
          class="m-1 h-3rem bg-primary text-white border-none border-round h-2rem text-sm hover:bg-red-900"
          @click="exportCSV(false, $event)"
        />
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
          <PvColumnGroup type="header" class="mt-2">
            <PvRow v-if="groupheaders" class="flex mt-2">
              <!-- Spacer Header -->
              <!-- colspan = getSpacerHeaderWidth-->
              <PvColumn
                header="Student Information"
                :colspan="getSpacerColumnWidth"
                header-style="background-color: var(--primary-color); color:white; border:1px border-left-none solid white; justify-content:center; margin-top:1rem; text-align: center;"
              />
              <!-- Foundations -->
              <!-- v-if="primarySpacerColumns" :colspan="primarySpacerColumns" -->
              <PvColumn
                v-if="primarySpacerColumns"
                :colspan="primarySpacerColumns"
                header-style="background-color: var(--primary-color); color:white; border:1px solid white; justify-content:center; margin-top:1rem; text-align: center;"
              >
                <template #header>
                  <div class="flex flex-row">
                    <div>Foundational Reading Skills</div>
                    <div class="ml-2">
                      <PvButton class="p-0 border-none border-circle bg-primary" @click="toggle($event, 'primary')"
                        ><i v-tooltip.top="'Learn more'" class="pi pi-info-circle text-white p-1 border-circle"></i
                      ></PvButton>
                    </div>
                  </div>
                </template>
              </PvColumn>
              <!-- Spanish -->
              <!-- v-if="spanishColumns" :colspan="spanishColumns" -->
              <PvColumn
                v-if="spanishSpacerColumns"
                :colspan="spanishSpacerColumns"
                header-style="background-color: var(--primary-color); color:white; border:1px solid white; justify-content:center; margin-top:1rem; text-align: center;"
              >
                <template #header>
                  <div class="flex flex-row">
                    <div>Spanish</div>
                    <div class="ml-2">
                      <PvButton class="p-0 border-none border-circle bg-primary" @click="toggle($event, 'spanish')"
                        ><i v-tooltip.top="'Learn more'" class="pi pi-info-circle text-white p-1 border-circle"></i
                      ></PvButton>
                    </div>
                  </div>
                </template>
              </PvColumn>
              <!-- Spanish  Math-->
              <!-- v-if="spanishMathColumns" :colspan="spanishMathColumns" -->
              <PvColumn
                v-if="spanishMathSpacerColumns"
                :colspan="spanishMathSpacerColumns"
                header-style="background-color: var(--primary-color); color:white; border:1px solid white; justify-content:center; margin-top:1rem; text-align: center;"
              >
                <template #header>
                  <div class="flex flex-row">
                    <div>Spanish Math</div>
                    <div class="ml-2">
                      <PvButton class="p-0 border-none border-circle bg-primary" @click="toggle($event, 'spanishmath')"
                        ><i v-tooltip.top="'Learn more'" class="pi pi-info-circle text-white p-1 border-circle"></i
                      ></PvButton>
                    </div>
                  </div>
                </template>
              </PvColumn>
              <!-- inDev -->
              <!-- v-if="supplemenaryColumns" :colspan="supplementaryColumns" -->
              <PvColumn
                v-if="supplementarySpacerColumns"
                :colspan="supplementarySpacerColumns"
                header-style="background-color: var(--primary-color); color:white; border:1px solid white; justify-content:center; margin-top:1rem; text-align: center;"
              >
                <template #header>
                  <div class="flex flex-row">
                    <div>Supplementary<br />(In Development)</div>
                    <div class="mt-1 ml-2">
                      <PvButton
                        class="p-0 border-none border-circle bg-primary"
                        @click="toggle($event, 'supplementary')"
                        ><i v-tooltip.top="'Learn more'" class="pi pi-info-circle text-white p-1 border-circle"></i
                      ></PvButton>
                    </div>
                  </div>
                </template>
              </PvColumn>
              <!-- inRoam -->
              <!-- v-if="mathSpacerColumns" :colspan="supplementaryColumns" -->
              <PvColumn
                v-if="mathSpacerColumns"
                :colspan="mathSpacerColumns"
                header-style="background-color: var(--primary-color); color:white; border:1px solid white; justify-content:center; margin-top:1rem; text-align: center;"
              >
                <template #header>
                  <div class="flex flex-row">
                    <div>Mathematics<br />(In Development)</div>
                    <div class="mt-1 ml-2">
                      <PvButton class="p-0 border-none border-circle bg-primary" @click="toggle($event, 'math')"
                        ><i v-tooltip.top="'Learn more'" class="pi pi-info-circle text-white p-1 border-circle"></i
                      ></PvButton>
                    </div>
                  </div>
                </template>
              </PvColumn>
              <!-- inRoav -->
              <!-- v-if="visionSpacerColumns" :colspan="supplementaryColumns" -->
              <PvColumn
                v-if="visionSpacerColumns"
                :colspan="visionSpacerColumns"
                header-style="background-color: var(--primary-color); color:white; border:1px solid white; justify-content:center; margin-top:1rem; text-align: center;"
              >
                <template #header>
                  <div class="flex flex-row">
                    <div>Vision<br />(In Development)</div>
                    <div class="mt-1">
                      <PvButton class="p-0 border-none border-circle bg-primary" @click="toggle($event, 'vision')"
                        ><i v-tooltip.top="'Learn more'" class="pi pi-info-circle text-white p-1 border-circle"></i
                      ></PvButton>
                    </div>
                  </div>
                </template>
              </PvColumn>
            </PvRow>
            <PvRow>
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
                :show-filter-match-modes="
                  !col.useMultiSelect && col.dataType !== 'score' && col.dataType !== 'progress'
                "
                :show-filter-operator="col.allowMultipleFilters === true"
                :filter-field="col?.filterField ? col.filterField : col.field"
                :show-add-button="col.allowMultipleFilters === true"
                :frozen="col.pinned"
                :style="col.style"
                align-frozen="left"
                :header-style="
                  col.headerStyle ||
                  `background:var(--primary-color); color:white; padding-top:0; margin-top:0; padding-bottom:0; margin-bottom:0; border:0; margin-left:0`
                "
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
                <template v-if="col.dataType" #filter="{ filterModel }">
                  <div v-if="col.dataType === 'text' && !col.useMultiSelect" class="filter-content">
                    <PvInputText
                      v-model="filterModel.value"
                      type="text"
                      class="p-column-filter p-3"
                      placeholder="Filter"
                    />
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
                      option-label="label"
                      option-group-label="label"
                      option-group-children="items"
                      :options="taskFilterOptions"
                      data-cy="score-filter-dropdown"
                      style="margin-bottom: 0.5rem"
                    >
                      <template #option="{ option }">
                        <div class="flex align-items-center">
                          <div v-if="supportLevelColors[option]" class="flex gap-2">
                            <div
                              class="small-circle tooltip"
                              :style="`background-color: ${supportLevelColors[option]};`"
                            />
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
                          <div
                            class="small-circle tooltip"
                            :style="`background-color: ${supportLevelColors[value]};`"
                          />
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
                    </PvDropdown>
                  </div>
                  <div v-if="col.dataType === 'progress'">
                    <PvDropdown
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
                    </PvDropdown>
                  </div>
                </template>
              </PvColumn>
            </PvRow>
          </PvColumnGroup>
          <PvOverlayPanel ref="op" append-to="body" class="overflow-y-scroll" style="width: 60vh; max-height: 30vh">
            <template v-if="selectedColumn === 'primary'">
              <h3 class="font-bold">Foundational Reading Skills</h3>
              <div>
                <h4 class="font-bold">Word</h4>
                Word indicates which students are in need of support in word-level decoding and automaticity. Word has
                been validated, and national norms are provided.<br />
                <h4 class="font-bold">Sentence</h4>
                Sentence indicates which students are in need of support in sentence-level fluency. Sentence has been
                validated, and national norms are provided.<br />
                <h4 class="font-bold">Phoneme</h4>
                Phoneme indicates which students are in need of support in phonological awareness. Below this student
                table, in the Phoneme tab, you will find scores for subdomains of phonological awareness skills that can
                guide instruction. Phoneme has been validated, and national norms are provided. <br />
                <h4 class="font-bold">Letter</h4>
                Letter indicates which students are in need of support in letter names and sounds. Below this student
                table, in the Letter tab, you will find scores for subdomains of letter skills that can guide
                instruction. Letter has been validated, and raw scores are provided.
              </div>
            </template>
            <template v-if="selectedColumn === 'spanish'">
              <h3 class="font-bold">Spanish</h3>
              <div>
                Spanish-language versions of the assessments provide additional information for Spanish-speaking
                students. <br />
                <br />
                Spanish assessments are undergoing validation, and raw scores are provided. <br /><br />
                These scores will be included in the development of national norms and support categories.
              </div>
            </template>
            <template v-if="selectedColumn === 'spanishmath'">
              <h3 class="font-bold">Spanish Mathematics</h3>
              <div>
                Spanish-language mathematics assessments provide additional insight into areas such as arithmetic
                fluency, calculation ability, and mathematical procedures based on common core standards <br />
                <br />
                Mathematics assessments are undergoing validation, and raw scores are provided. <br /><br />
                These scores will be included in the development of national norms and support categories.
              </div>
            </template>
            <template v-else-if="selectedColumn === 'supplementary'">
              <h3 class="font-bold">Supplementary</h3>
              <div>
                Supplementary assessments provide additional insight into areas such as morphology, syntax, language
                comprehension, and rapid automatized naming. <br />
                <br />
                Supplementary assessments are undergoing validation, and raw scores are provided. <br /><br />
                These scores will be included in the development of national norms and support categories.
              </div>
            </template>
            <template v-else-if="selectedColumn === 'math'">
              <h3 class="font-bold">Mathematics</h3>
              <div>
                Mathematics assessments provide additional insight into areas such as arithmetic fluency, calculation
                ability, and mathematical procedures based on common core standards<br />
                <br />
                Mathematics assessments are undergoing validation, and raw scores are provided. <br /><br />
                These scores will be included in the development of national norms and support categories.
              </div>
            </template>
            <template v-else-if="selectedColumn === 'vision'">
              <h3 class="font-bold">Vision</h3>
              <div>
                Vision assessments provide additional insight into areas such as visual acuity and visual crowding.
                <br />
                <br />
                Vision assessments are undergoing validation, and raw scores are provided. <br /><br />
                These scores will be included in the development of national norms and support categories.
              </div>
            </template>
          </PvOverlayPanel>
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
                    class="border-none border-round bg-white text-primary p-2 hover:surface-200"
                    :label="colData.routeParams.buttonLabel"
                    :aria-label="col.routeTooltip"
                    :icon="col.routeIcon"
                    data-cy="route-button"
                    size="small"
                  />
                </router-link>
              </div>
              <div v-else-if="col.button">
                <PvButton
                  severity="secondary"
                  text
                  class="border-none border-round bg-white text-primary p-2 hover:surface-200"
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
              <div v-else>
                {{ _get(colData, col.field) }}
              </div>
            </template>
            <template v-if="col.dataType" #sorticon="{ sorted, sortOrder }">
              <i v-if="!sorted && currentSort.length === 0" class="pi pi-sort-alt ml-2" />
              <i v-if="sorted && sortOrder === 1" class="pi pi-sort-amount-down-alt ml-2" />
              <i v-else-if="sorted && sortOrder === -1" class="pi pi-sort-amount-up-alt ml-2" />
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
import PvCalendar from 'primevue/calendar';
import PvChip from 'primevue/chip';
import PvColumn from 'primevue/column';
import PvColumnGroup from 'primevue/columngroup';
import PvDataTable from 'primevue/datatable';
import PvDropdown from 'primevue/dropdown';
import PvInputNumber from 'primevue/inputnumber';
import PvInputText from 'primevue/inputtext';
import PvMultiSelect from 'primevue/multiselect';
import PvOverlayPanel from 'primevue/overlaypanel';
import PvTag from 'primevue/tag';
import PvTriStateCheckbox from 'primevue/tristatecheckbox';
import PvRow from 'primevue/row';
import { FilterMatchMode, FilterOperator } from 'primevue/api';
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
const padding = '1rem 1rem';

function increasePadding() {
  if (!countForVisualize.value) {
    document.documentElement?.style.setProperty('--padding-value', padding);
    rowViewMode.value = 'Compact View';
  } else {
    rowViewMode.value = 'Expand View';
    document.documentElement?.style.setProperty('--padding-value', '0 1.5rem 0 1.5rem');
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

const primaryTasks = [
  'scores.letter.percentCorrect',
  'scores.letter.percentile',
  'scores.letter-en-ca.percentCorrect',
  'scores.letter-en-ca.percentile',
  'scores.letter-en-ca.rawScore',
  'scores.pa.percentile',
  'scores.swr.percentile',
  'scores.sre.percentile',
  'scores.pa.standardScore',
  'scores.swr.standardScore',
  'scores.sre.standardScore',
  'scores.sre.rawScore',
  'scores.pa.rawScore',
  'scores.swr.rawScore',
  'scores.sre.rawScore',
];

const spanishTasks = [
  'scores.letter-es.percentCorrect',
  'scores.letter-es.percentile',
  'scores.pa-es.percentCorrect',
  'scores.swr-es.percentCorrect',
  'scores.sre-es.correctIncorrectDifference',
  'scores.pa-es.percentile',
  'scores.swr-es.percentile',
  'scores.sre-es.percentile',
  'scores.letter-es.rawScore',
  'scores.pa-es.rawScore',
  'scores.swr-es.rawScore',
  'scores.sre-es.rawScore',
];

const spanishMathTasks = [
  'scores.fluency-arf-es.numCorrect',
  'scores.fluency-calf-es.numCorrect',
  'scores.fluency-arf-es.percentile',
  'scores.fluency-calf-es.percentile',
];

const supplementaryTasks = [
  'scores.morphology.percentCorrect',
  'scores.cva.percentCorrect',
  'scores.vocab.percentCorrect',
  'scores.trog.percentCorrect',
  'scores.roar-inference.percentCorrect',
  'scores.phonics.percentCorrect',
  'scores.morphology.percentile',
  'scores.cva.percentile',
  'scores.vocab.percentile',
  'scores.trog.percentile',
  'scores.roar-inference.percentile',
  'scores.phonics.percentile',
];

const roamTasks = [
  'scores.fluency-arf.numCorrect',
  'scores.fluency-calf.numCorrect',
  'scores.roam-alpaca.percentile',
  'scores.egma-math.percentile',
  'scores.fluency-arf.numCorrect',
  'scores.fluency-calf.numCorrect',
  'scores.roam-alpaca.percentCorrect',
  'scores.egma-math.percentCorrect',
  'scores.fluency-calf.percentile',
  'scores.fluency-arf.percentile',
];

const roavTasks = [
  'scores.ran.percentile',
  'scores.crowding.percentile',
  'scores.roav-mep.percentile',
  'scores.mep.percentile',
  'scores.mep-pseudo.percentile',
  'scores.ran.percentCorrect',
  'scores.crowding.percentCorrect',
  'scores.roav-mep.percentCorrect',
  'scores.mep.percentCorrect',
  'scores.mep-pseudo.percentCorrect',
];
const getSpacerColumnWidth = computed(() => {
  // Look through computedColumns.value
  // Find first instance of a Spanish or supplementary or math or vision column
  // If found, return the index of that first column, return that as the length of the spacer row
  const columns = computedColumns.value;
  const allTasks = [
    ...primaryTasks,
    ...spanishTasks,
    ...spanishMathTasks,
    ...supplementaryTasks,
    ...roamTasks,
    ...roavTasks,
  ];
  for (let i = 0; i < columns.length; i++) {
    if (allTasks.includes(columns[i].field)) {
      return i + 1;
    }
  }
  return columns.length;
});

const primarySpacerColumns = computed(() => {
  // Return the number of the primary columns in computedColumns.value
  // Return 0 if no Spanish columns
  const columns = computedColumns.value;
  return columns.filter((column) => primaryTasks.includes(column.field)).length;
});

const spanishSpacerColumns = computed(() => {
  // Return the number of the spanish columns in computedColumns.value
  // Return 0 if no Spanish columns
  const columns = computedColumns.value;
  return columns.filter((column) => spanishTasks.includes(column.field)).length;
});

const spanishMathSpacerColumns = computed(() => {
  // Return the number of the spanish columns in computedColumns.value
  // Return 0 if no Spanish columns
  const columns = computedColumns.value;
  return columns.filter((column) => spanishMathTasks.includes(column.field)).length;
});

const supplementarySpacerColumns = computed(() => {
  // Return the number of supplementary columns in computedColumns.value
  const columns = computedColumns.value;
  return columns.filter((column) => supplementaryTasks.includes(column.field)).length;
});

const mathSpacerColumns = computed(() => {
  // Return the number of math columns in computedColumns.value
  const columns = computedColumns.value;
  return columns.filter((column) => roamTasks.includes(column.field)).length;
});

const visionSpacerColumns = computed(() => {
  // Return the number of vision columns in computedColumns.value
  const columns = computedColumns.value;
  return columns.filter((column) => roavTasks.includes(column.field)).length;
});

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

const op = ref();
const selectedColumn = ref(null);

const toggle = (event, column) => {
  selectedColumn.value = column;
  op.value.toggle(event);
};
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
</style>
