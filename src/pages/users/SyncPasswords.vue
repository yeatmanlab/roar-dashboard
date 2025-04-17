<template>
    <main class="container main">
      <section class="main-body">
        <PvPanel header="Sync Passwords">
          <div class="info-message-container flex align-items-center gap-2">
            <i class="pi pi-info-circle"></i>
            <p class="m-0">This is a temporary page to fix an issue with some accounts not having passwords set correctly.</p>
          </div>

          <p>
            When registering users via CSV upload, passwords should be generated and returned for all users. However, some accounts
            were created without passwords being properly set. This tool allows administrators to re-sync passwords for these accounts.
          </p>

          <p class="font-bold">
            There are no changes required on your end - simply upload the CSV file that was returned during registration.
          </p>

          <p>These fields are <b>REQUIRED</b> in your CSV:</p>

          <ul>
            <li><b>uid</b> - The unique identifier that was returned when registering the user</li>
            <li><b>email</b> - The email address of the user</li>
            <li><b>password</b> - The password that was generated during registration</li>
          </ul>

          <p>
            To use this tool:
          </p>

          <ul>
            <li>Upload the CSV file that was returned when you registered the users</li>
            <li>The system will identify accounts missing passwords and sync them with the passwords from the CSV</li>
            <li>Only accounts that are missing passwords will be affected - existing passwords will not be changed</li>
          </ul>

          <p>
            <i>Note: This page will be removed once the underlying registration issue has been resolved.</i>
          </p>
        </PvPanel>
  
        <div v-if="!isFileUploaded" class="text-gray-500 mb-2 surface-100 border-round p-2 mt-5">
          <PvFileUpload
            name="linkUsersUploader[]"
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
              :label="activeSubmit ? 'Syncing Passwords' : 'Sync Passwords'"
              :icon="activeSubmit ? 'pi pi-spin pi-spinner' : ''"
              :disabled="activeSubmit"
              class="bg-primary mb-2 p-3 w-2 text-white border-none border-round h-3rem m-0 hover:bg-red-900"
              @click="submitUsers"
            />
          </div>
        </div>
  
        <div v-if="showErrorTable" class="error-container">
          <div class="error-header">
            <h3>Rows with Errors</h3>
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
  import PvPanel from 'primevue/panel';
  import PvButton from 'primevue/button';
  import PvColumn from 'primevue/column';
  import PvDataTable from 'primevue/datatable';
  import PvFileUpload from 'primevue/fileupload';
  import _forEach from 'lodash/forEach';
  import _startCase from 'lodash/startCase';
  import _isEmpty from 'lodash/isEmpty';
  import { storeToRefs } from 'pinia';
  
  const authStore = useAuthStore();
  const toast = useToast();
  const isFileUploaded = ref(false);
  const rawUserFile = ref([]);
  const errorUsers = ref([]);
  const errorUserColumns = ref([]);
  const activeSubmit = ref(false);
  const showErrorTable = ref(false);

  const { roarfirekit } = storeToRefs(authStore);
  
  const allFields = [
      {
        field: 'uid',
        header: 'UID',
        dataType: 'string',
      },
      {
        field: 'password',
        header: 'Password',
        dataType: 'string',
      },
      {
        field: 'email',
        header: 'Email',
        dataType: 'string',
      }
    ];
  
  const onFileUpload = async (event) => {
    showErrorTable.value = false;
    // Read the file as text first
    const file = event.files[0];
    const text = await file.text();
    
    // Split into lines
    const lines = text.split('\n');
    
    // Lowercase all columns in header
    const headers = lines[0].split(',');
    lines[0] = headers.map(header => header.toLowerCase()).join(',');
    
    // Create a new Blob with modified content
    const modifiedFile = new Blob([lines.join('\n')], { type: file.type });
    
    // Parse the modified file
    rawUserFile.value = await csvFileToJson(modifiedFile);

    const allColumns = Object.keys(toRaw(rawUserFile.value[0])).map(col => col.toLowerCase());

    // Check if the required columns are present  
    const hasUid = allColumns.includes('uid');
    const hasPassword = allColumns.includes('password');
    const hasEmail = allColumns.includes('email');

    const missingColumns = [];

    if (!hasUid) {
      missingColumns.push('uid');
    }
    if (!hasPassword) {
      missingColumns.push('password');
    }
    if (!hasEmail) {
      missingColumns.push('email');
    }

    if (missingColumns.length > 0) {
      toast.add({
        severity: 'error',
        summary: 'Error: Missing Column',
        detail: `Missing required column(s): ${missingColumns.join(', ')}`,
        life: 5000,
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
        life: 3000,
      });
    }
  };
  
  const validateUsers = () => {
    errorUsers.value = [];
    const requiredFields = ['uid', 'password', 'email'];

    rawUserFile.value.forEach(user => {
      const missingFields = [];

      // Check for required fields
      requiredFields.forEach(field => {
          if (!user[field] || user[field].trim() === '') {
            missingFields.push(field);
          }
      });

      if (missingFields.length > 0) {
        addErrorUser(user, `Empty Field(s): ${missingFields.join(', ')}`);
      }
    });

    if (errorUsers.value.length > 0) {
      toast.add({
        severity: 'error',
        summary: 'Missing or Empty Fields. See below for details.',
        life: 5000,
      });
    }
  };
  
  const submitUsers = async () => {
    activeSubmit.value = true;
    
    try {
      // Filter each user object to only include the required fields
      // Handle case-insensitive column names
      const filteredUsers = rawUserFile.value.map(user => {
        // Get all keys from the user object
        const userKeys = Object.keys(user);
        
        // Find the actual case of each required field
        const uidKey = userKeys.find(key => key.toLowerCase() === 'uid');
        const emailKey = userKeys.find(key => key.toLowerCase() === 'email');
        const passwordKey = userKeys.find(key => key.toLowerCase() === 'password');
        
        // Create a new object with only the required fields
        return {
          uid: user[uidKey],
          email: user[emailKey],
          password: user[passwordKey]
        };
      });

      const result = await roarfirekit.value.syncPasswords(filteredUsers);
      
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: result.data.message,
        life: 5000,
      });
    } catch (error) {
      console.error(error.message);
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: `Failed to link users: ${error.message}. Please try again.`,
        life: 5000,
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
  }
  </style>
  