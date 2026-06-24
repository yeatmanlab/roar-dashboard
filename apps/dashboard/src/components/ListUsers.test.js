import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, toValue, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { ORG_USERS_QUERY_KEY } from '@/constants/queryKeys';

// ---------------------------------------------------------------------------
// Mocks
//
// ListUsers drives its edit flow off three composables. We mock all three so the
// component can be mounted and exercised without a backend, a real auth token, or
// firekit's permission machinery:
//   - useOrgUsersQuery       → controls the table rows (the lean list row).
//   - useUserProfileQuery    → controls the *full* profile fetched on edit-open;
//                              this is the source of `userType` + editable fields.
//   - useUpdateUserMutation  → the PATCH /v1/users/:id write under assertion.
// usePermissions is mocked so each permission branch is deterministic.
// ---------------------------------------------------------------------------

// Captures the (userId, queryOptions) the profile query is invoked with so a test
// can assert it is enabled only when the modal is open with a selected id.
const profileQueryCalls = [];
const editUserProfile = ref(null);
const isLoadingEditUser = ref(false);

const mockUpdateUserMutate = vi.fn().mockResolvedValue(undefined);
const invalidateQueriesMock = vi.fn();

// The lean list row — note it carries NO `userType` and none of the editable
// demographic fields, mirroring `mapEnrolledUser`. Editing must not read off this.
const LEAN_ROW = {
  id: 'user-1',
  username: 'jdoe',
  email: 'jdoe@example.com',
  roles: ['student'],
  name: { first: 'Jane', last: 'Doe' },
  studentData: { dob: null, grade: '5', gender: 'F', state_id: 'S1' },
};

const orgUsersData = ref({ items: [LEAN_ROW], pagination: { totalItems: 1 } });

vi.mock('@/composables/queries/useOrgUsersQuery', () => ({
  default: () => ({
    isLoading: ref(false),
    isFetching: ref(false),
    data: orgUsersData,
  }),
}));

vi.mock('@/composables/queries/useUserProfileQuery', () => ({
  default: (userId, queryOptions) => {
    profileQueryCalls.push({ userId, queryOptions });
    return { data: editUserProfile, isLoading: isLoadingEditUser };
  },
}));

vi.mock('@/composables/mutations/useUpdateUserMutation', () => ({
  default: () => ({ mutateAsync: mockUpdateUserMutate }),
}));

vi.mock('@tanstack/vue-query', () => ({
  useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
}));

// usePermissions: a controllable allow-list. `Permissions` mirrors only the paths
// ListUsers reads. The default (everything allowed) is overridden per-test.
const allowedPermissions = ref(new Set());
const MOCK_PERMISSIONS = {
  Users: {
    UPDATE: 'users.update',
    Credentials: { UPDATE: 'users.credentials.update' },
  },
  Administrators: { UPDATE: 'administrators.update' },
};
vi.mock('@/composables/usePermissions', () => ({
  usePermissions: () => ({
    userCan: (permission) => allowedPermissions.value.has(permission),
    Permissions: MOCK_PERMISSIONS,
  }),
}));

// Auth store: only `roarfirekit` (for the restConfig gate) and `$subscribe` are
// touched. `roarfirekit` is exposed as a ref so the component's
// `storeToRefs(authStore)` destructure yields a usable ref; `restConfig` returns
// truthy so `init()` flips `initialized` to true. `$subscribe` is a no-op.
const mockAuthStore = {
  roarfirekit: ref({ restConfig: () => ({}) }),
  $subscribe: vi.fn(),
};
vi.mock('@/store/auth', () => ({
  useAuthStore: () => mockAuthStore,
}));

// The store's consumed properties are already refs, so storeToRefs can pass the
// store through unchanged. This avoids standing up a full Pinia instance just to
// read `roarfirekit` for the restConfig gate.
vi.mock('pinia', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    storeToRefs: (store) => store,
  };
});

vi.mock('@/helpers', () => ({
  singularizeFirestoreCollection: (s) => s,
}));

// Map the form model to the flat PATCH body. Re-exported so the test asserts the
// exact body shape ListUsers sends (it uses the same mapper as UserInfoView).
import { mapUserFormToUpdateBody } from '@/helpers/mappers/mapUserFormToUpdateBody';
vi.mock('@/helpers/mappers/mapUserFormToUpdateBody', () => ({
  mapUserFormToUpdateBody: vi.fn((form) => ({ __mapped: true, form })),
}));

// Stub the heavy presentational children. EditUsersForm exposes a button that
// emits the model so a test can simulate the form producing `localUserData`.
const FULL_PROFILE = {
  id: 'user-1',
  userType: 'student',
  email: 'jdoe@example.com',
  name: { first: 'Jane', middle: null, last: 'Doe' },
  studentData: {
    dob: null,
    grade: '5',
    gender: 'F',
    ell_status: false,
    frl_status: null,
    iep_status: false,
    hispanic_ethnicity: false,
    race: null,
    state_id: 'S1',
  },
};

