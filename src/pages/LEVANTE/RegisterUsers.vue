<template>
  <main class="container main">
    <section class="main-body">
      <!--Upload file section-->
      <RegisterUsersInfo />

      <PvDivider />

      <div v-if="!isFileUploaded" class="text-gray-500 mb-2 surface-100 border-round p-2">
        <PvFileUpload
          v-if="!isFileUploaded"
          name="massUploader[]"
          custom-upload
          accept=".csv"
          class="bg-primary mb-2 p-3 w-2 text-white border-none border-round h-3rem m-0 hover:bg-red-900"
          auto
          :show-upload-button="false"
          :show-cancel-button="false"
          @uploader="onFileUpload($event)"
        >
          <template #empty>
            <div class="flex justify-center items-center text-gray-500">
              <p>Click choose or drag and drop files to here to upload.</p>
            </div>
          </template>
        </PvFileUpload>
      </div>

      <div v-if="isFileUploaded && !errorMissingColumns && !errorUsers.length">
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
          <PvColumn v-for="col of allFields" :key="col.field" :field="col.field">
            <template #header>
              <div class="col-header">
                <b>{{ col.header }}</b>
              </div>
            </template>
          </PvColumn>
        </PvDataTable>

        <div class="submit-container">
          <PvButton
            v-if="registeredUsers.length"
            label="Download Users"
            @click="downloadCSV"
            class="bg-primary mb-2 p-3 w-2 text-white border-none border-round h-3rem m-0 hover:bg-red-900"
            icon="pi pi-download"
          />
          <PvButton
            v-else
            :label="activeSubmit ? 'Registering Users' : 'Start Registration'"
            :icon="activeSubmit ? 'pi pi-spin pi-spinner' : ''"
            :disabled="activeSubmit"
            @click="submitUsers"
            class="bg-primary mb-2 p-3 w-2 text-white border-none border-round h-3rem m-0 hover:bg-red-900"
          />
        </div>
      </div>

      <!-- Datatable of error students -->
      <div v-if="showErrorTable" class="error-container">
        <div class="error-header">
          <h3>Rows with Errors</h3>
        </div>
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
    </section>
  </main>
</template>

<script setup>
import { ref, toRaw, watch, nextTick } from 'vue';
import { csvFileToJson } from '@/helpers';
import _cloneDeep from 'lodash/cloneDeep';
import _forEach from 'lodash/forEach';
import _isEmpty from 'lodash/isEmpty';
import _startCase from 'lodash/startCase';
import { useToast } from 'primevue/usetoast';
import RegisterUsersInfo from '@/components/LEVANTE/RegisterUsersInfo.vue';
import { useAuthStore } from '@/store/auth';
import { pluralizeFirestoreCollection } from '@/helpers';
import { fetchOrgByName } from '@/helpers/query/orgs';

const authStore = useAuthStore();
const toast = useToast();
const isFileUploaded = ref(false);
const rawUserFile = ref({});
const registeredUsers = ref([]);

// Primary Table & Dropdown refs
const dataTable = ref();

const requiredFields = ['id', 'userType', 'month', 'year', 'group'];
const allFields = [
  {
    field: 'id',
    header: 'ID',
    dataType: 'number',
  },
  {
    field: 'userType',
    header: 'User Type',
    dataType: 'string',
  },
  {
    field: 'parentId',
    header: 'Parent ID',
    dataType: 'number',
  },
  {
    field: 'childId',
    header: 'Child ID',
    dataType: 'number',
  },
  {
    field: 'teacherId',
    header: 'Teacher ID',
    dataType: 'number',
  },
  {
    field: 'month',
    header: 'Month',
    dataType: 'number',
  },
  {
    field: 'year',
    header: 'Year',
    dataType: 'number',
  },
  {
    field: 'group',
    header: 'Group',
    dataType: 'string',
  },
];

// Error Users Table refs
const errorTable = ref();
const errorUsers = ref([]);
const errorUserColumns = ref([]);
const errorMessage = ref('');
const showErrorTable = ref(false);
const errorMissingColumns = ref(false);

const activeSubmit = ref(false);

