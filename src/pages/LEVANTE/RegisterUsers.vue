<template>
  <main class="container main">
    <section class="main-body">
      <!--Upload file section-->
      <div v-if="!isFileUploaded">
        <PvPanel header="Register users">
          <div class="info-message-container">
            <i class="pi pi-exclamation-circle"></i>
            <p>A Group (Organization) must be created before registering users. You cannot register users otherwise.</p>
          </div>
          These fields are <b>REQUIRED</b> for registering users:

          <ul>
            <li><b>id</b> - The unique identifier for the user. Start from 1.</li>
            <li><b>userType</b> - The type of user. Must be one of the following: child, parent, teacher.</li>
            <li><b>month</b> - The month of the year the user was born.</li>
            <li><b>year</b> - The year the user was born.</li>
            <li><b>group</b> - The name of the group.</li>
          </ul>

          These fields are optional, <b>HOWEVER</b>, you <i>must</i> use them if you want to link children with thier
          parents and teachers:

          <ul class="optional-fields">
            <li><b>childId</b> - The unique identifier for the child. Start from 1.</li>
            <li><b>parentId</b> - The unique identifier for the parent. Start from 1.</li>
            <li><b>teacherId</b> - The unique identifier for the teacher. Start from 1.</li>
          </ul>

          Below is an example of what your CSV/spreadsheet could look like. Note that you may upload a CSV with any
          columns you need, but those not required for registration can be ignored during processing by selecting the
          "Ignore this column" option.

          <img
            id="example-image"
            src="https://storage.googleapis.com/road-dashboard/example_researcher_csv.png"
            alt="CSV upload example"
          />
        </PvPanel>
        <PvDivider />
        <PvFileUpload
          name="massUploader[]"
          custom-upload
          accept=".csv"
          auto
          :show-upload-button="false"
          :show-cancel-button="false"
          @uploader="onFileUpload($event)"
        >
          <template #empty>
            <div class="extra-height">
              <p>Drag and drop files here <b>or</b> click choose to upload.</p>
            </div>
          </template>
        </PvFileUpload>
      </div>
      <!--DataTable with raw Student-->
      <!-- && !returnedData.length -->
      <div v-if="isFileUploaded">
        <!-- <RoarDataTable :columns="tableColumns" :data="rawUserFile" :allowExport="false" /> -->
        <PvPanel header="Assigning user data" class="mb-4">
          <p>Use the dropdowns below to properly assign each column.</p>
          <p>
            Columns that are not assigned will not be imported. But please note that a column has to be assigned for
            each of the required fields:
          </p>
          <ul>
            <li><b>id</b> - The unique identifier for the user. Start from 1.</li>
            <li><b>teacherId</b> - The unique identifier for the teacher. Start from 1.</li>
            <li><b>month</b> - The month of the year the user was born.</li>
            <li><b>year</b> - The year the user was born.</li>
            <li><b>group</b> - The name of the group.</li>
          </ul>

          <PvMessage severity="info" :closable="false">You can scroll left-to-right to see more columns</PvMessage>
        </PvPanel>

        <div v-if="errorMessage" class="error-box">
          {{ errorMessage }}
        </div>
        <!-- Can't use RoarDataTable to accomodate header dropdowns -->
        <PvDataTable
          ref="dataTable"
          :value="rawUserFile"
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
                  v-model="dropdownSelections[col.field]"
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
          <PvButton
            v-if="returnedData.length"
            label="Download Registered Users"
            @click="addAccountToCSV(returnedData)"
          />
          <PvButton
            v-else
            :label="activeSubmit ? 'Registering Users' : 'Start Registration'"
            :icon="activeSubmit ? 'pi pi-spin pi-spinner' : ''"
            :disabled="activeSubmit"
            @click="submitUsers"
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
import { ref, toRaw } from 'vue';
import { csvFileToJson } from '@/helpers';
import _cloneDeep from 'lodash/cloneDeep';
import _compact from 'lodash/compact';
import _forEach from 'lodash/forEach';
import _isEmpty from 'lodash/isEmpty';
import _startCase from 'lodash/startCase';
import _every from 'lodash/every';
import _includes from 'lodash/includes';
import { useAuthStore } from '@/store/auth';
import { useToast } from 'primevue/usetoast';
import { pluralizeFirestoreCollection } from '@/helpers';
import { fetchOrgByName } from '@/helpers/query/orgs';

const authStore = useAuthStore();
const toast = useToast();
const isFileUploaded = ref(false);
const rawUserFile = ref({});
const returnedData = ref([]);

// Primary Table & Dropdown refs
const dataTable = ref();
const tableColumns = ref([]);
const dropdownSelections = ref({});
const dropdownOptions = ref([
  {
    label: 'Required',
    items: [
      { label: 'ID', value: 'id' },
      { label: 'User Type', value: 'userType' },
      { label: 'Month', value: 'month' },
      { label: 'Year', value: 'year' },
      { label: 'Group', value: 'group' },
    ],
  },
  {
    label: 'Optional',
    items: [
      { label: 'Child ID', value: 'childId' },
      { label: 'Parent ID', value: 'parentId' },
      { label: 'Teacher ID', value: 'teacherId' },
      { label: 'Ignore this column', value: 'ignore' },
    ],
  },
]);
const requiredFields = ['id', 'userType', 'month', 'year', 'group'];

// Error Users Table refs
const errorTable = ref();
const errorUsers = ref([]);
const errorUserColumns = ref([]);
const errorMessage = ref('');
const showErrorTable = ref(false);

const activeSubmit = ref(false);

// Functions supporting the uploader
const onFileUpload = async (event) => {
  rawUserFile.value = await csvFileToJson(event.files[0]);
  tableColumns.value = generateColumns(toRaw(rawUserFile.value[0]));
  populateDropdown(tableColumns.value);
  isFileUploaded.value = true;
  toast.add({ severity: 'success', summary: 'Success', detail: 'File Successfully Uploaded', life: 3000 });
};

