<template>
  <main class="container main">
    <section class="main-body">
      <div v-if="!isLoading">
        <div class="flex flex-column mb-5">
          <div class="flex justify-content-between">
            <div class="flex align-items-center gap-3">
              <i class="pi pi-users text-gray-400 rounded" style="font-size: 1.6rem"></i>
              <div class="admin-page-header">List Users</div>
            </div>
            <div class="bg-gray-100 px-5 py-2 rounded flex flex-column gap-3">
              <div class="flex flex-wrap align-items-center gap-2 justify-content-between">
                <div class="uppercase font-light font-sm text-gray-400 mb-1">
                  {{ singularizeFirestoreCollection(orgType) }}
                </div>
                <div class="text-xl text-gray-600">
                  <b> {{ orgName }} </b>
                </div>
              </div>
              <div class="flex flex-wrap gap-2 justify-content-between">
                <div class="uppercase font-light font-sm text-gray-400 mb-1">Student Count</div>
                <div class="text-xl text-gray-600">
                  <b> {{ users?.length }} </b>
                </div>
              </div>
            </div>
          </div>
          <div class="text-md text-gray-500 ml-6">View users for the selected organization.</div>
        </div>

        <RoarDataTable
          v-if="users"
          :columns="columns"
          :data="users"
          :loading="isLoading || isFetching"
          :allow-export="false"
          :allow-filtering="false"
          @sort="onSort($event)"
          @edit-button="onEditButtonClick($event)"
        />
      </div>
      <AppSpinner v-else />
      <RoarModal
        title="Edit User Information"
        subtitle="Modify, add, or remove user information"
        :is-enabled="isModalEnabled"
        @modal-closed="isModalEnabled = false"
      >
        <EditUsersForm
          v-if="!showPassword"
          :user-data="currentEditUser"
          :edit-mode="true"
          @update:user-data="localUserData = $event"
        />
        <div v-if="showPassword">
          <div class="flex" style="gap: 1rem">
            <div class="form-field" style="width: 100%">
              <label>New Password</label>
              <PvInputText v-model="v$.password.$model" :class="{ 'p-invalid': v$.password.$invalid && submitted }" />
              <small v-if="v$.password.$invalid && submitted" class="p-error"
                >Password must be at least 6 characters long.</small
              >
            </div>
            <div class="form-field" style="width: 100%">
              <label>Confirm New Password</label>
              <PvInputText
                v-model="v$.confirmPassword.$model"
                :class="{ 'p-invalid': v$.confirmPassword.$invalid && submitted }"
              />
              <small v-if="v$.confirmPassword.$invalid && submitted" class="p-error">Passwords do not match.</small>
            </div>
          </div>
        </div>
        <div v-if="userCan(Permissions.Users.Credentials.UPDATE)" class="flex justify-content-center mt-3 w-full">
          <PvButton
            v-if="!showPassword"
            class="border-none border-round bg-primary text-white p-2 hover:surface-400 mr-auto ml-auto"
            @click="showPassword = true"
            >Change Password</PvButton
          >
        </div>

        <template #footer>
          <div>
            <div v-if="!showPassword" class="flex gap-2">
              <PvButton
                tabindex="0"
                class="border-none border-round bg-white text-primary p-2 hover:surface-200"
                text
                label="Cancel"
                outlined
                @click="closeModal"
              ></PvButton>
              <PvButton
                v-if="canUserEdit"
                tabindex="0"
                class="border-none border-round bg-primary text-white p-2 hover:surface-400"
                label="Save"
                @click="updateUserData"
                ><i v-if="isSubmitting" class="pi pi-spinner pi-spin"></i
              ></PvButton>
            </div>
            <div v-else-if="showPassword" class="flex gap-2">
              <PvButton
                tabindex="0"
                class="border-none border-round bg-white text-primary p-2 hover:surface-200"
                text
                label="Back to User Information"
                outlined
                @click="showPassword = false"
              ></PvButton>
              <PvButton
                tabindex="0"
                class="border-none border-round bg-primary text-white p-2 hover:surface-400"
                label="Save Password"
                @click="updatePassword"
                ><i v-if="isSubmitting" class="pi pi-spinner pi-spin"></i
              ></PvButton>
            </div>
          </div>
        </template>
      </RoarModal>
    </section>
  </main>
</template>
<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useVuelidate } from '@vuelidate/core';
import { required, sameAs, minLength } from '@vuelidate/validators';
import { useToast } from 'primevue/usetoast';
import PvButton from 'primevue/button';
import PvInputText from 'primevue/inputtext';
import _isEmpty from 'lodash/isEmpty';
import { useAuthStore } from '@/store/auth';
import useOrgUsersQuery from '@/composables/queries/useOrgUsersQuery';
import { singularizeFirestoreCollection } from '@/helpers';
import AppSpinner from './AppSpinner.vue';
import EditUsersForm from './EditUsersForm.vue';
import RoarModal from './modals/RoarModal.vue';
import RoarDataTable from '@/components/RoarDataTable';
import { usePermissions } from '@/composables/usePermissions';
const { userCan, Permissions } = usePermissions();

