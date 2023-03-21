<template>
  <div v-if="!data">
    <SkeletonTable />
  </div>
  <div v-else>
    {{ columns }}
    ---
    {{ filters }}
    <DataTable 
      :value="refData" 
      :rowHover="true" 
      :reorderableColumns="true" 
      :resizableColumns="true"
      v-model:selection="selectedRuns"
      removableSort
      sortMode="multiple"
      showGridlines
      v-model:filters="refFilters"
      filterDisplay="menu"
    >
      <Column 
        selectionMode="multiple" 
        headerStyle="width: 3rem"
      ></Column>
      <Column 
        v-for="col of columns" 
        :key="col.field" 
        :header="col.header" 
        :field="col.field"
        :dataType="col.dataType"
        :sortable="(col.sort !== false)"
        :showFilterMatchModes="!col.useMultiSelect"
      >
        <template v-if="col.dataType" #filter="{ filterModel }">
          <InputText 
            v-if="col.dataType === 'text' && !col.useMultiSelect"
            type="text" v-model="filterModel.value" 
            class="p-column-filter" 
            placeholder="Search" 
          />
          <MultiSelect 
            v-if="col.useMultiSelect"
            v-model="filterModel.value" 
            :options="refOptions[col.field]" 
            placeholder="Any"
            :showToggleAll="false" 
            class="p-column-filter" 
          />
          <Calendar 
            v-if="col.dataType === 'date' && !col.useMultiSelect"
            v-model="filterModel.value" 
            dateFormat="mm/dd/yy" 
            placeholder="mm/dd/yyyy" 
          />
        </template>
      </Column>
    </DataTable>
  </div>
</template>
<script setup>
import { ref } from 'vue';
import SkeletonTable from "@/components/SkeletonTable.vue"
import _get from 'lodash/get'
import _map from 'lodash/map'
import _forEach from 'lodash/forEach'
import _find from 'lodash/find'
import _filter from 'lodash/filter'
import _toUpper from 'lodash/toUpper'
import { FilterMatchMode, FilterOperator } from "primevue/api";

const props = defineProps({
  columns: Array, //TODO: this will be required eventually
  data: {type: Array, required: true},
  allowExport: {type: Boolean, default: false}
})
console.log(props)

let selectedRuns;

/*
Using the DataTable
Required Props: Columns, Data
Optional Props: --
Columns:
Array of objects consisting of a field and header at minimum.
- Field must match the key of the entry in the data object.
- Header is the string that is displayed at the top of the column.
- Sort (optional) is a boolean field that determines whether sorting
      is to be allowed on the field. If it is not present, defaults to true.
- 
*/
const columns = [
  {
    "field": "roarUid", 
    "header": "Roar Id", 
    "sort": true, 
    "allowMultipleFilters": true,
    "dataType": "text"
  },
  {
    "field": "runId", 
    "header": "Run Id", 
    "sort": false, 
    "allowMultipleFilters": true,
    "dataType": "text"
  },
  {
    "field": "completed", 
    "header": "Completed"
  },
  {
    "field": "task",
    "header": "Task ID",
    "allowMultipleFilters": false,
    "useMultiSelect": true,
    "dataType": "text"
  },
  //TODO if header isn't supplied, camel case the field
  {
    "field": "timeStarted",
    "header": "Time Started",
    "sort": true,
    "dataType": "date"
  }
]

const valid_dataTypes = ['NUMERIC', 'TEXT', 'DATE']
let filters = {}
let options = {}
_forEach(columns, column => {
  const dataType = _toUpper(_get(column, 'dataType'))
  let returnMatchMode = null
  if(valid_dataTypes.includes(dataType)){
    if(dataType === 'NUMERIC'){
      returnMatchMode = { value: null, matchMode: FilterMatchMode.EQUALS}
    } else if(dataType === 'TEXT'){
      returnMatchMode = { value: null, matchMode: FilterMatchMode.STARTS_WITH}
    } else if(dataType === 'DATE'){
      returnMatchMode = { value: null, matchMode: FilterMatchMode.DATE_IS}
    }
    
    if(_get(column, 'useMultiSelect')){
      returnMatchMode = { value: null, matchMode: FilterMatchMode.IN}
      options[column.field] = getUniqueOptions(column)
    }
  }
  if(_get(column, 'allowMultipleFilters') === true && returnMatchMode){
    filters[column.field] = {
      operator: FilterOperator.AND,
      constraints: [returnMatchMode]
    }
  } else if(returnMatchMode) {
    filters[column.field] = returnMatchMode
  }
})
console.log('options', options)
const refOptions = ref(options)
const refFilters = ref(filters)

// Grab list of fields defined as dates
let dateFields = _filter(columns, col => _toUpper(col.dataType) === 'DATE')
dateFields = _map(dateFields, col => col.field)

let computedData = _forEach(props.data, entry => {
  // Clean up date fields to use Date objects
  _forEach(dateFields, field => {
    let dateEntry = _get(entry, field)
    entry[field] = new Date(dateEntry)
  })
})
const refData = ref(computedData)

function getUniqueOptions(column){
  const field = _get(column, 'field')
  console.log('got field', field)
  let options = []
  console.log('column from function', field)
  console.log('accessing data', props.data)
  _forEach(props.data, entry => {
    console.log('checking entry', entry)
    if(!options.includes(entry[field])){
      console.log('pushing', entry[field])
      options.push(entry[field])
    }
  })
  console.log('final options', options)
  return options
}
</script>