<template>
  <main class="container main">
    <section class="main-body">
      <div class="flex flex-column gap-2">
        <div class="flex align-items-center flex-wrap gap-3 mb-2">
          <i class="pi pi-users text-gray-400 rounded" style="font-size: 1.6rem" />
          <div class="admin-page-header">Add Participants</div>
        </div>
        <div class="flex flex-column text-md text-gray-500 ml-6 gap-2">
          <div>Add participants by uploading a CSV.</div>
          <div>
            The following fields are required for registering a student:
            <ul>
              <li>username</li>
              <li>date of birth</li>
              <li>grade</li>
              <li>password</li>
              <li>Either a group OR a district and school</li>
            </ul>
            Upload or drag-and-drop a student list below to begin!
          </div>
        </div>
      </div>
      <!--Upload file section-->
      <div v-if="!isFileUploaded" class="text-gray-500 mb-7 surface-100 border-round-top-md">
        <PvDivider />
        <PvFileUpload
          name="massUploader[]"
          class="bg-primary mb-2 ml-2 p-3 w-1 text-white border-none border-round h-3rem m-0 hover:bg-red-900"
          custom-upload
          accept=".csv"
          auto
          :show-upload-button="false"
          :show-cancel-button="false"
          @uploader="onFileUpload($event)"
        >
          <template #empty>
            <div class="extra-height ml-6 text-gray-500">
              <p>Drag and drop files to here to upload.</p>
            </div>
          </template>
        </PvFileUpload>
      </div>
      <!--DataTable with raw Student-->
      <div v-if="isFileUploaded">
        <!-- <RoarDataTable :columns="tableColumns" :data="rawStudentFile" :allowExport="false" /> -->
        <PvPanel header="Assigning participant data" class="mb-4">
          <p>Use the dropdowns below to properly assign each column.</p>
          <p>
            Columns that are not assigned will not be imported. But please note that a column has to be assigned for
            each of the required fields:
          </p>
          <ul>
            <li>email</li>
            <li>date of birth</li>
            <li>grade</li>
            <li>password</li>
            <li>Either a group OR a district and school</li>
          </ul>

          <PvMessage severity="info" :closable="false">You can scroll left-to-right to see more columns</PvMessage>
        </PvPanel>

        <div v-if="errorMessage" class="error-box">
          {{ errorMessage }}
        </div>
        <!-- Can't use RoarDataTable to accomodate header dropdowns -->
        <PvDataTable
          ref="dataTable"
          :value="rawStudentFile"
          show-gridlines
          :row-hover="true"
          :resizable-columns="true"
          paginator
          :always-show-paginator="false"
          :rows="10"
          class="datatable"
        >
          <PvColumn v-for="col of tableColumns" :key="col.field" :field="col.field">
            <template #header>
              <div class="col-header">
                <PvDropdown
                  v-model="dropdownModel[col.field]"
                  :options="dropdownOptions"
                  option-label="label"
                  option-value="value"
                  option-group-label="label"
                  option-group-children="items"
                  placeholder="What does this column describe?"
                />
              </div>
            </template>
          </PvColumn>
        </PvDataTable>
        <div class="submit-container">
          <div class="m-2">
            <PvCheckbox v-model="isAllTestData" :binary="true" input-id="isTestData" />
            <label for="isTestData" class="ml-2">All users are test accounts</label>
          </div>
          <PvButton
            label="Start Registration"
            class="bg-primary text-white border-none border-round p-2 hover:bg-red-900"
            :icon="activeSubmit ? 'pi pi-spin pi-spinner' : ''"
            :disabled="activeSubmit"
            style="margin-bottom: 4rem"
            data-cy="button-start-registration"
            @click="submitStudents"
          />
        </div>
        <!-- Datatable of error students -->
        <div v-if="showErrorTable" class="error-container">
          <div class="error-header">
            <h3>Error Users</h3>
            <PvButton @click="downloadErrorTable($event)"> Download Table </PvButton>
          </div>
          <!-- Temporary until I move RoarDataTable's data preprocessing to computed hooks -->
          <PvDataTable
            ref="errorTable"
            :value="errorUsers"
            show-gridlines
            export-filename="error-datatable-export"
            :row-hover="true"
            :resizable-columns="true"
            paginator
            :always-show-paginator="false"
            :rows="10"
            class="datatable"
          >
            <PvColumn v-for="col of errorUserColumns" :key="col.field" :field="col.field">
              <template #header>
                {{ col.header }}
              </template>
            </PvColumn>
          </PvDataTable>
        </div>
      </div>
    </section>
  </main>
