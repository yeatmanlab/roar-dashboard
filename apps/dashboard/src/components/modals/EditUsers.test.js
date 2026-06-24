import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth';
import useUpdateUserMutation from '@/composables/mutations/useUpdateUserMutation';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import EditUsers from './EditUsers.vue';

// The modal writes through `useUpdateUserMutation` (PATCH /v1/users/:id). Spy on
// `mutateAsync` so we can assert the body the modal sends for both flows.
const mockMutateAsync = vi.fn();
vi.mock('@/composables/mutations/useUpdateUserMutation');
vi.mock('@/composables/queries/useUserClaimsQuery');

// `useToast` requires the PrimeVue ToastService provider; stub it so the modal's
// success toasts don't throw when mounted in isolation.
const mockToastAdd = vi.fn();
vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: mockToastAdd }),
}));

// Stub the heavy/irrelevant PrimeVue children so the modal mounts cleanly while
// the interactive controls under test (PvButton, PvInputText) stay real. PvDialog
// is rendered teleported by default; the passthrough stub keeps its content inline
// so the footer buttons are queryable.
const PV_STUBS = {
  PvDialog: { template: '<div><slot /><slot name="header" /><slot name="footer" /></div>' },
  PvDatePicker: { template: '<input />', props: ['modelValue'] },
  PvAutoComplete: { template: '<input />', props: ['modelValue'] },
  PvSelect: { template: '<select />', props: ['modelValue', 'options'] },
  PvCheckbox: { template: '<input type="checkbox" />', props: ['modelValue'] },
};

// A legacy nested user model (the shape produced by `mapUser`) for a student,
// including the FRL enum value so the profile-save assertion exercises `statusFrl`.
const studentUserData = () => ({
  id: '00000000-0000-0000-0000-000000000001',
  userType: 'student',
  name: { first: 'Ada', middle: 'B', last: 'Lovelace' },
  studentData: {
    dob: '2015-04-01',
    grade: '3',
    gender: 'female',
    race: ['White', 'Asian'],
    hispanic_ethnicity: false,
    ell_status: true,
    iep_status: false,
    frl_status: 'Free',
  },
});

// Mount with `isEnabled: false`, then flip it to true so the modal's
// `watch(() => props.isEnabled)` fires `setupUserData()` and populates
// `localUserData` from `props.userData` — exactly how the parent opens it.
// (A bare watcher does not run on the initial prop value.)
const mountModal = async (userData) => {
  const pinia = createTestingPinia({ stubActions: true });
  const authStore = useAuthStore();
  // The readiness gate reads `roarfirekit.restConfig()`; keep it returning true.
  authStore.roarfirekit = { restConfig: vi.fn().mockReturnValue(true) };

  const wrapper = mount(EditUsers, {
    props: { userData, isEnabled: false, userType: 'student' },
    global: {
      plugins: [pinia, VueQueryPlugin],
      stubs: PV_STUBS,
    },
  });

  await wrapper.setProps({ isEnabled: true });
  await wrapper.vm.$nextTick();
  return wrapper;
};

const findButtonByLabel = (wrapper, label) => wrapper.findAll('button').find((btn) => btn.text().includes(label));

describe('<EditUsers /> (PATCH /v1/users/:id migration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue(undefined);
    vi.mocked(useUpdateUserMutation).mockReturnValue({ mutateAsync: mockMutateAsync });
    vi.mocked(useUserClaimsQuery).mockReturnValue({ data: { value: undefined } });
  });

  it('saving the profile calls the update mutation with the mapped body (flat, camelCase)', async () => {
    const wrapper = await mountModal(studentUserData());

    const saveButton = findButtonByLabel(wrapper, 'Save');
    expect(saveButton, 'Save button should be rendered').toBeTruthy();
    await saveButton.trigger('click');
    await wrapper.vm.$nextTick();

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    const arg = mockMutateAsync.mock.calls[0][0];
    expect(arg.userId).toBe('00000000-0000-0000-0000-000000000001');
    // Mapped body is flat + camelCase, drops nested name/studentData and the
    // retired flags, and carries the FRL enum through as `statusFrl`.
    expect(arg.userData).toMatchObject({
      nameFirst: 'Ada',
      nameMiddle: 'B',
      nameLast: 'Lovelace',
      grade: '3',
      gender: 'female',
      statusEll: 'true',
      statusIep: 'false',
      statusFrl: 'Free',
      race: 'White, Asian',
      hispanicEthnicity: false,
    });
    expect(arg.userData).not.toHaveProperty('testData');
    expect(arg.userData).not.toHaveProperty('demoData');
    expect(arg.userData).not.toHaveProperty('name');
    expect(arg.userData).not.toHaveProperty('studentData');
  });

  it('saving a None FRL selection sends statusFrl: null', async () => {
    const data = studentUserData();
    data.studentData.frl_status = null;
    const wrapper = await mountModal(data);

    await findButtonByLabel(wrapper, 'Save').trigger('click');
    await wrapper.vm.$nextTick();

    expect(mockMutateAsync.mock.calls[0][0].userData.statusFrl).toBeNull();
  });

  it('changing the password calls the mutation with only { password } when valid', async () => {
    const wrapper = await mountModal(studentUserData());

    // Switch to the password view.
    await findButtonByLabel(wrapper, 'Change Password').trigger('click');
    await wrapper.vm.$nextTick();

    // Two password inputs: new + confirm. Set both to a valid (>=8) matching value.
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('longenough8');
    await inputs[1].setValue('longenough8');

    await findButtonByLabel(wrapper, 'Save Password').trigger('click');
    await wrapper.vm.$nextTick();

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith({
      userId: '00000000-0000-0000-0000-000000000001',
      userData: { password: 'longenough8' },
    });
  });

  it('rejects a password shorter than 8 characters and does not call the mutation', async () => {
    const wrapper = await mountModal(studentUserData());

    await findButtonByLabel(wrapper, 'Change Password').trigger('click');
    await wrapper.vm.$nextTick();

    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('short7!'); // 7 chars
    await inputs[1].setValue('short7!');

    await findButtonByLabel(wrapper, 'Save Password').trigger('click');
    await wrapper.vm.$nextTick();

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Password must be at least 8 characters');
  });

  it('rejects mismatched confirmation and does not call the mutation', async () => {
    const wrapper = await mountModal(studentUserData());

    await findButtonByLabel(wrapper, 'Change Password').trigger('click');
    await wrapper.vm.$nextTick();

    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('longenough8');
    await inputs[1].setValue('different9');

    await findButtonByLabel(wrapper, 'Save Password').trigger('click');
    await wrapper.vm.$nextTick();

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Passwords do not match');
  });
});
