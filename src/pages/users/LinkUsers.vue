<template>
  <main class="container main">
    <section class="main-body">
      <LinkUsersInfo />

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
            :label="activeSubmit ? 'Linking Users' : 'Start Linking'"
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
import LinkUsersInfo from '@/components/userInfo/LinkUsersInfo.vue';
import PvButton from 'primevue/button';
import PvColumn from 'primevue/column';
import PvDataTable from 'primevue/datatable';
import PvFileUpload from 'primevue/fileupload';
import _forEach from 'lodash/forEach';
import _startCase from 'lodash/startCase';
import _isEmpty from 'lodash/isEmpty';

const authStore = useAuthStore();
const toast = useToast();
const isFileUploaded = ref(false);
const rawUserFile = ref([]);
const errorUsers = ref([]);
const errorUserColumns = ref([]);
const activeSubmit = ref(false);
const showErrorTable = ref(false);


// LINKING
// Required: id, userType, uid
// Optional: parentId, teacherId


const allFields = [
    {
      field: 'id',
      header: 'ID',
      dataType: 'string',
    },
    {
      field: 'userType',
      header: 'User Type',
      dataType: 'string',
    },
    {
      field: 'parentId',
      header: 'Parent ID',
      dataType: 'string',
    },
    {
      field: 'teacherId',
      header: 'Teacher ID',
      dataType: 'string',
    },
    {
      field: 'uid',
      header: 'UID',
      dataType: 'string',
    }
  ];