</template>
<script setup>
import { ref, toRaw, onMounted } from 'vue';
import { csvFileToJson } from '@/helpers';
import _cloneDeep from 'lodash/cloneDeep';
import _compact from 'lodash/compact';
import _forEach from 'lodash/forEach';
import _includes from 'lodash/includes';
import _isEmpty from 'lodash/isEmpty';
import _omit from 'lodash/omit';
import _set from 'lodash/set';
import _uniqBy from 'lodash/uniqBy';
import _startCase from 'lodash/startCase';
import _sortBy from 'lodash/orderBy';
import _find from 'lodash/find';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { pluralizeFirestoreCollection } from '@/helpers';
import { fetchOrgByName } from '@/helpers/query/orgs';

const authStore = useAuthStore();
const toast = useToast();
const isFileUploaded = ref(false);
const rawStudentFile = ref({});
const isAllTestData = ref(false);
const registeredUsers = ref([]);

const { roarfirekit } = storeToRefs(authStore);

// Primary Table & Dropdown refs
const dataTable = ref();
const tableColumns = ref([]);
const dropdownModel = ref({});
const dropdownOptions = ref([
  {
    label: 'Required',
    items: [
      // { label: 'Student Username', value: 'username' },
      { label: 'Grade', value: 'grade' },
      // { label: 'Password', value: 'password' },
      { label: 'Student Date of Birth', value: 'dob' },
    ],
  },
  {
    label: 'Optional',
    items: [
      { label: 'Ignore this column', value: 'ignore' },
      { label: 'Student Email', value: 'email' },
      { label: 'TestData', value: 'testData' },
      { label: 'First Name', value: 'firstName' },
      { label: 'Middle Name', value: 'middleName' },
      { label: 'Last Name', value: 'lastName' },
      { label: 'Unenroll', value: 'unenroll' },
      { label: 'State ID', value: 'state_id' },
      { label: 'Gender', value: 'gender' },
      { label: 'English Language Learner', value: 'ell_status' },
      { label: 'Free-Reduced Lunch', value: 'frl_status' },
      { label: 'IEP Status', value: 'iep_status' },
      { label: 'Hispanic Ethinicity', value: 'hispanic_ethnicity' },
      { label: 'Race', value: 'race' },
      { label: 'Home Language', value: 'home_language' },
      { label: 'Pid', value: 'pid' },
    ],
  },
  {
    label: 'Organizations',
    items: [
      { label: 'District', value: 'district' },
      { label: 'School', value: 'school' },
      { label: 'Class', value: 'uClass' }, // 'class' is a javascript keyword.
      { label: 'Group', value: 'group' },
    ],
  },
]);

const requiredColumns = ['grade', 'dob'];


// Error Users Table refs
const errorTable = ref();
const errorUsers = ref([]);
const errorUserColumns = ref([]);
const errorMessage = ref('');
const showErrorTable = ref(false);
const errorMissingColumns = ref(false);

const activeSubmit = ref(false);
let processedUsers = 0;

