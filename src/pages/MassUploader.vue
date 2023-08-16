<template>
  <div class="page-container">
    <!--Upload file section-->
    <div v-if="!isFileUploaded">
      <div class="info-box">
        We need the following information for each student to register: 
        <ul>
          <li>email (required)</li>
          <li>date of birth (required)</li>
          <li>grade (required)</li>
          <li>password</li>
        </ul>
        Upload or drag-and-drop a student list below to begin!
      </div>
      <FileUpload 
        name="massUploader[]"
        customUpload
        @uploader="onFileUpload($event)"
        accept=".csv"
        auto
        :showUploadButton="false"
        :showCancelButton="false"
      >
        <template #empty>
          <div class="extra-height">
            <p>Drag and drop files to here to upload.</p>
          </div>
        </template>
      </FileUpload>
    </div>
    <!--DataTable with raw Student-->
    <div v-if="isFileUploaded">
      <!-- <RoarDataTable :columns="tableColumns" :data="rawStudentFile" :allowExport="false" /> -->
      <div class="info-box">
        Please identify what the columns describe. Please note, the only REQUIRED fields are:
        <ul>
          <li>email</li>
          <li>date of birth</li>
          <li>grade</li>
          <li>password</li>
        </ul>
        Not all columns must be used, however a column has to be selected for each required field.
      </div>
      <div v-if="errorMessage" class="error-box">
      {{ errorMessage }}
    </div>
      <!-- Can't use RoarDataTable to accomodate header dropdowns -->
      <DataTable 
        ref="dataTable" 
        :value="rawStudentFile"
        showGridlines
        :rowHover="true"
        :resizableColumns="true"
        paginator
        :alwaysShowPaginator="false"
        :rows="10"
        class="datatable"
      >
        <Column 
          v-for="col of tableColumns" 
          :key="col.field" 
          :field="col.field"
        >
          <template #header>
            <div class="col-header">
              <Dropdown 
                v-model="dropdown_model[col.field]" 
                :options="dropdown_options" 
                optionLabel="label"
                optionValue="value"
                optionGroupLabel="label"
                optionGroupChildren="items"
                placeholder="What does this column describe?" 
              />
            </div>
          </template>
        </Column>
      </DataTable>
      <div class="submit-container">
        
        <Button @click="submitStudents">
          Start Registration
        </Button>
      </div>
      <!-- Datatable of error students -->
      <!-- Temporary until I move RoarDataTable's data preprocessing to computed hooks -->
      <DataTable
        v-if="showErrorTable"
        :value="errorUsers"
        showGridlines
        :rowHover="true"
        :resizableColumns="true"
        paginator
        :alwaysShowPaginator="false"
        :rows="10"
        class="datatable"
      >
        <Column v-for="col of errorUserColumns" :key="col.field" :field="col.field">
          <template #header>
            {{ col.header }}
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>
<script setup>
import { ref, toRaw } from 'vue';
import { csvFileToJson } from '@/helpers';
import _forEach from 'lodash/forEach'
import _startCase from 'lodash/startCase'
import _includes from 'lodash/includes'
import _get from 'lodash/get';
import _set from 'lodash/set';
import _isEmpty from 'lodash/isEmpty';
import _compact from 'lodash/compact';
import _cloneDeep from 'lodash/cloneDeep';
import _omit from 'lodash/omit';
import { useAuthStore } from '@/store/auth';
import RoarDataTable from '../components/RoarDataTable.vue';

const authStore = useAuthStore();
const isFileUploaded = ref(false)
const rawStudentFile = ref({})

// Primary Table & Dropdown refs
const dataTable = ref();
const tableColumns = ref([])
const dropdown_model = ref({})
const dropdown_options = ref([
  {
    label: 'Required',
    items: [
      {label: 'Student Username', value: 'username'},
      {label: 'Student Email', value: 'email'},
      {label: 'Grade', value: 'grade'},
      {label: 'Password', value: 'password'},
      {label: 'Student Date of Birth', value: 'dob'},
    ]
  },
  {
    label: 'Optional',
    items: [
      {label: 'Race', value: 'race'},
      {label: 'Student First Name', value: 'first'},
      {label: 'Student Middle Name', value: 'middle'},
      {label: 'Student Last Name', value: 'last'},
      {label: 'English Language Level', value: 'ell'},
    ]
  },
])