function populateDropdown(columns) {
  _forEach(columns, (col) => {
    dropdownSelections.value[col.field] = '';
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

function containsRequiredFields(subset, superset) {
  return _every(subset, (element) => _includes(superset, element));
}

async function submitUsers() {
  // Reset error users
  activeSubmit.value = true;
  errorUsers.value = [];
  errorUserColumns.value = [];
  showErrorTable.value = false;
  errorMessage.value = '';
  // activeSubmit.value = true;
  const selections = _compact(Object.values(dropdownSelections.value));
  // Check that all required dropdowns are selected.
  const _selections = selections.sort();
  const _requiredFields = requiredFields.sort();
  if (!containsRequiredFields(_requiredFields, _selections)) {
    errorMessage.value = 'Please assign a single column to each of the required fields.';
    activeSubmit.value = false;
    return;
  }

  let submitUsersList = [];

  // TODO: Do we need this for LEVANTE?
  // Construct list of user objects, handle special columns
  _forEach(rawUserFile.value, (user) => {
    let individualUser = {};
    let dropdownMap = _cloneDeep(dropdownSelections.value);
    _forEach(selections, (col) => {
      const columnMap = getKeyByValue(dropdownMap, col);
      if (['ignore'].includes(col)) {
        return;
      }
      individualUser[col] = user[columnMap];
    });
    submitUsersList.push(individualUser);
  });

  // Begin submit process
  // Org must be created before users can be created

  // Check if the org (group) actually exists
  for (const user of submitUsersList) {
    const validUserTypes = ['child', 'teacher', 'parent'];

    // Changed to adding group info to all three types. if (user.userType.toLowerCase() === 'child') {
    if (validUserTypes.includes(user.userType.toLowerCase())) {
      const groupNames = user.group.split(',');
      for (const groupName of groupNames) {
        const groupInfo = await getOrgId(
          pluralizeFirestoreCollection('group'),
          groupName,
          ref(undefined),
          ref(undefined),
        );
        // TODO: Check this logic
        if (_isEmpty(groupInfo)) {
          addErrorUser(user, `Error: ${'group'} '${groupName}' is invalid`);
        } else {
          user.group = groupInfo.map((group) => group.id);
        }
      }
    }
  }

  try {
    // showErrorTable.value = true;
    // throw new Error('test');

    const res = await authStore.createLevanteUsers(submitUsersList);
    toast.add({
      severity: 'success',
      summary: 'User Creation Success',
      life: 9000,
    });
    console.log('Users created successfully response: ', res);
    activeSubmit.value = false;

    returnedData.value = res.data.data;

    // add the account info to the existing csv data
    rawUserFile.value.forEach((user, index) => {
      user.email = res.data.data[index].user.email;
      user.password = res.data.data[index].user.password;
    });

    convertUsersToCSV();
  } catch (error) {
    console.error(error);

    toast.add({
      severity: 'error',
      summary: 'User Creation Failed. See below for details.',
      life: 9000,
    });

    activeSubmit.value = false;
  }
}

function convertUsersToCSV() {
  const filename = 'registered-users.csv';
  const headerObj = toRaw(rawUserFile.value[0]);

  // Convert Objects to CSV String
  const csvHeader = Object.keys(headerObj).join(',') + '\n'; // Get header from keys of first object
  const csvRows = rawUserFile.value
    .map((obj) =>
      Object.values(obj)
        .map((value) => {
          if (value === null || value === undefined) return ''; // Handle null/undefined values
          return `"${value.toString().replace(/"/g, '""')}"`; // Handle values containing commas or quotes
        })
        .join(','),
    )
    .join('\n');

  const csvString = csvHeader + csvRows;

  // Create Blob from CSV String
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });

  // Create Download Link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link); // Required for Firefox

  // Trigger the Download
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function addErrorUser(user, error) {
  // If there are no error users yet, generate the
  //  columns before displaying the table.
  if (_isEmpty(errorUserColumns.value)) {
    errorUserColumns.value = generateColumns(user);
    errorUserColumns.value.unshift({
      dataType: 'string',
      field: 'error',
      header: 'Cause of Error',
    });
    showErrorTable.value = true;
  }
  // Concat the userObject with the error reason.
  errorUsers.value.push({
    ...user,
    error,
  });
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
  // Array of objects. Ex: [{abbreviation: 'LVT', id: 'lut54353jkler'}]
  const orgs = await fetchOrgByName(orgType, orgName, parentDistrict, parentSchool);

  if (orgs.length === 0) {
    throw new Error(`No organizations found for ${orgType} '${orgName}'`);
  }

  orgIds.value[orgType][orgName] = orgs;

  console.log('orgs: ', orgs);

  return orgs;
};

// Functions supporting error table
function downloadErrorTable() {
  errorTable.value.exportCSV();
}
</script>

<style scoped>
.extra-height {
  min-height: 33vh;
}

.info-message-container {
  display: flex;
  background-color: rgb(252, 252, 218);
  border: 2px solid rgb(228, 206, 7);
  border-radius: 0.5rem;
  color: rgb(199, 180, 7);
  margin-bottom: 1rem;

  p {
    font-weight: bold;
    margin: 1rem 1rem 1rem 0;
  }

  i {
    margin: 1rem;
  }
}

.optional-fields {
  margin-bottom: 2rem;
}

#example-image {
  width: 100%;
  border-radius: 0.5rem;
  margin-top: 0.5rem;
}

/* .info-box {
  padding: 0.5rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  background-color: var(--surface-b);
  border-radius: 5px;
  border: 1px solid var(--surface-d);
} */

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