// Functions supporting the uploader
const onFileUpload = async (event) => {
  rawStudentFile.value = await csvFileToJson(event.files[0]);
  tableColumns.value = generateColumns(toRaw(rawStudentFile.value[0]));
  populateDropdown(tableColumns.value);

  const columns = toRaw(rawStudentFile.value[0])
  console.log('columns: ', columns);
  // Check uploaded CSV has required columns
  const missingColumns = requiredColumns.filter((col) => !(col in columns));

  if (
    !('group' in columns) && 
    !('district' in columns && 'school' in columns)
  ) {
    missingColumns.push('group or district and school');
  }

  if (missingColumns.length > 0) {
    toast.add({
      severity: 'error',
      summary: 'ERROR: Missing Columns: ' + missingColumns.join(', '),
      life: 5000,
    });
    errorMissingColumns.value = true;
    return;
  }

  const requiredFields = dropdownOptions.value[0].items.map((item) => item.value);

  rawStudentFile.value.forEach((user) => {
    const missingFields = [];

    // Check for required fields
    requiredFields.forEach((field) => {
      if (!user[field.toLocaleLowerCase()]) {
        missingFields.push(field);
      }
    });

    // Check for group or district and school
    if (!user.group) {
      if (!user.district || !user.school) {
        missingFields.push('group or district and school');
      }
    }

    // Add error if any required fields are missing
    if (missingFields.length > 0) {
      addErrorUser(user, `Missing Field(s): ${missingFields.join(', ')}`);
    }
  });

  if (errorUsers.value.length) {
      toast.add({
        severity: 'error',
        summary: 'Error: Missing Fields. See below for details.',
        life: 5000,
      });
  }

  if (!missingColumns.length && !errorUsers.value.length) {
      isFileUploaded.value = true;
      errorMissingColumns.value = false;
      showErrorTable.value = false;
      toast.add({ severity: 'success', summary: 'Success', detail: 'File Successfully Uploaded', life: 3000 });
    }
};

function populateDropdown(columns) {
  _forEach(columns, (col) => {
    dropdownModel.value[col.field] = '';
  });
}

function generateColumns(rawJson) {
  let columns = [];
  const columnValues = Object.keys(rawJson);
  _forEach(columnValues, (col) => {
    let dataType = typeof rawJson[col];
    if (dataType === 'object') {
      if (rawJson[col] instanceof Date) dataType = 'date';
    }
    columns.push({
      field: col,
      header: _startCase(col),
      dataType: dataType,
    });
  });
  return columns;
}

function getKeyByValue(object, value) {
  return Object.keys(object).find((key) => object[key] === value);
}