watch(
  errorUsers,
  () => {
    // Scroll to bottom of page after error table is displayed
    // Using nextTick to ensure the error table is rendered otherwise the scroll
    // happens before the table is rendered
    nextTick(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
  },
  { deep: true },
);

// Functions supporting the uploader
const onFileUpload = async (event) => {
  // Reset in case of previous error
  rawUserFile.value = {};
  errorUsers.value = [];
  errorUserColumns.value = [];
  showErrorTable.value = false;
  errorMessage.value = '';
  errorTable.value = null;
  errorMissingColumns.value = false;

  rawUserFile.value = await csvFileToJson(event.files[0]);

  // Check uploaded CSV has required columns
  // eslint-disable-next-line no-prototype-builtins
  const missingColumns = requiredFields.filter((col) => !rawUserFile.value[0].hasOwnProperty(col));
  if (missingColumns.length > 0) {
    toast.add({
      severity: 'error',
      summary: 'Error: Missing Columns: ' + missingColumns.join(', '),
      life: 5000,
    });
    errorMissingColumns.value = true;
    return;
  }

  const careGiverRequiredFields = ['id', 'userType', 'group'];

  // check each user's required fields are not empty
  rawUserFile.value.forEach((user) => {
    // If user is not a child we dont need to check for month and year
    if (user.userType?.toLowerCase() === 'parent' || user.userType?.toLowerCase() === 'teacher') {
      const missingFields = careGiverRequiredFields.filter((field) => !user[field]);
      if (missingFields.length > 0) {
        addErrorUser(user, `Missing Field(s): ${missingFields.join(', ')}`);
      }
    } else {
      const missingFields = requiredFields.filter((field) => !user[field]);
      if (missingFields.length > 0) {
        addErrorUser(user, `Missing Field(s): ${missingFields.join(', ')}`);
      }
    }
  });

  if (errorUsers.value.length) {
    toast.add({
      severity: 'error',
      summary: 'Error: Missing Fields. See below for details.',
      life: 5000,
    });
  }

  // TODO: Check that links are correct if parent / teacher users exist

  if (!missingColumns.length && !errorUsers.value.length) {
    isFileUploaded.value = true;
    errorMissingColumns.value = false;
    showErrorTable.value = false;
    toast.add({ severity: 'success', summary: 'Success', detail: 'File Successfully Uploaded', life: 3000 });
  }
};

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

async function submitUsers() {
  // Reset error users
  activeSubmit.value = true;
  errorUsers.value = [];
  errorUserColumns.value = [];
  showErrorTable.value = false;
  errorMessage.value = '';

  // Group needs to be an array of strings

  const usersToBeRegistered = _cloneDeep(rawUserFile.value);

  for (const user of usersToBeRegistered) {
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
        addErrorUser(user, `Error: Group '${groupName}' does not exist`);
      } else {
        user.group = groupInfo.map((group) => group.id);
      }
    }
  }

  const submitUsersList = [...toRaw(usersToBeRegistered)];

  // Begin submit process
  // Org must be created before users can be created

  try {
    const res = await authStore.createLevanteUsers(submitUsersList);
    toast.add({
      severity: 'success',
      summary: 'User Creation Success',
      life: 9000,
    });

    activeSubmit.value = false;
    registeredUsers.value = res.data.data;

    // add the account info to the existing csv data
    rawUserFile.value.forEach((user, index) => {
      user.email = registeredUsers.value[index].user.email;
      user.password = registeredUsers.value[index].user.password;
      user.uid = registeredUsers.value[index].uid;
    });

    convertUsersToCSV();
  } catch (error) {
    console.error(error);

    toast.add({
      severity: 'error',
      summary: 'Error registering users: ' + error.message,
      life: 9000,
    });

    activeSubmit.value = false;
  }
}

const csvBlob = ref(null);
const csvURL = ref(null);

function convertUsersToCSV() {
  const headerObj = toRaw(rawUserFile.value[0]);

  // Convert Objects to CSV String
  const csvHeader = Object.keys(headerObj).join(',') + '\n';
  const csvRows = rawUserFile.value
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
  const filename = 'registered-users.csv';

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

// TODO: Refactor this to be a single call

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
</script>

<style scoped>
.extra-height {
  min-height: 33vh;
}

.optional-fields {
  margin-bottom: 2rem;
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

.p-fileupload-content {
  display: none;
}
</style>
