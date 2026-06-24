<template>
  <main class="container main">
    <section class="main-body">
      <div v-if="!isLoading">
        <div class="flex mb-5 flex-column">
          <div class="flex justify-content-between">
            <div class="flex gap-3 align-items-center">
              <i class="text-gray-400 rounded pi pi-users" style="font-size: 1.6rem"></i>
              <div class="admin-page-header">List Users</div>
            </div>
            <div class="flex gap-3 px-5 py-2 bg-gray-100 rounded flex-column">
              <div class="flex flex-wrap gap-2 align-items-center justify-content-between">
                <div class="mb-1 font-light text-gray-400 uppercase font-sm">
                  {{ singularizeFirestoreCollection(orgType) }}
                </div>
                <div class="text-xl text-gray-600">
                  <b> {{ orgName }} </b>
                </div>
              </div>
              <div class="flex flex-wrap gap-2 justify-content-between">
                <div class="mb-1 font-light text-gray-400 uppercase font-sm">Student Count</div>
                <div class="text-xl text-gray-600">
                  <b> {{ totalRecords }} </b>
                </div>
              </div>
            </div>
          </div>
          <div class="ml-6 text-gray-500 text-md">View users for the selected organization.</div>
        </div>

        <PvDataTable
          :value="users"
          lazy
          paginator
          paginator-position="both"
          removable-sort
          sort-mode="single"
          show-gridlines
          :total-records="totalRecords"
          :rows="rows"
          :first="first"
          :rows-per-page-options="[10, 25, 50, 100]"
          :sort-field="sortField"
          :sort-order="primeSortOrder"
          :loading="isLoading || isFetching"
          data-key="id"
          data-cy="list-users__table"
          @page="onPage($event)"
          @sort="onSort($event)"
        >
          <PvColumn
            v-for="col of columns"
            :key="col.field"
            :field="col.field"
            :header="col.header"
            :sortable="col.sortable === true"
          >
            <template #body="{ data: rowData }">
              <span v-if="col.dataType === 'date'">{{ getFormattedDate(_get(rowData, col.field)) }}</span>
              <span v-else>{{ _get(rowData, col.field) }}</span>
            </template>
          </PvColumn>
          <PvColumn v-if="canShowEditColumn" header="Edit">
            <template #body="{ data: rowData }">
              <PvButton
                severity="secondary"
                text
                class="p-2 border border-round surface-200 text-primary hover:surface-500 hover:text-white"
                icon="pi pi-user-edit"
                aria-label="Edit user"
                size="small"
                data-cy="list-users__edit-btn"
                @click="onEditButtonClick(rowData)"
              />
            </template>
          </PvColumn>
          <template #empty>
            <div class="flex my-6 flex-column align-items-center">
              <div class="my-2 text-lg font-bold">No users found</div>
              <div class="font-light">There are no users to display for this organization.</div>
            </div>
          </template>
        </PvDataTable>
      </div>
      <AppSpinner v-else />
      <RoarModal
        title="Edit User Information"
        subtitle="Modify, add, or remove user information"
        :is-enabled="isModalEnabled"
        @modal-closed="closeModal"
      >
        <AppSpinner v-if="!showPassword && isLoadingEditUser" />
        <EditUsersForm
          v-else-if="!showPassword && editUserProfile"
          :user-data="editUserProfile"
          :edit-mode="true"
          @update:user-data="localUserData = $event"
        />
        <div v-if="showPassword">
          <div class="flex" style="gap: 1rem">
            <div class="flex gap-1 flex-column form-field" style="width: 100%">
              <label>New Password</label>
              <PvPassword
                v-model="v$.password.$model"
                :class="{ 'p-invalid': v$.password.$invalid && submitted }"
                :input-props="{ autocomplete: 'new-password' }"
                show-icon="pi pi-eye-slash"
                hide-icon="pi pi-eye"
                toggle-mask
              />
              <small v-if="v$.password.$invalid && submitted" class="p-error">
                Password must be at least 8 characters long.
              </small>
            </div>
            <div class="flex gap-1 flex-column form-field" style="width: 100%">
              <label>Confirm New Password</label>
              <PvPassword
                v-model="v$.confirmPassword.$model"
                :class="{ 'p-invalid': v$.confirmPassword.$invalid && submitted }"
                :input-props="{ autocomplete: 'new-password' }"
                :feedback="false"
                show-icon="pi pi-eye-slash"
                hide-icon="pi pi-eye"
                toggle-mask
              />
              <small v-if="v$.confirmPassword.$invalid && submitted" class="p-error">Passwords do not match.</small>
            </div>
          </div>
        </div>
        <div v-if="userCan(Permissions.Users.Credentials.UPDATE)" class="flex mt-3 w-full justify-content-center">
          <PvButton
            v-if="!showPassword"
            class="p-2 mr-auto ml-auto text-white border-none border-round bg-primary hover:surface-400"
            @click="showPassword = true"
            >Change Password</PvButton
          >
        </div>

        <template #footer>
          <div>
            <div v-if="!showPassword" class="flex gap-2">
              <PvButton
                tabindex="0"
                class="p-2 bg-white border-none border-round text-primary hover:surface-200"
                text
                label="Cancel"
                outlined
                @click="closeModal"
              ></PvButton>
              <PvButton
                v-if="canUserEdit"
                tabindex="0"
                class="p-2 text-white border-none border-round bg-primary hover:surface-400"
                label="Save"
                :disabled="isLoadingEditUser || isSubmitting"
                @click="updateUserData"
                ><i v-if="isSubmitting" class="pi pi-spinner pi-spin"></i
              ></PvButton>
            </div>
            <div v-else-if="showPassword" class="flex gap-2">
              <PvButton
                tabindex="0"
                class="p-2 bg-white border-none border-round text-primary hover:surface-200"
                text
                label="Back to User Information"
                outlined
                @click="showPassword = false"
              ></PvButton>
              <PvButton
                tabindex="0"
                class="p-2 text-white border-none border-round bg-primary hover:surface-400"
                label="Save Password"
                :disabled="isSubmitting"
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
import { useQueryClient } from '@tanstack/vue-query';
import { useVuelidate } from '@vuelidate/core';
import { required, sameAs, minLength } from '@vuelidate/validators';
import { useToast } from 'primevue/usetoast';
import PvButton from 'primevue/button';
import PvColumn from 'primevue/column';
import PvDataTable from 'primevue/datatable';
import PvPassword from 'primevue/password';
import _get from 'lodash/get';
import { useAuthStore } from '@/store/auth';
import useOrgUsersQuery from '@/composables/queries/useOrgUsersQuery';
import useUserProfileQuery from '@/composables/queries/useUserProfileQuery';
import useUpdateUserMutation from '@/composables/mutations/useUpdateUserMutation';
import { mapUserFormToUpdateBody } from '@/helpers/mappers/mapUserFormToUpdateBody';
import { ORG_USERS_QUERY_KEY } from '@/constants/queryKeys';
import { singularizeFirestoreCollection } from '@/helpers';
import AppSpinner from './AppSpinner.vue';
import EditUsersForm from './EditUsersForm.vue';
import RoarModal from './modals/RoarModal.vue';
import { usePermissions } from '@/composables/usePermissions';
const { userCan, Permissions } = usePermissions();

