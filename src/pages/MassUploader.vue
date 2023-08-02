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
      <DataTable 
        ref="dataTable" 
        :value="rawStudentFile"
        showGridlines
        :rowHover="true"
        :resizableColumns="true"
        paginator
        :alwaysShowPaginator="false"
        :rows="10"
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
import _set from 'lodash/set'
import { useAuthStore } from '@/store/auth'
const authStore = useAuthStore();
const isFileUploaded = ref(false)
const rawStudentFile = ref({})
const tableColumns = ref([])
const dropdown_model = ref({})
const dropdown_options = ref([
  {label: 'Student First Name', value: 'firstName'},
  {label: 'Student Middle Name', value: 'middleName'},
  {label: 'Student Last Name', value: 'lastName'},
  {label: 'Student Username', value: 'username'},
  {label: 'Student Email', value: 'email'},
  {label: 'Student Date of Birth', value: 'dob'},
  {label: 'English Language Level', value: 'ell'},
  {label: 'Grade', value: 'grade'},
  {label: 'Password', value: 'password'}
])
const dataTable = ref();
const onFileUpload = async (event) => {
  rawStudentFile.value = await csvFileToJson(event.files[0])
  // console.log(rawStudentFile.value)
  generateColumns(toRaw(rawStudentFile.value))
  isFileUploaded.value = true;

  // console.log(toRaw(rawStudentFile.value))
  // console.log(Object.keys(toRaw(rawStudentFile.value)[0]))
}

function generateColumns(rawJson){
  const columnValues = Object.keys(rawJson[0])
  _forEach(columnValues, col => {
    let dataType = (typeof rawJson[0][col])
    if(dataType === 'object'){
      if(rawJson[0][col] instanceof Date) dataType = 'date'
    }
    tableColumns.value.push({
      field: col,
      header: _startCase(col),
      dataType: dataType
    })
    dropdown_model.value[col] = ''
  })
}

function getKeyByValue(object, value) {
  return Object.keys(object).find(key => object[key] === value);
}

function submitStudents(rawJson){
  const modelValues = Object.values(dropdown_model.value)
  // Check that all required values are filled in
  if(!_includes(modelValues, 'email') && !_includes(modelValues, 'username')){
    // Username / email needs to be filled in
    console.log('username/password not filled in')
  }
  if(!_includes(modelValues, 'dob')){
    // Date needs to be filled in
    console.log('age not filled in')
  }
  if(!_includes(modelValues, 'grade')){
    // Grade needs to be filled in
    console.log('grade not filled in')
  }
  if(!_includes(modelValues, 'password')){
    // Password needs to be filled in 
    console.log('password not filled in')
  }
  let submitObject = []
  _forEach(rawStudentFile.value, student => {
    let studentObj = {}
    _forEach(modelValues, col => {
      const columnMap = getKeyByValue(dropdown_model.value, col)
      studentObj[col] = student[columnMap]
    })
    submitObject.push(studentObj)
  })
  console.log('Submit Object', submitObject)
  _forEach(submitObject, user => {
    // Handle Email Registration
    if(_get(user, 'email')){
      const { email, password, firstName, middleName, lastName, ...userData } = user;
      let sendObject = {
        email, 
        password,
        userData
      }
      if(firstName) _set(sendObject, 'userData.name.first', firstName)
      if(middleName) _set(sendObject, 'userData.name.middle', middleName)
      if(lastName) _set(sendObject, 'userData.name.last', lastName)
      console.log('Registering Student with:', sendObject)
      try {
        authStore.registerWithEmailAndPassword(sendObject)
      } catch(e) {
        // TODO: 
        console.log('Error - ', e)
      }
    } else {
      // Handle Username Registration
    }
  })
}
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
</style>