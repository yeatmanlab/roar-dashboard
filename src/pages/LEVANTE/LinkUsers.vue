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
          <PvColumn v-for="col of columns" :key="col.field" :field="col.field">
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
            @click="submitUsers"
            class="bg-primary mb-2 p-3 w-2 text-white border-none border-round h-3rem m-0 hover:bg-red-900"
          />
        </div>
      </div>

      <div v-if="errorUsers.length" class="error-container">
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
          <PvColumn v-for="col of errorColumns" :key="col.field" :field="col.field">
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
import LinkUsersInfo from '@/components/LEVANTE/LinkUsersInfo.vue';

const authStore = useAuthStore();
const toast = useToast();
const isFileUploaded = ref(false);
const rawUserFile = ref([]);
const columns = ref([]);
const errorUsers = ref([]);
const errorColumns = ref([]);
const activeSubmit = ref(false);

const requiredFields = ['id', 'parentId', 'teacherId'];

const onFileUpload = async (event) => {
  rawUserFile.value = await csvFileToJson(event.files[0]);
  columns.value = Object.keys(rawUserFile.value[0]).map(key => ({
    field: key,
    header: key,
  }));

  const missingColumns = requiredFields.filter(field => !columns.value.some(col => col.field === field));
  if (missingColumns.length > 0) {
    toast.add({
      severity: 'error',
      summary: 'Error: Missing Columns',
      detail: `Missing columns: ${missingColumns.join(', ')}`,
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
  const userMap = new Map(toRaw(rawUserFile.value).map(user => [user.id, user]));
  console.log('userMap:', userMap);

  rawUserFile.value.forEach(user => {
    const errors = [];
    const requiredFields = ['id', 'userType', 'uid'];
    
    // Check for required fields
    requiredFields.forEach(field => {
      if (!user[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    // Validate based on userType
    if (user.userType === 'child') {
      if (!user.parentId && !user.teacherId) {
        errors.push('Child must have either parentId or teacherId');
      }
      if (user.parentId) {
        console.log('user.parentId:', user.parentId);
        const parentIds = typeof user.parentId === 'string' ? user.parentId.split(',').map(id => id.trim()) : [user.parentId.toString()];
        parentIds.forEach(parentId => {
          console.log('parentId in loop:', parentId);

          if (!userMap.has(parseInt(parentId))) {
            errors.push(`Parent with ID ${parentId} not found`);
          } else if (userMap.get(parseInt(parentId)).userType !== 'parent') {
            errors.push(`User with ID ${parentId} is not a parent`);
          }
        });
      }
      if (user.teacherId) {
        console.log('user.teacherId:', user.teacherId);
        const teacherIds = typeof user.teacherId === 'string' ? user.teacherId.split(',').map(id => id.trim()) : [user.teacherId.toString()];
        teacherIds.forEach(teacherId => {
          if (!userMap.has(parseInt(teacherId))) {
            errors.push(`Teacher with ID ${teacherId} not found`);
          } else if (userMap.get(parseInt(teacherId)).userType !== 'teacher') {
            errors.push(`User with ID ${teacherId} is not a teacher`);
          }
        });
      }
    } else if (user.userType === 'parent' || user.userType === 'teacher') {
      if (user.parentId || user.teacherId) {
        errors.push(`${user.userType} should not have parentId or teacherId`);
      }
    } else {
      errors.push('Invalid userType');
    }

    if (errors.length > 0) {
      errorUsers.value.push({ ...user, errors: errors.join(', ') });
    }
  });

  if (errorUsers.value.length > 0) {
    errorColumns.value = [...columns.value, { field: 'errors', header: 'Errors' }];
    toast.add({
      severity: 'error',
      summary: 'Validation Errors',
      detail: 'Some users could not be linked. See error table for details.',
      life: 5000,
    });
  }
};

const submitUsers = async () => {
  activeSubmit.value = true;
  try {
    const result = await authStore.roarfirekit.linkUsers(rawUserFile.value);
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
      detail: `Failed to link users: ${error.message}`,
      life: 5000,
    });
  } finally {
    activeSubmit.value = false;
  }
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
}
</style>