const authStore = useAuthStore();
const queryClient = useQueryClient();

// `roarfirekit` is retained solely for the `restConfig` readiness gate in
// `init()` / `onMounted` below (the deferred AU chain). All profile and password
// writes now go through the typed API via `useUpdateUserMutation`.
const { roarfirekit } = storeToRefs(authStore);
const initialized = ref(false);
const toast = useToast();

// Server-driven pagination state. `first` is the 0-indexed row offset PrimeVue's
// DataTable tracks; `rows` is the page size; `page` is the 1-indexed page the
// backend expects, derived from first/rows at the boundary. The list endpoint caps
// perPage at 100, which is also the largest rows-per-page option offered.
const first = ref(0);
const rows = ref(25);
const page = computed(() => Math.floor(first.value / rows.value) + 1);

// Server-driven sort. The endpoint accepts a SINGLE sort field restricted to
// nameLast | username | grade, with direction asc | desc. Defaults mirror the
// endpoint defaults (nameLast, desc).
const sortBy = ref('nameLast');
const sortOrder = ref('desc');

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
  data: orgUsers,
} = useOrgUsersQuery(
  computed(() => props.orgType),
  computed(() => props.orgId),
  page,
  rows,
  sortBy,
  sortOrder,
  {
    enabled: initialized,
  },
);