// Error Users Table refs
const errorUsers = ref([]);
const errorUserColumns = ref([]);
const errorMessage = ref("");
const showErrorTable = ref(false);

const onFileUpload = async (event) => {
  rawStudentFile.value = await csvFileToJson(event.files[0])
  tableColumns.value = generateColumns(toRaw(rawStudentFile.value[0]))
  populateDropdown(tableColumns.value)
  isFileUploaded.value = true;
}

function populateDropdown(columns) {
  _forEach(columns, col => {
    dropdown_model.value[col.field] = ''
  })
}

function generateColumns(rawJson){
  let columns = [];
  const columnValues = Object.keys(rawJson)
  _forEach(columnValues, col => {
    let dataType = (typeof rawJson[col])
    if(dataType === 'object'){
      if(rawJson[col] instanceof Date) dataType = 'date'
    }
    columns.push({
      field: col,
      header: _startCase(col),
      dataType: dataType
    })
  })
  return columns
}

function getKeyByValue(object, value) {
  return Object.keys(object).find(key => object[key] === value);
}

function submitStudents(rawJson){
  errorMessage.value = "";
  const modelValues = _compact(Object.values(dropdown_model.value))
  // Check that all required values are filled in
  if(!_includes(modelValues, 'email') && !_includes(modelValues, 'username')){
    // Username / email needs to be filled in
    errorMessage.value = "Please select a column to be user's username or email."
    return;
  }
  if(!_includes(modelValues, 'dob')){
    // Date needs to be filled in
    errorMessage.value = "Please select a column to be user's date of birth."
    return;
  }
  if(!_includes(modelValues, 'grade')){
    // Grade needs to be filled in
    errorMessage.value = "Please select a column to be user's grade."
    return;
  }
  if(!_includes(modelValues, 'password')){
    // Password needs to be filled in 
    errorMessage.value = "Please select a column to be user's password."
    return;
  }
  let submitObject = []
  _forEach(rawStudentFile.value, student => {
    let studentObj = {}
    let dropdownMap = _cloneDeep(dropdown_model.value)
    _forEach(modelValues, col => {
      const columnMap = getKeyByValue(dropdownMap, col)
      // Special fields will accept multiple columns, and concat the values in each column
      if(['race'].includes(col)){
        if(!studentObj[col] && student[columnMap]){
          studentObj[col] = [student[columnMap]]
          dropdownMap = _omit(dropdownMap, columnMap)
        } else if(student[columnMap]) {
          studentObj[col].push(student[columnMap])
          dropdownMap = _omit(dropdownMap, columnMap)
        }
      } else {
        studentObj[col] = student[columnMap]
      }
    })
    submitObject.push(studentObj)
  })
  console.log('Submit Object', submitObject)
  _forEach(submitObject, user => {
    // Handle Email Registration
    const { email, username, password, firstName, middleName, lastName, ...userData } = user;
    const computedEmail = email || `${username}@roar-auth.com`
    let sendObject = {
      email: computedEmail, 
      password,
      userData
    }
    if(firstName) _set(sendObject, 'userData.name.first', firstName)
    if(middleName) _set(sendObject, 'userData.name.middle', middleName)
    if(lastName) _set(sendObject, 'userData.name.last', lastName)

    authStore.registerWithEmailAndPassword(sendObject).then(() => {
      console.log('sucessful user creation')
    }).catch((e) => {
      if(_isEmpty(errorUserColumns.value)){
        errorUserColumns.value = generateColumns(user)
        showErrorTable.value = true
      }
      errorUsers.value.push(user)
    })
  })
}

// Event listener for the 'beforeunload' event
window.addEventListener('beforeunload', (e) => {
  console.log('handler for beforeunload')
  e.preventDefault();
});
</script>
<style scoped>
.page-container {
  padding: 2rem;
}
.extra-height {
  min-height: 33vh;
}
.info-box {
  padding: 0.5rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  background-color: var(--surface-b);
  border-radius: 5px;
  border: 1px solid var(--surface-d);
}
.error-box {
  padding: 0.5rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  background-color: var(--red-300);
  border-radius: 5px;
  border: 1px solid var(--red-600);
  color: var(--red-600);
  font-weight: bold;
}
.col-header {
  display: flex;
  flex-direction: column;
}
.submit-container {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.error {
  color: red;
}
.datatable {
  border: 1px solid var(--surface-d);
  border-radius: 5px;
}
</style>