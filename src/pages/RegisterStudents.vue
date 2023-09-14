<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :actions="sidebarActions" />
    </aside>
    <section class="main-body">
      <!--Upload file section-->
      <div v-if="!isFileUploaded">
        <Panel header="Add Participants">
          The following fields are required for registering a student:
          <ul>
            <li>username</li>
            <li>date of birth</li>
            <li>grade</li>
            <li>password</li>
            <li>Either a group OR a district and school</li>
          </ul>
          Upload or drag-and-drop a student list below to begin!
        </Panel>
        <Divider />
        <FileUpload name="massUploader[]" customUpload @uploader="onFileUpload($event)" accept=".csv" auto
          :showUploadButton="false" :showCancelButton="false">
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
        <Panel header="Assigning participant data" class="mb-4">
          <p>Use the dropdowns below to properly assign each column. </p>
          <p>Columns that are not assigned will not be imported. But please note that a column has to be assigned for each
            of the required fields:</p>
          <ul>
            <li>email</li>
            <li>date of birth</li>
            <li>grade</li>
            <li>password</li>
          </ul>

          <Message severity="info" :closable="false">You can scroll left-to-right to see more columns</Message>
        </Panel>

        <div v-if="errorMessage" class="error-box">
          {{ errorMessage }}
        </div>
        <!-- Can't use RoarDataTable to accomodate header dropdowns -->
        <DataTable ref="dataTable" :value="rawStudentFile" showGridlines :rowHover="true" :resizableColumns="true"
          paginator :alwaysShowPaginator="false" :rows="10" class="datatable">
          <Column v-for="col of tableColumns" :key="col.field" :field="col.field">
            <template #header>
              <div class="col-header">
                <Dropdown v-model="dropdown_model[col.field]" :options="dropdown_options" optionLabel="label"
                  optionValue="value" optionGroupLabel="label" optionGroupChildren="items"
                  placeholder="What does this column describe?" />
              </div>
            </template>
          </Column>
        </DataTable>
        <div class="submit-container">
          <Button @click="submitStudents" label="Start Registration" :icon="activeSubmit ? 'pi pi-spin pi-spinner' : ''" :disabled="activeSubmit" />
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
          <DataTable ref="errorTable" :value="errorUsers" showGridlines exportFilename="error-datatable-export"
            :rowHover="true" :resizableColumns="true" paginator :alwaysShowPaginator="false" :rows="10" class="datatable">
            <Column v-for="col of errorUserColumns" :key="col.field" :field="col.field">
              <template #header>
                {{ col.header }}
              </template>
            </Column>
          </DataTable>
        </div>
      </div>

    </section>

  </main>
</template>
<script setup>
import { ref, toRaw } from 'vue';
import { csvFileToJson } from '@/helpers';
import _cloneDeep from 'lodash/cloneDeep';
import _chunk from 'lodash/chunk';
import _compact from 'lodash/compact';
import _find from 'lodash/find';
import _forEach from 'lodash/forEach'
import _includes from 'lodash/includes'
import _isEmpty from 'lodash/isEmpty';
import _omit from 'lodash/omit';
import _pick from 'lodash/pick';
import _set from 'lodash/set';
import _uniqBy from 'lodash/uniqBy';
import _startCase from 'lodash/startCase'
import { useAuthStore } from '@/store/auth';
import { useQueryStore } from '@/store/query';
import { useRouter } from 'vue-router';
// import RoarDataTable from '../components/RoarDataTable.vue';
import { storeToRefs } from 'pinia';
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import { getSidebarActions } from "../router/sidebarActions";
import { useToast } from "primevue/usetoast";

const authStore = useAuthStore();
const queryStore = useQueryStore();
const router = useRouter();
const { roarfirekit, isFirekitInit } = storeToRefs(authStore);
const toast = useToast();
const isFileUploaded = ref(false);
const rawStudentFile = ref({});

const sidebarActions = ref(getSidebarActions(authStore.isUserSuperAdmin(), true));

// Primary Table & Dropdown refs
const dataTable = ref();
const tableColumns = ref([])
const dropdown_model = ref({})
const dropdown_options = ref([
  {
    label: 'Required',
    items: [
      { label: 'Student Username', value: 'username' },
      // { label: 'Student Email', value: 'email' },
      { label: 'Grade', value: 'grade' },
      { label: 'Password', value: 'password' },
      { label: 'Student Date of Birth', value: 'dob' },
    ]
  },
  {
    label: 'Optional',
    items: [
      { label: 'Ignore this column', value: 'ignore' },
      { label: 'First Name', value: 'first' },
      { label: 'Middle Name', value: 'middle' },
      { label: 'Last Name', value: 'last' },
      { label: 'State ID', value: 'state_id' },
      { label: 'Gender', value: 'gender' },
      { label: 'English Language Level', value: 'ell_status' },
      { label: 'Free-Reduced Lunch', value: 'frl_status' },
      { label: 'IEP Status', value: 'iep_status' },
      { label: 'Hispanic Ethinicity', value: 'hispanic_ethnicity' },
      { label: 'Race', value: 'race' },
      { label: 'Home Language', value: 'home_language' },
      { label: 'Pid', value: 'pid' },
    ]
  },
  {
    label: 'Organizations',
    items: [
      { label: 'District', value: 'district' },
      { label: 'School', value: 'school' },
      { label: 'Class', value: 'uClass' }, // 'class' is a javascript keyword.
      { label: 'Group', value: 'group' }
    ]
  }
])