const onFileUpload = async (event) => {
  showErrorTable.value = false;
  // Read the file
  const file = event.files[0];
  
  // Parse the file directly with csvFileToJson
  const parsedData = await csvFileToJson(file);
  
  // Check if there's any data
  if (!parsedData || parsedData.length === 0) {
    toast.add({
      severity: 'error',
      summary: 'Error: Empty File',
      detail: 'The uploaded file contains no data',
      life: 5000,
    });
    return;
  }
  
  // Store the parsed data
  rawUserFile.value = parsedData;

  // Get all column names from the first row, case-insensitive check
  const firstRow = toRaw(rawUserFile.value[0]);
  const allColumns = Object.keys(firstRow).map(col => col.toLowerCase());
  console.log('allColumns: ', allColumns);

  // First check if the required columns are present (case-insensitive)
  const hasId = allColumns.includes('id');
  const hasUserType = allColumns.includes('usertype');
  const hasUid = allColumns.includes('uid');

  const missingColumns = [];

  if (!hasId) {
    missingColumns.push('id');
  }
  if (!hasUserType) {
    missingColumns.push('userType');
  }
  if (!hasUid) {
    missingColumns.push('uid');
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

  // parentId and teacherId are now optional, so we don't check for them here

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
  const userMap = new Map(toRaw(rawUserFile.value).map(user => [user.id.toString(), user]));

  const requiredFields = ['id', 'usertype', 'uid'];

  rawUserFile.value.forEach(user => {
    console.log('user: ', user);
    const missingFields = [];

    // Check for required fields (case-insensitive)
    requiredFields.forEach(requiredField => {
      // Find the actual field name in the user object (case-insensitive)
      const actualField = Object.keys(user).find(key => key.toLowerCase() === requiredField);
      if (!actualField || !user[actualField]) {
        missingFields.push(requiredField === 'usertype' ? 'userType' : requiredField);
      }
    });


    // Check parentId and teacherId if they exist (now optional)
    // Find userType field (case-insensitive)
    const userTypeField = Object.keys(user).find(key => key.toLowerCase() === 'usertype');
    
    if (userTypeField && user[userTypeField].toLowerCase() === 'child') {
      
      // Find parentId field (case-insensitive)
      const parentIdField = Object.keys(user).find(key => key.toLowerCase() === 'parentid');
      
      // Only validate parentId if it exists
      if (parentIdField && user[parentIdField] && user[parentIdField].trim() !== '') {
        const parentIds = typeof user[parentIdField] === 'string' ? 
          user[parentIdField].split(',').map(id => id.trim()) : 
          [user[parentIdField].toString()];
          
        parentIds.forEach(parentId => {
          console.log('parentId in loop:', parentId);

          if (!userMap.has(parentId)) {
            missingFields.push(`Parent with ID ${parentId} not found`);
          } else {
            // Find userType field in parent (case-insensitive)
            const parentUserTypeField = Object.keys(userMap.get(parentId)).find(key => key.toLowerCase() === 'usertype');
            
            if (!parentUserTypeField || userMap.get(parentId)[parentUserTypeField].toLowerCase() !== 'parent') {
              missingFields.push(`User with ID ${parentId} is not a parent`);
            }
          }
        });
      }
      
      // Find teacherId field (case-insensitive)
      const teacherIdField = Object.keys(user).find(key => key.toLowerCase() === 'teacherid');
      
      // Only validate teacherId if it exists
      if (teacherIdField && user[teacherIdField] && user[teacherIdField].trim() !== '') {
        const teacherIds = typeof user[teacherIdField] === 'string' ? 
          user[teacherIdField].split(',').map(id => id.trim()) : 
          [user[teacherIdField].toString()];
          
        teacherIds.forEach(teacherId => {
          if (!userMap.has(teacherId)) {
            missingFields.push(`Teacher with ID ${teacherId} not found`);
          } else {
            // Find userType field in teacher (case-insensitive)
            const teacherUserTypeField = Object.keys(userMap.get(teacherId)).find(key => key.toLowerCase() === 'usertype');
            
            if (!teacherUserTypeField || userMap.get(teacherId)[teacherUserTypeField].toLowerCase() !== 'teacher') {
              missingFields.push(`User with ID ${teacherId} is not a teacher`);
            }
          }
        });
      }
    }

    if (missingFields.length > 0) {
      addErrorUser(user, `Missing Field(s): ${missingFields.join(', ')}`);
    }
  });

  if (errorUsers.value.length > 0) {
    console.log('errorUsers: ', errorUsers.value);
    toast.add({
      severity: 'error',
      summary: 'Missing Fields. See below for details.',
      life: 5000,
    });
  }
};

const submitUsers = async () => {
  activeSubmit.value = true;
  try {
    // Normalize field names for the backend
    const normalizedUsers = toRaw(rawUserFile.value).map(user => {
      const normalizedUser = {};
      
      // Process required fields
      const idField = Object.keys(user).find(key => key.toLowerCase() === 'id');
      const userTypeField = Object.keys(user).find(key => key.toLowerCase() === 'usertype');
      const uidField = Object.keys(user).find(key => key.toLowerCase() === 'uid');
      
      if (idField) normalizedUser.id = user[idField];
      if (userTypeField) normalizedUser.userType = user[userTypeField];
      if (uidField) normalizedUser.uid = user[uidField];
      
      // Process optional fields
      const parentIdField = Object.keys(user).find(key => key.toLowerCase() === 'parentid');
      const teacherIdField = Object.keys(user).find(key => key.toLowerCase() === 'teacherid');
      
      if (parentIdField && user[parentIdField]) normalizedUser.parentId = user[parentIdField];
      if (teacherIdField && user[teacherIdField]) normalizedUser.teacherId = user[teacherIdField];
      
      // Include any other fields that might be in the original data
      Object.keys(user).forEach(key => {
        if (!['id', 'userType', 'uid', 'parentId', 'teacherId'].includes(key) && 
            !['id', 'usertype', 'uid', 'parentid', 'teacherid'].includes(key.toLowerCase())) {
          normalizedUser[key] = user[key];
        }
      });
      
      return normalizedUser;
    });
    
    console.log('Normalized users:', normalizedUsers);
    const result = await authStore.roarfirekit.linkUsers(normalizedUsers);
    console.log('user link result:', result);
    
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Users linked successfully',
      life: 5000,
    });
  } catch (error) {
    console.error(error);
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