const FORM_MODEL = { name: { first: 'Jane', last: 'Doe' }, studentData: { grade: '6' } };

const EditUsersFormStub = {
  name: 'EditUsersForm',
  props: ['userData', 'editMode'],
  emits: ['update:userData'],
  template:
    '<div data-testid="edit-form" :data-user-type="userData?.userType">' +
    '<button data-testid="emit-model" @click="$emit(\'update:userData\', model)">emit</button>' +
    '</div>',
  data() {
    return { model: FORM_MODEL };
  },
};

// RoarModal renders its default slot + footer slot unconditionally so the edit
// form, password fields, and action buttons are queryable regardless of state.
const RoarModalStub = {
  name: 'RoarModal',
  props: ['title', 'subtitle', 'isEnabled'],
  emits: ['modalClosed'],
  template: '<div data-testid="modal"><slot /><slot name="footer" /></div>',
};

const AppSpinnerStub = { name: 'AppSpinner', template: '<div data-testid="spinner" />' };

import ListUsers from './ListUsers.vue';

function mountListUsers() {
  return mount(ListUsers, {
    props: { orgType: 'districts', orgId: 'district-1', orgName: 'District One' },
    global: {
      stubs: {
        EditUsersForm: EditUsersFormStub,
        RoarModal: RoarModalStub,
        AppSpinner: AppSpinnerStub,
        // PrimeVue children are not under test here — stub them to slots.
        PvButton: { template: '<button><slot /></button>' },
        PvColumn: { template: '<div><slot /></div>' },
        PvDataTable: { template: '<div><slot /></div>' },
        PvPassword: { template: '<input />' },
      },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  profileQueryCalls.length = 0;
  editUserProfile.value = null;
  isLoadingEditUser.value = false;
  orgUsersData.value = { items: [LEAN_ROW], pagination: { totalItems: 1 } };
  allowedPermissions.value = new Set([
    MOCK_PERMISSIONS.Users.UPDATE,
    MOCK_PERMISSIONS.Users.Credentials.UPDATE,
    MOCK_PERMISSIONS.Administrators.UPDATE,
  ]);
  mockUpdateUserMutate.mockReset().mockResolvedValue(undefined);
  mapUserFormToUpdateBody.mockClear();
});

describe('ListUsers.vue — edit flow migration', () => {
  describe('edit-open → full profile fetch', () => {
    it('sets selectedUserId from the row and opens the modal', async () => {
      const wrapper = mountListUsers();
      wrapper.vm.onEditButtonClick(LEAN_ROW);
      await nextTick();

      expect(wrapper.vm.selectedUserId).toBe('user-1');
      expect(wrapper.vm.isModalEnabled).toBe(true);
    });

    it('enables the profile query only when the modal is open with a selected id', async () => {
      const wrapper = mountListUsers();

      // The query is constructed once at setup. Its enable condition is reactive,
      // so we inspect that gate rather than relying on a re-invocation.
      expect(profileQueryCalls).toHaveLength(1);
      const { userId, queryOptions } = profileQueryCalls[0];
      const enabled = queryOptions.enabled;

      // Closed modal, no selection → disabled.
      expect(toValue(enabled)).toBe(false);

      wrapper.vm.onEditButtonClick(LEAN_ROW);
      await nextTick();

      // The profile query is keyed on selectedUserId and now enabled.
      expect(toValue(userId)).toBe('user-1');
      expect(toValue(enabled)).toBe(true);
    });

    it('populates the form from the full profile, not the lean list row', async () => {
      const wrapper = mountListUsers();
      wrapper.vm.onEditButtonClick(LEAN_ROW);
      editUserProfile.value = FULL_PROFILE;
      await nextTick();

      const form = wrapper.find('[data-testid="edit-form"]');
      expect(form.exists()).toBe(true);
      // The form received the full profile (which carries userType); the lean row
      // does not, so this proves the binding source.
      expect(form.attributes('data-user-type')).toBe('student');
      // Guard the premise: the lean row genuinely lacks userType, so the admin
      // distinction could not have come from it.
      expect(LEAN_ROW.userType).toBeUndefined();
    });

    it('shows a spinner instead of the form while the profile loads', async () => {
      const wrapper = mountListUsers();
      wrapper.vm.onEditButtonClick(LEAN_ROW);
      isLoadingEditUser.value = true;
      editUserProfile.value = null;
      await nextTick();

      expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="edit-form"]').exists()).toBe(false);
    });
  });

  describe('canUserEdit reads the fetched profile userType', () => {
    it('uses the Administrators.UPDATE branch for an admin profile', async () => {
      const wrapper = mountListUsers();
      allowedPermissions.value = new Set([MOCK_PERMISSIONS.Administrators.UPDATE]); // not Users.UPDATE
      editUserProfile.value = { ...FULL_PROFILE, userType: 'admin' };
      await nextTick();

      expect(wrapper.vm.canUserEdit).toBe(true);
    });

    it('uses the Users.UPDATE branch for a non-admin profile', async () => {
      const wrapper = mountListUsers();
      allowedPermissions.value = new Set([MOCK_PERMISSIONS.Users.UPDATE]); // not Administrators.UPDATE
      editUserProfile.value = { ...FULL_PROFILE, userType: 'student' };
      await nextTick();

      expect(wrapper.vm.canUserEdit).toBe(true);
    });

    it('denies an admin profile when only Users.UPDATE is granted', async () => {
      const wrapper = mountListUsers();
      allowedPermissions.value = new Set([MOCK_PERMISSIONS.Users.UPDATE]);
      editUserProfile.value = { ...FULL_PROFILE, userType: 'admin' };
      await nextTick();

      expect(wrapper.vm.canUserEdit).toBe(false);
    });
  });

  describe('profile save → useUpdateUserMutation (PATCH)', () => {
    it('maps the form model and calls the mutation with the mapped body', async () => {
      const wrapper = mountListUsers();
      wrapper.vm.onEditButtonClick(LEAN_ROW);
      editUserProfile.value = FULL_PROFILE;
      await nextTick();

      // Simulate the form producing localUserData, then save.
      await wrapper.find('[data-testid="emit-model"]').trigger('click');
      await wrapper.vm.updateUserData();

      expect(mapUserFormToUpdateBody).toHaveBeenCalledWith(FORM_MODEL);
      expect(mockUpdateUserMutate).toHaveBeenCalledWith({
        userId: 'user-1',
        userData: { __mapped: true, form: FORM_MODEL },
      });
    });

    it('invalidates the org-users list after a successful save', async () => {
      const wrapper = mountListUsers();
      wrapper.vm.onEditButtonClick(LEAN_ROW);
      editUserProfile.value = FULL_PROFILE;
      await nextTick();

      await wrapper.find('[data-testid="emit-model"]').trigger('click');
      await wrapper.vm.updateUserData();

      expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: [ORG_USERS_QUERY_KEY] });
      // Modal closes and selection clears on success.
      expect(wrapper.vm.isModalEnabled).toBe(false);
      expect(wrapper.vm.selectedUserId).toBe(null);
    });

    it('does not call the mutation when there is no form data', async () => {
      const wrapper = mountListUsers();
      wrapper.vm.onEditButtonClick(LEAN_ROW);
      editUserProfile.value = FULL_PROFILE;
      await nextTick();

      // No emit-model click → localUserData is null.
      await wrapper.vm.updateUserData();

      expect(mockUpdateUserMutate).not.toHaveBeenCalled();
    });

    it('surfaces the error message and keeps the modal open on save failure', async () => {
      const wrapper = mountListUsers();
      mockUpdateUserMutate.mockRejectedValueOnce({
        status: 422,
        body: { error: { message: 'Invalid grade level' } },
      });
      wrapper.vm.onEditButtonClick(LEAN_ROW);
      editUserProfile.value = FULL_PROFILE;
      await nextTick();

      await wrapper.find('[data-testid="emit-model"]').trigger('click');
      await wrapper.vm.updateUserData();

      expect(invalidateQueriesMock).not.toHaveBeenCalled();
      expect(wrapper.vm.isModalEnabled).toBe(true);
    });
  });

  describe('password save → useUpdateUserMutation (PATCH)', () => {
    it('calls the mutation with { password } for a valid 8+ char matching password', async () => {
      const wrapper = mountListUsers();
      wrapper.vm.onEditButtonClick(LEAN_ROW);
      await nextTick();

      wrapper.vm.state.password = 'longenough8';
      wrapper.vm.state.confirmPassword = 'longenough8';
      await nextTick();
      await wrapper.vm.updatePassword();

      expect(mockUpdateUserMutate).toHaveBeenCalledWith({
        userId: 'user-1',
        userData: { password: 'longenough8' },
      });
    });

    it('blocks the call when the password is shorter than 8 characters', async () => {
      const wrapper = mountListUsers();
      wrapper.vm.onEditButtonClick(LEAN_ROW);
      await nextTick();

      wrapper.vm.state.password = 'short7!';
      wrapper.vm.state.confirmPassword = 'short7!';
      await nextTick();
      await wrapper.vm.updatePassword();

      expect(mockUpdateUserMutate).not.toHaveBeenCalled();
    });

    it('blocks the call when the confirmation does not match', async () => {
      const wrapper = mountListUsers();
      wrapper.vm.onEditButtonClick(LEAN_ROW);
      await nextTick();

      wrapper.vm.state.password = 'longenough8';
      wrapper.vm.state.confirmPassword = 'different99';
      await nextTick();
      await wrapper.vm.updatePassword();

      expect(mockUpdateUserMutate).not.toHaveBeenCalled();
    });
  });
});