// The query resolves to `{ items, pagination }`; expose the current page's rows and
// the server's total so the lazy table can render and size its paginator.
const users = computed(() => orgUsers.value?.items ?? []);
const totalRecords = computed(() => orgUsers.value?.pagination?.totalItems ?? 0);

// Maps a column's data field to the server sort field. Only the three columns the
// endpoint can sort on are present — every other column is rendered non-sortable so
// PrimeVue never emits a sort the backend would reject. The reverse map drives which
// column shows the active sort indicator after a refetch.
const COLUMN_SORT_FIELDS = {
  username: 'username',
  'name.last': 'nameLast',
  'studentData.grade': 'grade',
};
const SORT_FIELD_TO_COLUMN = Object.fromEntries(
  Object.entries(COLUMN_SORT_FIELDS).map(([field, sortField]) => [sortField, field]),
);

// Column definitions. `sortable` is true only for server-sortable columns; the
// rest (email, first name, state id, gender, date of birth) are display-only —
// the endpoint does not sort on them, so client-side sort is intentionally not
// offered. `userType` and `archived` are dropped entirely: the enrolled-users
// list row does not include them.
const columns = ref([
  { field: 'username', header: 'Username', dataType: 'string', sortable: true },
  { field: 'email', header: 'Email', dataType: 'string', sortable: false },
  { field: 'name.first', header: 'First Name', dataType: 'string', sortable: false },
  { field: 'name.last', header: 'Last Name', dataType: 'string', sortable: true },
  { field: 'studentData.state_id', header: 'State Id', dataType: 'string', sortable: false },
  { field: 'studentData.grade', header: 'Grade', dataType: 'string', sortable: true },
  { field: 'studentData.gender', header: 'Gender', dataType: 'string', sortable: false },
  { field: 'studentData.dob', header: 'Date of Birth', dataType: 'date', sortable: false },
]);

const canShowEditColumn = computed(
  () =>
    userCan(Permissions.Users.UPDATE) ||
    userCan(Permissions.Users.Credentials.UPDATE) ||
    userCan(Permissions.Administrators.UPDATE),
);

// PrimeVue single-sort bindings derived from the server sort state, so the active
// sort indicator stays in sync with what the backend actually sorted by.
const sortField = computed(() => SORT_FIELD_TO_COLUMN[sortBy.value] ?? null);
const primeSortOrder = computed(() => (sortOrder.value === 'asc' ? 1 : -1));

// The id of the row whose edit modal is open. The lean list row (mapEnrolledUser)
// carries only enough to identify the user — it lacks `userType` and the editable
// demographic/identifier fields — so the modal drives off the full profile fetched
// below, keyed on this id, rather than off the row itself.
const selectedUserId = ref(null);
const isModalEnabled = ref(false);

// Full user profile for the row being edited (`GET /v1/users/:id` → mapUser).
// Unlike the list row this includes `userType` (so `canUserEdit` can branch) and
// every editable field, so editing off it never drops data. Gated on the modal
// being open with a selected id; the query also self-gates on the access token.
const { data: editUserProfile, isLoading: isLoadingEditUser } = useUserProfileQuery(selectedUserId, {
  enabled: computed(() => isModalEnabled.value && Boolean(selectedUserId.value)),
});

/**
 * Format a date value for display, tolerating ISO strings and Date instances.
 * @param {string|Date|null|undefined} value – The date value to format.
 * @returns {string} A localized date string, or '' when the value is empty/invalid.
 */
function getFormattedDate(value) {
  if (!value) return '';
  const dateObj = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dateObj.getTime())) return '';
  return dateObj.toLocaleDateString('en-us', { year: 'numeric', month: 'short', day: 'numeric' });
}