async function submitStudents() {
  // Reset error users
  errorUsers.value = [];
  errorUserColumns.value = [];
  showErrorTable.value = false;
  errorMessage.value = '';
  activeSubmit.value = true;
  const modelValues = _compact(Object.values(dropdownModel.value));

  let usersWithEmailOffset = 0

  // may need toRaw
  const studentsToBeRegistered = _sortBy(_cloneDeep(rawStudentFile.value), (student) => {
    if(student.email) usersWithEmailOffset += 1;
    return student.email
  });
  console.log('studentsToBeRegistered: ', studentsToBeRegistered);
  console.log('usersWithEmailOffset: ', usersWithEmailOffset);
  // Construct list of student objects, handle special columns
  for (const student of studentsToBeRegistered) {
    const { district, school, _class, group: groups, } = student;

    student.testData = isAllTestData.value;

    let dropdownMap = _cloneDeep(dropdownModel.value);
    _forEach(modelValues, (col) => {
      const columnMap = getKeyByValue(dropdownMap, col);
      if (['ignore'].includes(col)) {
        return;
      }
      // Special fields will accept multiple columns, and concat the values in each column
      if (['race', 'home_language'].includes(col)) {
        if (!student[col] && student[columnMap]) {
          student[col] = [student[columnMap]];
          dropdownMap = _omit(dropdownMap, columnMap);
        } else if (student[columnMap]) {
          student[col].push(student[columnMap]);
          dropdownMap = _omit(dropdownMap, columnMap);
        }
      } else if (['testData'].includes(col)) {
        if (student[columnMap]) {
          student['testData'] = true;
        }
      } else {
        student[col] = student[columnMap];
      }
    });

    const orgNameMap = {
      district: district,
      school: school,
      class: _class?.split(','),
      group: groups?.split(','),
    };

    // If orgType is a given column, check if the name is
    //   associated with a valid id. If so, add the id to
    //   the sendObject. If not, reject user
    const totalUsers = studentsToBeRegistered.length;
    for (const [orgType, orgName] of Object.entries(orgNameMap)) {
        if (orgName) {
          let orgInfo = {
            district: [],
            school: [],
            class: [],
            group: [],
          };

          if (orgType === 'school') {
            const { id: districtId } = await getOrgId('districts', district);
            try {
              const orgIds = await getOrgId(pluralizeFirestoreCollection(orgType), orgName, ref(districtId), ref(undefined))
              // Need to Raw it because a large amount of users causes this to become a proxy object
              orgInfo['school'] = orgIds.map(orgData => toRaw(orgData).id);
            } catch (error) {
              addErrorUser(student, error.message);
            }
          } else if (orgType === 'class') {
            // Collect errors
            const orgErrors = [];
            for (const aClass of orgNameMap.class) {
              try {
                const { id: districtId } = await getOrgId('districts', district);
                const { id: schoolId } = await getOrgId('schools', school);
                const orgIds = await getOrgId(pluralizeFirestoreCollection(orgType), aClass, ref(districtId), ref(schoolId));
                orgInfo.class.push(...orgIds.map(orgData => toRaw(orgData).id));
              } catch (error) {
                orgErrors.push(error.message);
              }
            }
            
            if (orgErrors.length > 0) {
              addErrorUser(student, `Error(s): ${orgErrors.join(', ')}`);
            }
          } else if (orgType === 'group') {
            const orgErrors = [];
            for (const group of orgNameMap.group) {
              try {
                const orgId = await getOrgId(pluralizeFirestoreCollection(orgType), group, ref(undefined), ref(undefined));
                console.log('orgId for group: ', orgId);
                orgInfo.group.push(...orgId.map(orgData => toRaw(orgData).id));
              } catch (error) {
                orgErrors.push(error.message);
              }

              if (orgErrors.length > 0) {
                addErrorUser(student, `Error(s): ${orgErrors.join(', ')}`);
              }
            }
          } else {
              try {
                console.log('Fetching orgId for', orgType, orgName);
                const orgIds = await getOrgId(pluralizeFirestoreCollection(orgType), orgName, ref(undefined), ref(undefined));
                console.log('OrgIds fetched:', orgIds);
                orgInfo['district'] = orgIds.map(orgData => toRaw(orgData).id);
                console.log('District info added to orgInfo');
              } catch (error) {
                console.error('Error caught in main try-catch:', error);
                addErrorUser(student, error.message);
                console.log('addErrorUser called successfully');
              }
              console.log('Continuing after try-catch block');
          }

          student.orgIds = orgInfo;
        }
      }
  };

  if (errorUsers.value.length) {
    toast.add({
      severity: 'error',
      summary: 'ERROR: There was a problem validating your organizations. See below for details.',
      life: 5000,
    });
    return;
  }

  // Begin submit process
  const chunkedStudents = _chunk(studentsToBeRegistered, 700);

  console.log('chunkedStudents: ', chunkedStudents);

  let processedUserCount = 0;
  for (const users of chunkedStudents) {
    try {
      const res = await authStore.createUsers(users);
      const currentRegisteredUsers = res.data.data;
      
      // Update only the newly registered users
      currentRegisteredUsers.forEach((registeredUser, index) => {
        const rawUserIndex = usersWithEmailOffset + processedUserCount + index;
        if (rawUserIndex < rawStudentFile.value.length) {
          rawStudentFile.value[rawUserIndex].email = registeredUser.email;
          rawStudentFile.value[rawUserIndex].password = registeredUser.password;
          rawStudentFile.value[rawUserIndex].uid = registeredUser.uid;
          rawStudentFile.value[rawUserIndex].username = registeredUser.username
        }
      });

      // Check if were gonna use this
      registeredUsers.value.push(...currentRegisteredUsers);
      
      // Update the count of processed users
      processedUserCount += currentRegisteredUsers.length;

    } catch (error) {
      // TODO: Show users that failed to register
      console.error(error.message);
  
      toast.add({
        severity: 'error',
        summary: 'Error registering users: ' + error.message,
        life: 9000,
      });
    }
  }

  activeSubmit.value = false;
  toast.add({
    severity: 'success',
    summary: 'User Creation Success',
    life: 9000,
  });
  
  convertUsersToCSV();
}

