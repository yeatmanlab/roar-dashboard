<template>
  <main class="container main">
    <section class="main-body">
      <EditUsersInfo />

      <div v-if="!isFileUploaded" class="text-gray-500 mb-2 surface-100 border-round p-2 mt-5">
        <PvFileUpload
          name="editUsersUploader[]"
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

      <div v-if="isFileUploaded && !errorUsers.length">
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
            v-if="!editSuccess"
            :label="activeSubmit ? 'Editing Users' : 'Start Editing'"
            :icon="activeSubmit ? 'pi pi-spin pi-spinner' : ''"
            :disabled="activeSubmit"
            class="bg-primary mb-2 p-3 w-2 text-white border-none border-round h-3rem m-0 hover:bg-red-900"
            @click="submitEdits"
          />
          <PvButton
            v-if="editSuccess"
            label="Reset Form"
            icon="pi pi-refresh"
            class="p-button-secondary mb-2 p-3 w-2 border-round h-3rem m-0"
            @click="resetForm"
          />
        </div>
      </div>

      <div v-if="showErrorTable" class="error-container">
        <div class="error-header">
          <h3>Rows with Errors</h3>
          <PvButton label="Reset Form" icon="pi pi-refresh" class="p-button-secondary" @click="resetForm" />
        </div>
        <PvDataTable
          ref="errorTable"
          :value="errorUsers"
          show-gridlines
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
import { ref, toRaw } from 'vue';
import { csvFileToJson } from '@/helpers';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '@/store/auth';
import EditUsersInfo from '@/components/userInfo/EditUsersInfo.vue';
import PvButton from 'primevue/button';
import PvColumn from 'primevue/column';
import PvDataTable from 'primevue/datatable';
import PvFileUpload from 'primevue/fileupload';
import _forEach from 'lodash/forEach';
import _startCase from 'lodash/startCase';
import _isEmpty from 'lodash/isEmpty';
import { TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';
const authStore = useAuthStore();
const toast = useToast();
const isFileUploaded = ref(false);
const rawUserFile = ref([]);
const errorUsers = ref([]);
const errorUserColumns = ref([]);
const activeSubmit = ref(false);
const showErrorTable = ref(false);
const editSuccess = ref(false);

// EDIT USERS
// Required: uid
// Allowed to edit: month, year, district, school, class, group

const allFields = [
  {
    field: 'uid',
    header: 'UID',
    dataType: 'string',
  },
  {
    field: 'month',
    header: 'Month',
    dataType: 'string',
  },
  {
    field: 'year',
    header: 'Year',
    dataType: 'string',
  },
  {
    field: 'group',
    header: 'Group',
    dataType: 'string',
  },
  {
    field: 'district',
    header: 'Site',
    dataType: 'string',
  },
  {
    field: 'school',
    header: 'School',
    dataType: 'string',
  },
  {
    field: 'class',
    header: 'Class',
    dataType: 'string',
  },
];

const onFileUpload = async (event) => {
  showErrorTable.value = false;
  // Read the file as text
  const file = event.files[0];
  const text = await file.text();

  // Split into lines
  const lines = text.split('\n');

  // Lowercase all columns in header
  const headers = lines[0].split(',');
  lines[0] = headers.map((header) => header.toLowerCase()).join(',');

  // Create a new Blob with modified content
  const modifiedFile = new Blob([lines.join('\n')], { type: file.type });

  // Parse the modified file
  rawUserFile.value = await csvFileToJson(modifiedFile);

  const allColumns = Object.keys(toRaw(rawUserFile.value[0])).map((col) => col.toLowerCase());

  // Check if the required column is present
  const hasUid = allColumns.includes('uid');

  if (!hasUid) {
    toast.add({
      severity: 'error',
      summary: 'Error: Missing Column',
      detail: 'Missing required column: uid',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
    return;
  }

  // Check if at least one editable field is present
  const editableFields = ['month', 'year', 'district', 'school', 'class', 'group'];
  const hasEditableField = editableFields.some((field) => allColumns.includes(field));

  if (!hasEditableField) {
    toast.add({
      severity: 'error',
      summary: 'Error: Missing Editable Fields',
      detail: 'At least one editable field must be present: month, year, district, school, class, or group',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
    return;
  }

  validateUsers();

  if (errorUsers.value.length === 0) {
    isFileUploaded.value = true;
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'File Successfully Uploaded',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
  }
};

const validateUsers = () => {
  errorUsers.value = [];

  rawUserFile.value.forEach((user) => {
    const missingFields = [];

    // Check for required uid field
    if (!user.uid) {
      missingFields.push('uid');
    }

    // Check if at least one editable field has a value
    const editableFields = ['month', 'year', 'district', 'school', 'class', 'group'];
    const hasEditableValue = editableFields.some((field) => user[field]);

    if (!hasEditableValue) {
      missingFields.push('at least one editable field (month, year, district, school, class, or group)');
    }

    if (missingFields.length > 0) {
      addErrorUser(user, `Missing Field(s): ${missingFields.join(', ')}`);
    }
  });

  if (errorUsers.value.length > 0) {
    toast.add({
      severity: 'error',
      summary: 'Missing Fields. See below for details.',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
  }
};

const submitEdits = async () => {
  activeSubmit.value = true;
  try {
    const result = await authStore.roarfirekit.editUsers(toRaw(rawUserFile.value));

    // Check if there are errors in the result
    if (result.data.errors && result.data.errors.length > 0) {
      // Clear previous errors
      errorUsers.value = [];

      // Process each error and add to errorUsers
      result.data.errors.forEach((error) => {
        // Find the original user data by uid
        const userData = rawUserFile.value.find((user) => user.uid === error.uid);
        if (userData) {
          // Create error message based on the returned error
          let errorMessage = error.reason;
          if (error.field) {
            errorMessage += ` (Field: ${error.field})`;
          }

          addErrorUser({ uid: userData.uid }, errorMessage);
        }
      });

      // Show partial success message
      toast.add({
        severity: 'warn',
        summary: 'Failed to edit some users',
        detail: `${result.data.successfulUpdates} of ${result.data.totalProcessed} users updated successfully. See errors below.`,
        life: TOAST_DEFAULT_LIFE_DURATION,
      });
    } else {
      // All updates were successful
      editSuccess.value = true;
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: `${result.data.message}`,
        life: TOAST_DEFAULT_LIFE_DURATION,
      });
    }
  } catch (error) {
    console.error(error);
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: `Failed to edit users: ${error.message}. Please try again.`,
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
  } finally {
    activeSubmit.value = false;
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

function addErrorUser(user, error) {
  // If there are no error users yet, generate the
  //  columns before displaying the table.
  if (_isEmpty(errorUserColumns.value)) {
    // Generate columns from user data
    errorUserColumns.value = generateColumns(user);

    // Remove uid from its current position
    const uidColumnIndex = errorUserColumns.value.findIndex((col) => col.field === 'uid');
    let uidColumn = null;

    if (uidColumnIndex !== -1) {
      // Extract the uid column
      uidColumn = errorUserColumns.value.splice(uidColumnIndex, 1)[0];
    }

    const errorColumn = {
      dataType: 'string',
      field: 'error',
      header: 'Cause of Error',
    };

    // Reorder columns: uid first, then error, then the rest
    if (uidColumn) {
      errorUserColumns.value.unshift(errorColumn); // Add error column first
      errorUserColumns.value.unshift(uidColumn); // Then add uid column at the very beginning
    } else {
      // If uid column wasn't found for some reason, just add error column
      errorUserColumns.value.unshift(errorColumn);
    }

    showErrorTable.value = true;
  }
  // Concat the userObject with the error reason.
  errorUsers.value.push({
    ...user,
    error,
  });
}

const resetForm = () => {
  isFileUploaded.value = false;
  rawUserFile.value = [];
  errorUsers.value = [];
  errorUserColumns.value = [];
  showErrorTable.value = false;
  activeSubmit.value = false;
  editSuccess.value = false;
};
</script>

<style scoped>
.extra-height {
  min-height: 33vh;
}

.datatable {
  border: 1px solid var(--surface-d);
  border-radius: 5px;
  margin-top: 1rem;
}

.submit-container {
  margin-top: 1rem;
}

.error-container {
  margin-top: 2rem;
}

.error-header {
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