// +----------------------+
// | Permissions Handling |
// +----------------------+
const canUserEdit = computed(() => {
  // Branch on the fetched full profile's `userType`. The list row does not carry
  // `userType`, so this would never resolve to the admin branch if read from the
  // row — the profile fetch is what makes the admin/student distinction work.
  const userType = editUserProfile.value?.userType;
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

const { mutateAsync: updateUser } = useUpdateUserMutation();

// Open the edit modal for a row. Only the row's id is retained — it keys the
// full-profile query that drives the form and `canUserEdit`. The lean row itself
// is not used for editing (it lacks `userType` and the editable fields).
const onEditButtonClick = (rowData) => {
  selectedUserId.value = rowData.id;
  isModalEnabled.value = true;
};

const isSubmitting = ref(false);

const updateUserData = async () => {
  if (!localUserData.value || !selectedUserId.value) return;
  isSubmitting.value = true;

  try {
    // Map the form's nested model to the flat `UpdateUserRequestBodySchema` body
    // so the read (GET /v1/users/:id) and write (PATCH /v1/users/:id) stay on the
    // same API source — without this the row would show stale data after a save.
    const body = mapUserFormToUpdateBody(localUserData.value);
    await updateUser({ userId: selectedUserId.value, userData: body });

    // Invalidate the org-users list so the edited row reflects the change. The
    // mutation itself invalidates the user-profile/user keys; the list lives under
    // a separate key and must be invalidated here.
    queryClient.invalidateQueries({ queryKey: [ORG_USERS_QUERY_KEY] });

    closeModal();
    toast.add({ severity: 'success', summary: 'Updated', detail: 'User has been updated', life: 3000 });
  } catch (error) {
    // The mutation throws a structured error carrying the ts-rest `.status`/`.body`.
    const detail = error?.body?.error?.message ?? 'Unable to update user';
    toast.add({ severity: 'error', summary: 'Error', detail, life: 3000 });
  } finally {
    isSubmitting.value = false;
  }
};

const closeModal = () => {
  isModalEnabled.value = false;
  localUserData.value = null;
  selectedUserId.value = null;
  showPassword.value = false;
};

/**
 * Lazy page handler. PrimeVue emits `{ first, rows }` on page/rows change; mirror
 * them into our 0-indexed offset state. `page` (1-indexed) is derived from these,
 * so the query refetches the requested server page.
 * @param {{ first: number, rows: number }} event – PrimeVue page event.
 * @returns {void}
 */
const onPage = (event) => {
  first.value = event.first;
  rows.value = event.rows;
};

/**
 * Lazy single-sort handler. PrimeVue emits `{ sortField, sortOrder }` (sortOrder
 * 1 = ascending, -1 = descending). Translate the column field to the endpoint's
 * sort enum and the numeric order to asc|desc, then reset to the first page so the
 * re-sorted list starts at the top. Columns without a server sort mapping are not
 * sortable, so this only ever sees the three allowed fields; clearing the sort
 * (removable-sort) falls back to the endpoint defaults.
 * @param {{ sortField: string|null, sortOrder: number|null }} event – PrimeVue sort event.
 * @returns {void}
 */
const onSort = (event) => {
  const nextSortBy = event.sortField ? COLUMN_SORT_FIELDS[event.sortField] : null;
  if (nextSortBy) {
    sortBy.value = nextSortBy;
    sortOrder.value = event.sortOrder === 1 ? 'asc' : 'desc';
  } else {
    // Sort cleared — revert to the endpoint defaults.
    sortBy.value = 'nameLast';
    sortOrder.value = 'desc';
  }
  first.value = 0;
};

// +-----------------+
// | Update Password |
// +-----------------+
const submitted = ref(false);
const showPassword = ref(false);
const passwordRef = computed(() => state.password);
// Minimum length is 8 to match the contract (`password: z.string().min(8)` on
// `UpdateUserRequestBodySchema`); a shorter value would be rejected server-side.
const rules = {
  password: {
    required,
    minLength: minLength(8),
  },
  confirmPassword: {
    required,
    minLength: minLength(8),
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
  // Vuelidate blocks the call when the password is < 8 chars or the confirm
  // doesn't match, so an invalid form never reaches the mutation.
  if (v$.value.$invalid || !selectedUserId.value) return;

  isSubmitting.value = true;
  try {
    // Password resets go through the same PATCH endpoint; the backend routes a
    // supplied `password` to the target's Firebase Auth credential (never the DB).
    await updateUser({ userId: selectedUserId.value, userData: { password: state.password } });
    submitted.value = false;
    state.password = '';
    state.confirmPassword = '';
    showPassword.value = false;
    toast.add({ severity: 'success', summary: 'Updated', detail: 'Password Updated!', life: 3000 });
  } catch (error) {
    const detail = error?.body?.error?.message ?? 'Unable to update password';
    toast.add({ severity: 'error', summary: 'Error', detail, life: 3000 });
  } finally {
    isSubmitting.value = false;
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
