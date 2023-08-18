<template>
  <div class="page-container">
    <router-link :to="{ name: 'Home' }">
      <Button style="margin-bottom: 1rem;" icon="pi pi-angle-left" label="Return to Dashboard" />
    </router-link>
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

      <h3>Define what each column describes</h3>
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
      <div v-if="showErrorTable" class="error-container">
        <div class="error-header">
          <h3>Error Users</h3>
          <Button @click="downloadErrorTable($event)">
            Download Table
          </Button>
        </div>
        <!-- Temporary until I move RoarDataTable's data preprocessing to computed hooks -->
        <DataTable
          ref="errorTable"
          :value="errorUsers"
          showGridlines
          exportFilename="error-datatable-export"
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
import _find from 'lodash/find';
import { useAuthStore } from '@/store/auth';
import { useQueryStore } from '@/store/query';

const authStore = useAuthStore();
const queryStore = useQueryStore();
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
      {label: 'Ignore this column', value: 'ignore'},
      {label: 'First Name', value: 'first'},
      {label: 'Middle Name', value: 'middle'},
      {label: 'Last Name', value: 'last'},
      {label: 'State ID', value: 'state_id'},
      {label: 'Gender', value: 'gender'},
      {label: 'English Language Level', value: 'ell_status'},
      {label: 'Free-Reduced Lunch', value: 'frl_status'},
      {label: 'IEP Status', value: 'iep_status'},
      {label: 'Hispanic Ethinicity', value: 'hispanic_ethnicity'},
      {label: 'Race', value: 'race'},
      {label: 'Home Language', value: 'home_language'},
      {label: 'Pid', value: 'pid'},
    ]
  },
  {
    label: 'Organizations',
    items: [
      {label: 'District', value: 'district'},
      {label: 'School', value: 'school'},
      {label: 'Class', value: 'uClass'}, // 'class' is a javascript keyword.
      {label: 'Study', value: 'study'}
    ]
  }
])

// Error Users Table refs
const errorTable = ref();
const errorUsers = ref([]);
const errorUserColumns = ref([]);
const errorMessage = ref("");
const showErrorTable = ref(false);

// Selecting Orgs
let districts = [];
let schools = [];
let classes = [];
let studies = [];

// Functions supporting Selecting Orgs
const initFormFields = async () => {
  console.log('inside init form fields')
  unsubscribe();
  // TODO: Optimize this with Promise.all or some such
  districts = await queryStore.getOrgs("districts");
  schools = await queryStore.getOrgs("schools");
  classes = await queryStore.getOrgs("classes");
  studies = await queryStore.getOrgs("studies");
}

const unsubscribe = authStore.$subscribe(async (mutation, state) => {
  console.log('inside subscribe function')
  if (state.roarfirekit.getOrgs && state.roarfirekit.isAdmin()) {
    await initFormFields();
  }
});

// Functions supporting the uploader
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
      if(['ignore'].includes(col)){
        return;
      }
      // Special fields will accept multiple columns, and concat the values in each column
      if(['race', 'home_language'].includes(col)){
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
    const { email, username, password, firstName, middleName, lastName, district, school, uClass, study, ...userData } = user;
    const computedEmail = email || `${username}@roar-auth.com`
    let sendObject = {
      email: computedEmail, 
      password,
      userData
    }
    if(firstName) _set(sendObject, 'userData.name.first', firstName)
    if(middleName) _set(sendObject, 'userData.name.middle', middleName)
    if(lastName) _set(sendObject, 'userData.name.last', lastName)

    // If district is a given column, check if the name is
    //   associated with a valid id. If so, add the id to
    //   the sendObject. If not, reject user
    if(district){
      const id = getDistrictId(district);
      if(id){
        _set(sendObject, 'userData.district', id)
      } else {
        addErrorUser(user, `Error: District '${district}' is invalid`)
        return;
      }
    }

    // If school is a given column, check if the name is
    //   associated with a valid id. If so, add the id to
    //   the sendObject. If not, reject user
    if(school){
      const id = getSchoolId(school);
      if(id){
        _set(sendObject, 'userData.school', id)
      } else {
        addErrorUser(user, `Error: School '${school}' is invalid.`)
        return;
      }
    }

    // If class is a given column, check if the name is
    //   associated with a valid id. If so, add the id to
    //   the sendObject. If not, reject user
    if(uClass){
      const id = getClassId(uClass);
      if(id){
        _set(sendObject, 'userData.class', id)
      } else {
        addErrorUser(user, `Error: Class '${uClass}' is invalid.`)
        return;
      }
    }

    // If study is a given column, check if the name is
    //   associated with a valid id. If so, add the id to
    //   the sendObject. If not, reject user
    if(study){
      const id = getStudyId(study);
      if(id){
        _set(sendObject, 'userData.study', id)
      } else {
        addErrorUser(user, `Error: Study '${study}' is invalid.`)
        return;
      }
    }

    console.log('user sendObject', sendObject)
    authStore.registerWithEmailAndPassword(sendObject).then(() => {
      console.log('sucessful user creation')
    }).catch((e) => {
      addErrorUser(user, e)
    })
  })
}


// Support functions for submitStudents process
function addErrorUser(user, error) {
  // If there are no error users yet, generate the
  //  columns before displaying the table.
  if(_isEmpty(errorUserColumns.value)){
    errorUserColumns.value = generateColumns(user)
    errorUserColumns.value.unshift({
      dataType: 'string',
      field: 'error',
      header: 'Cause of Error',
    })
    showErrorTable.value = true
  }
  // Concat the userObject with the error reason.
  errorUsers.value.push({
    ...user,
    error
  })
}

// Find the district id given the name. undefined if missing.
function getDistrictId(districtName){
  return _get(_find(districts, (district) => {
    return district.name === districtName;
  }), 'id')
}

// Find the school id given the name. undefined if missing.
function getSchoolId(schoolName){
  return _get(_find(schools, (school) => {
    return school.name === schoolName;
  }), 'id')
}

// Find the class id given the name. undefined if missing.
function getClassId(className){
  return _get(_find(classes, (c) => {
    return c.name === className;
  }), 'id')
}

// Find the study id given the name. undefined if missing.
function getStudyId(studyName){
  return _get(_find(studies, (study) => {
    return study.id === studyName;
  }), 'id')
}

// Functions supporting error table
function downloadErrorTable() {
  errorTable.value.exportCSV()
}

// Event listener for the 'beforeunload' event
// window.addEventListener('beforeunload', (e) => {
//   console.log('handler for beforeunload')
//   e.preventDefault();
// });
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
  margin-top: 1rem;
}
.error {
  color: red;
}
.datatable {
  border: 1px solid var(--surface-d);
  border-radius: 5px;
}

.error-container {
  margin-top: 1rem;
}
.error-header {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding-bottom: 0.5rem;
}

.orgs-container { 
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  margin-top: -1rem;
  margin-bottom: 1rem;
}

.org-dropdown {
  margin-right: 3rem;
  margin-top: 2rem;
}
</style>