// Error Users Table refs
const errorTable = ref();
const errorUsers = ref([]);
const errorUserColumns = ref([]);
const errorMessage = ref("");
const showErrorTable = ref(false);

const activeSubmit = ref(false);
let processedUsers = 0;

// Selecting Orgs
let districts = [];
let schools = [];
let classes = [];
let groups = [];

// Functions supporting Selecting Orgs
const initFormFields = async () => {
  unsubscribe();
  // TODO: Optimize this with Promise.all or some such
  districts = await queryStore.getOrgs("districts");
  schools = await queryStore.getOrgs("schools");
  classes = await queryStore.getOrgs("classes");
  groups = await queryStore.getOrgs("groups");
}

const unsubscribe = authStore.$subscribe(async (mutation, state) => {
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
  toast.add({ severity: 'success', summary: 'Success', detail: 'File Successfully Uploaded', life: 3000 });
}

function populateDropdown(columns) {
  _forEach(columns, col => {
    dropdown_model.value[col.field] = ''
  })
}

function generateColumns(rawJson) {
  let columns = [];
  const columnValues = Object.keys(rawJson)
  _forEach(columnValues, col => {
    let dataType = (typeof rawJson[col])
    if (dataType === 'object') {
      if (rawJson[col] instanceof Date) dataType = 'date'
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

function checkUniqueStudents(students, field) {
  const uniqueStudents = _uniqBy(students, (student) => student[field])
  return (students.length === uniqueStudents.length)
}

async function submitStudents(rawJson) {
  // Reset error users
  errorUsers.value = [];
  errorUserColumns.value = [];
  showErrorTable.value = false;
  errorMessage.value = "";
  activeSubmit.value = true;
  const modelValues = _compact(Object.values(dropdown_model.value))
  // Check that all required values are filled in
  if (!_includes(modelValues, 'email') && !_includes(modelValues, 'username')) {
    // Username / email needs to be filled in
    errorMessage.value = "Please select a column to be user's username or email."
    activeSubmit.value = false;
    return;
  }
  if (!_includes(modelValues, 'dob')) {
    // Date needs to be filled in
    errorMessage.value = "Please select a column to be user's date of birth."
    activeSubmit.value = false;
    return;
  }
  if (!_includes(modelValues, 'grade')) {
    // Grade needs to be filled in
    errorMessage.value = "Please select a column to be user's grade."
    activeSubmit.value = false;
    return;
  }
  if (!_includes(modelValues, 'password')) {
    // Password needs to be filled in 
    errorMessage.value = "Please select a column to be user's password."
    activeSubmit.value = false;
    return;
  }
  if (
    ((!_includes(modelValues, 'district') && !_includes(modelValues, 'school')) || 
    (!_includes(modelValues, 'district') && _includes(modelValues, 'school')) || 
    (_includes(modelValues, 'district') && !_includes(modelValues, 'school'))) && 
    !_includes(modelValues, 'group')){
    // Requires either district and school, OR group
    errorMessage.value = "Please assign columns to be either a group OR a pair of district and school."
    activeSubmit.value = false;
    return;
  }
  let submitObject = []
  // Construct list of student objects, handle special columns
  _forEach(rawStudentFile.value, student => {
    let studentObj = {}
    let dropdownMap = _cloneDeep(dropdown_model.value)
    _forEach(modelValues, col => {
      const columnMap = getKeyByValue(dropdownMap, col)
      if (['ignore'].includes(col)) {
        return;
      }
      // Special fields will accept multiple columns, and concat the values in each column
      if (['race', 'home_language'].includes(col)) {
        if (!studentObj[col] && student[columnMap]) {
          studentObj[col] = [student[columnMap]]
          dropdownMap = _omit(dropdownMap, columnMap)
        } else if (student[columnMap]) {
          studentObj[col].push(student[columnMap])
          dropdownMap = _omit(dropdownMap, columnMap)
        }
      } else {
        studentObj[col] = student[columnMap]
      }
    })
    submitObject.push(studentObj)
  })
  // Check for duplicate username / emails 
  let authField;
  if(_includes(modelValues, 'username')) authField = 'username';
  else authField = 'email';
  const areUnique = checkUniqueStudents(submitObject, authField);
  if(!areUnique) {
    errorMessage.value = `One or more of the ${authField}s in this CSV are not unique.`
    activeSubmit.value = false;
    return;
  }
  // Begin submit process
  const totalUsers = submitObject.length;
  const chunkedSubmitObject = _chunk(submitObject, 10)
  for(let i = 0; i < chunkedSubmitObject.length; i++){
    const chunk = chunkedSubmitObject[i]
    _forEach(chunk, user => {
      // Handle Email Registration
      const { email, username, password, firstName, middleName, lastName, district, school, uClass, group, ...userData } = user;
      const computedEmail = email || `${username}@roar-auth.com`
      let sendObject = {
        email: computedEmail,
        password,
        userData
      }
      if (username) _set(sendObject, 'userData.username', username)
      if (firstName) _set(sendObject, 'userData.name.first', firstName)
      if (middleName) _set(sendObject, 'userData.name.middle', middleName)
      if (lastName) _set(sendObject, 'userData.name.last', lastName)

      // If district is a given column, check if the name is
      //   associated with a valid id. If so, add the id to
      //   the sendObject. If not, reject user
      if (district) {
        const id = getDistrictId(district);
        if (!_isEmpty(id)) {
          _set(sendObject, 'userData.district', id)
        } else {
          addErrorUser(user, `Error: District '${district}' is invalid`)
          if(processedUsers >= totalUsers){
            activeSubmit.value = false;
          }
          return;
        }
      }

      // If school is a given column, check if the name is
      //   associated with a valid id. If so, add the id to
      //   the sendObject. If not, reject user
      if (school) {
        const id = getSchoolId(school);
        if (!_isEmpty(id)) {
          _set(sendObject, 'userData.school', id)
        } else {
          addErrorUser(user, `Error: School '${school}' is invalid.`)
          if(processedUsers >= totalUsers){
            activeSubmit.value = false;
          }
          return;
        }
      }

      // If class is a given column, check if the name is
      //   associated with a valid id. If so, add the id to
      //   the sendObject. If not, reject user
      if (uClass) {
        const id = getClassId(uClass);
        if (!_isEmpty(id)) {
          _set(sendObject, 'userData.class', id)
        } else {
          addErrorUser(user, `Error: Class '${uClass}' is invalid.`)
          if(processedUsers >= totalUsers){
            activeSubmit.value = false;
          }
          return;
        }
      }

      // If group is a given column, check if the name is
      //   associated with a valid id. If so, add the id to
      //   the sendObject. If not, reject user
      if (group) {
        const id = getGroupId(group);
        if (!_isEmpty(id)) {
          _set(sendObject, 'userData.group', id)
        } else {
          addErrorUser(user, `Error: Group '${group}' is invalid.`)
          if(processedUsers >= totalUsers){
            activeSubmit.value = false;
          }
          return;
        }
      }

      authStore.registerWithEmailAndPassword(sendObject).then(() => {
        toast.add({ severity: 'success', summary: 'User Creation Success', detail: `${sendObject.email} was sucessfully created.`, life: 9000 });
        processedUsers = processedUsers + 1;
        if(processedUsers >= totalUsers){
          activeSubmit.value = false;
          if(errorUsers.value.length === 0) {
            // Processing is finished, and there are no error users.
            router.push({ name: "Home" })
          }
        }
      }).catch((e) => {
        toast.add({ severity: 'error', summary: 'User Creation Failed', detail: 'Please see error table below.', life: 3000 });
        addErrorUser(user, e)
        if(processedUsers >= totalUsers){
          activeSubmit.value = false;
        }
      })
    })
    await delay(1250)
  }
}

function delay(milliseconds){
  console.log('delay function has been called')
  return new Promise(resolve => {
      setTimeout(resolve, milliseconds);
  });
}


// Support functions for submitStudents process
function addErrorUser(user, error) {
  // If there are no error users yet, generate the
  //  columns before displaying the table.
  if (_isEmpty(errorUserColumns.value)) {
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
  processedUsers = processedUsers + 1;
}

// Find the district id given the name. undefined if missing.
function getDistrictId(districtName) {
  return _pick(_find(districts, (district) => {
    return district.name === districtName;
  }), ['id', 'abbreviation'])
}

// Find the school id given the name. undefined if missing.
function getSchoolId(schoolName) {
  return _pick(_find(schools, (school) => {
    return school.name === schoolName;
  }), ['id', 'abbreviation'])
}

// Find the class id given the name. undefined if missing.
function getClassId(className) {
  return _pick(_find(classes, (c) => {
    return c.name === className;
  }), ['id', 'abbreviation'])
}

// Find the group id given the name. undefined if missing.
function getGroupId(groupName) {
  return _pick(_find(groups, (group) => {
    return group.name === groupName;
  }), ['id', 'abbreviation'])
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