const authStore = useAuthStore();

const { roarfirekit } = storeToRefs(authStore);
const initialized = ref(false);
const toast = useToast();

const page = ref(0);
const orderBy = ref(null);

const props = defineProps({
  orgType: {
    type: String,
    required: true,
  },
  orgId: {
    type: String,
    required: true,
  },
  orgName: {
    type: String,
    required: true,
  },
});

const {
  isLoading,
  isFetching,
  data: users,
} = useOrgUsersQuery(props.orgType, props.orgId, page, orderBy, {
  enabled: initialized,
});

const columns = ref([
  {
    field: 'username',
    header: 'Username',
    dataType: 'string',
    sort: false,
  },
  {
    field: 'email',
    header: 'Email',
    dataType: 'string',
    sort: false,
  },
  {
    field: 'name.first',
    header: 'First Name',
    dataType: 'string',
    sort: false,
  },
  {
    field: 'name.last',
    header: 'Last Name',
    dataType: 'string',
    sort: false,
  },
  {
    field: 'studentData.state_id',
    header: 'State Id',
    dataType: 'string',
    sort: false,
  },
  {
    field: 'studentData.grade',
    header: 'Grade',
    dataType: 'string',
    sort: false,
  },
  {
    field: 'studentData.gender',
    header: 'Gender',
    dataType: 'string',
    sort: false,
  },
  {
    field: 'studentData.dob',
    header: 'Date of Birth',
    dataType: 'date',
    sort: false,
  },
  {
    field: 'userType',
    header: 'User Type',
    dataType: 'string',
    sort: false,
  },
  {
    field: 'archived',
    header: 'Archived',
    dataType: 'boolean',
    sort: false,
  },
]);

if (
  userCan(Permissions.Users.UPDATE) ||
  userCan(Permissions.Users.Credentials.UPDATE) ||
  userCan(Permissions.Administrators.UPDATE)
) {
  columns.value.push({
    header: 'Edit',
    button: true,
    eventName: 'edit-button',
    buttonIcon: 'pi pi-user-edit',
    sort: false,
  });
} else {
  console.log('User does not have edit permissions');
}

const currentEditUser = ref(null);
const isModalEnabled = ref(false);

// +----------------------+
// | Permissions Handling |
// +----------------------+
const canUserEdit = computed(() => {
  const userType = currentEditUser.value?.userType;
  if (userType === 'admin') {
    return userCan(Permissions.Administrators.UPDATE);
  } else {
    return userCan(Permissions.Users.UPDATE);
  }
});

// +-----------------+
// | Edit User Modal |
// +-----------------+
const localUserData = ref(null);

const onEditButtonClick = (event) => {
  currentEditUser.value = event;
  isModalEnabled.value = true;
  console.log(event);
};

const isSubmitting = ref(false);

const updateUserData = async () => {
  if (!localUserData.value) return;
  isSubmitting.value = true;

  await roarfirekit.value
    .updateUserData(currentEditUser.value.id, localUserData.value)
    .then(() => {
      isSubmitting.value = false;
      closeModal();
      toast.add({ severity: 'success', summary: 'Updated', detail: 'User has been updated', life: 3000 });
    })
    .catch((error) => {
      console.log('Error occurred during submission:', error);
      isSubmitting.value = false;
    });
};

const closeModal = () => {
  isModalEnabled.value = false;
  localUserData.value = null;
};

const onSort = (event) => {
  const _orderBy = (event.multiSortMeta ?? []).map((item) => ({
    field: { fieldPath: item.field },
    direction: item.order === 1 ? 'ASCENDING' : 'DESCENDING',
  }));
  orderBy.value = !_isEmpty(_orderBy) ? _orderBy : null;
};

// +-----------------+
// | Update Password |
// +-----------------+
const submitted = ref(false);
const showPassword = ref(false);
const passwordRef = computed(() => state.password);
const rules = {
  password: {
    required,
    minLength: minLength(6),
  },
  confirmPassword: {
    required,
    minLength: minLength(6),
    sameAsPassword: sameAs(passwordRef),
  },
};
const state = reactive({
  password: '',
  confirmPassword: '',
});
const v$ = useVuelidate(rules, state);

async function updatePassword() {
  submitted.value = true;
  if (!v$.value.$invalid) {
    isSubmitting.value = true;
    await roarfirekit.value
      .updateUserData(currentEditUser.value.id, { password: state.password })
      .then(() => {
        submitted.value = false;
        isSubmitting.value = false;
        state.password = '';
        state.confirmPassword = '';
        showPassword.value = false;
        toast.add({ severity: 'success', summary: 'Updated', detail: 'Password Updated!', life: 3000 });
      })
      .catch(() => {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Unable to update password' });
      });
  }
}

let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig?.()) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig?.()) init();
  isModalEnabled.value = false;
});
</script>