const csvBlob = ref(null);
const csvURL = ref(null);

function convertUsersToCSV() {
  const headerObj = toRaw(rawStudentFile.value[0]);

  // Convert Objects to CSV String
  const csvHeader = Object.keys(headerObj).join(',') + '\n';
  const csvRows = rawStudentFile.value
    .map((obj) =>
      Object.values(obj)
        .map((value) => {
          if (value === null || value === undefined) return '';
          return `"${value.toString().replace(/"/g, '""')}"`;
        })
        .join(','),
    )
    .join('\n');

  const csvString = csvHeader + csvRows;

  // Create Blob from CSV String
  csvBlob.value = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });

  // Create URL from Blob
  csvURL.value = URL.createObjectURL(csvBlob.value);

  // Initiate download
  downloadCSV();
}

function downloadCSV() {
  const filename = 'registered-students.csv';

  if (csvURL.value) {
    // Create Download Link
    const link = document.createElement('a');
    link.setAttribute('href', csvURL.value);
    link.setAttribute('download', filename);
    document.body.appendChild(link); // Required for Firefox

    // Trigger the Download
    link.click();

    // Cleanup
    document.body.removeChild(link);
  }
}


// Support functions for submitStudents process
function addErrorUser(user, error) {
  console.log('Entering addErrorUser function');
  try {
    // If there are no error users yet, generate the
    //  columns before displaying the table.
    if (_isEmpty(errorUserColumns.value)) {
      console.log('Generating error user columns');
      errorUserColumns.value = generateColumns(user);
      errorUserColumns.value.unshift({
        dataType: 'string',
        field: 'error',
        header: 'Cause of Error',
      });
      showErrorTable.value = true;
    }
    
    console.log('Adding error user to errorUsers');
    // Concat the userObject with the error reason.
    errorUsers.value.push({
      ...user,
      error,
    });
    
    console.log('Error user added successfully');
  } catch (internalError) {
    console.error('Error in addErrorUser function:', internalError);
  }
}

const orgIds = ref({
  districts: {},
  schools: {},
  classes: {},
  groups: {},
});

const getOrgId = async (orgType, orgName, parentDistrict, parentSchool) => {
  if (orgIds.value[orgType][orgName]) return orgIds.value[orgType][orgName];

  // Currently we don't supply selectedDistrict or selectedSchool
  const orgs = await fetchOrgByName(orgType, orgName, parentDistrict, parentSchool);
  const orgsWithIds = orgs.map((org) => org.id);
  // TODO: If multiple orgs are returned display an org selection modal to the user.
  if (orgs.length > 1) {
    throw new Error(`Multiple organizations found for ${orgType} '${orgName}'`);
  }
  if (orgs.length === 0) {
    throw new Error(`No organizations found for ${orgType} '${orgName}'`);
  }

  orgIds.value[orgType][orgName] = orgs[0];
  return orgsWithIds;
};

// Functions supporting error table
function downloadErrorTable() {
  errorTable.value.exportCSV();
}

// Event listener for the 'beforeunload' event
// window.addEventListener('beforeunload', (e) => {
//   console.log('handler for beforeunload')
//   e.preventDefault();
// });

// +-----------------------------------+
// | Handle roarfirekit initialization |
// +-----------------------------------+

const refreshing = ref(false);
const initialized = ref(false);
let unsubscribe;
const refresh = () => {
  refreshing.value = true;
  if (unsubscribe) unsubscribe();

  refreshing.value = false;
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.createUpdateUser) refresh();
});

onMounted(async () => {
  if (roarfirekit.value.createUpdateUser) {
    refresh();
  }
});
</script>
<style scoped>
.extra-height {
  min-height: 33vh;
}
.p-checkbox-box.p-highlight {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.p-fileupload-buttonbar {
  padding: 1.5rem !important;
  background-color: gainsboro !important;
  border-radius: 20px !important;
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
g {
  margin-left: 0.5rem;
  color: white;
}
</style>
