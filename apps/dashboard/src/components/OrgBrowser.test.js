import { mount, flushPromises } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { reactive, ref } from 'vue';
import OrgPicker from './OrgPicker.vue';
import OrgsList from '@/containers/OrgsList/OrgsList.vue';
import { DISTRICTS_LIST_QUERY_KEY } from '@/constants/queryKeys';

const currentUser = ref();
const authStore = reactive({ accessToken: 'token', isAuthReady: true });
const api = {
  districts: { list: vi.fn(), listSchools: vi.fn() },
  schools: { listClasses: vi.fn() },
  groups: { list: vi.fn() },
};
vi.mock('@/clients/roar-api', () => ({ getRoarApiClient: () => api }));
vi.mock('@/store/auth', () => ({ useAuthStore: () => authStore }));
vi.mock('@/composables/useCurrentUser', () => ({ default: () => ({ data: currentUser }) }));
vi.mock('@/composables/usePermissions', () => ({
  usePermissions: () => ({ userCan: () => false, Permissions: { Users: {}, Organizations: {} } }),
}));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }));
vi.mock('@/helpers/query/utils', () => ({ exportCsv: vi.fn() }));
vi.mock('@/components/RoarDataTable', () => ({
  default: { name: 'RoarDataTable', props: ['data'], template: '<div />' },
}));
vi.mock('@/components/EditOrgsForm.vue', () => ({ default: { template: '<div />' } }));
vi.mock('@/containers/OrgsList/components/OrgExportModal.vue', () => ({ default: { template: '<div />' } }));
vi.mock('@/containers/OrgsList/composables/useOrgExportOrchestrator', () => ({
  useOrgExportOrchestrator: () => ({
    modalState: ref({}),
    exportingOrgId: ref(),
    exportPhase: ref(),
    EXPORT_PHASE: {},
  }),
}));

const result = (items) => ({ status: 200, body: { data: { items, pagination: { totalPages: 1 } } } });
const district = { id: 'd1', name: 'Accessible district' };
const school = { id: 's1', name: 'Accessible school' };
const classroom = { id: 'c1', name: 'Accessible class' };
const group = { id: 'g1', name: 'Accessible group' };

describe.each([
  ['OrgPicker', OrgPicker],
  ['OrgsList', OrgsList],
])('%s', (_name, component) => {
  let wrapper;
  let client;
  const mountBrowser = () => {
    wrapper = mount(component, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: client }]],
        renderStubDefaultSlot: true,
        stubs: {
          Panel: true,
          ScrollPanel: true,
          FloatLabel: true,
          Select: true,
          Listbox: { name: 'Listbox', props: ['options', 'modelValue'], template: '<div />' },
          Checkbox: true,
          Chip: true,
          Button: false,
          Toast: true,
          ToggleButton: false,
          InputGroup: true,
          InputText: true,
          Dialog: true,
          RoarModal: true,
          EditOrgsForm: true,
          OrgExportModal: true,
          RoarDataTable: true,
        },
      },
    });
  };
  const openTab = async (index) => {
    await wrapper.findAll('[role="tab"]').at(index).trigger('click');
    await flushPromises();
  };
  const displayedNames = () => {
    const list = wrapper.findComponent({ name: component === OrgPicker ? 'Listbox' : 'RoarDataTable' });
    return list.exists() ? (list.props(component === OrgPicker ? 'options' : 'data') ?? []).map((org) => org.name) : [];
  };

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: Infinity } } });
    currentUser.value = { userType: 'educator', isSuperAdmin: false };
    authStore.accessToken = 'token';
    authStore.isAuthReady = true;
    api.districts.list.mockResolvedValue(result([district]));
    api.districts.listSchools.mockResolvedValue(result([school]));
    api.schools.listClasses.mockResolvedValue(result([classroom]));
    api.groups.list.mockResolvedValue(result([group]));
  });
  afterEach(() => {
    wrapper?.unmount();
    client.clear();
  });

  it.each(['admin', 'educator', 'super-admin'])(
    'browses backend-scoped organizations as %s without claims',
    async (userType) => {
      currentUser.value = { userType, isSuperAdmin: userType === 'super-admin' };
      mountBrowser();
      expect(wrapper.findAll('[role="tab"]')).toHaveLength(4);
      await vi.waitFor(() => expect(displayedNames()).toEqual([district.name]));
      await openTab(1);
      await vi.waitFor(() => expect(displayedNames()).toEqual([school.name]));
      expect(api.districts.listSchools).toHaveBeenCalledWith(expect.objectContaining({ params: { districtId: 'd1' } }));
      await openTab(2);
      await vi.waitFor(() => expect(displayedNames()).toEqual([classroom.name]));
      expect(api.schools.listClasses).toHaveBeenCalledWith(expect.objectContaining({ params: { schoolId: 's1' } }));
      await openTab(3);
      await vi.waitFor(() => expect(displayedNames()).toEqual([group.name]));
    },
  );

  if (component === OrgPicker) {
    it('emits selected backend organizations', async () => {
      mountBrowser();
      await openTab(3);
      await vi.waitFor(() => expect(displayedNames()).toEqual([group.name]));
      wrapper.findComponent({ name: 'Listbox' }).vm.$emit('update:modelValue', [group]);
      await flushPromises();
      expect(wrapper.emitted('selection').at(-1)[0].groups).toEqual([group]);
    });
  }

  it('keeps Groups reachable for a group-only user with no districts', async () => {
    api.districts.list.mockResolvedValue(result([]));
    mountBrowser();
    await vi.waitFor(() => expect(wrapper.text()).toContain('No organizations available.'));
    expect(api.groups.list).not.toHaveBeenCalled();
    await openTab(3);
    await vi.waitFor(() => expect(displayedNames()).toEqual([group.name]));
  });

  it('distinguishes loading, parent-query errors, retry, and empty results', async () => {
    let finish;
    api.districts.list.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    mountBrowser();
    await openTab(2);
    expect(wrapper.text()).toContain('Loading organizations...');
    expect(wrapper.text()).not.toContain('No organizations available.');
    api.districts.list.mockResolvedValue({ status: 403, body: {} });
    finish({ status: 403, body: {} });
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true));
    expect(wrapper.text()).not.toContain('No organizations available.');
    api.districts.list.mockResolvedValue(result([]));
    await wrapper.get('[role="alert"] button').trigger('click');
    await vi.waitFor(() => expect(wrapper.text()).toContain('No organizations available.'));
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('initializes parent selectors from fresh cached districts', async () => {
    client.setQueryData([DISTRICTS_LIST_QUERY_KEY], [district]);
    client.setQueryDefaults([DISTRICTS_LIST_QUERY_KEY], { staleTime: Infinity });
    mountBrowser();
    await openTab(2);
    await vi.waitFor(() => expect(displayedNames()).toEqual([classroom.name]));
    expect(api.districts.list).not.toHaveBeenCalled();
    expect(api.districts.listSchools).toHaveBeenCalledWith(expect.objectContaining({ params: { districtId: 'd1' } }));
  });

  it('clears the previous school while a new district is loading', async () => {
    api.districts.list.mockResolvedValue(result([district, { id: 'd2', name: 'Second district' }]));
    mountBrowser();
    await openTab(2);
    await vi.waitFor(() => expect(displayedNames()).toEqual([classroom.name]));
    let finishSchools;
    api.districts.listSchools.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSchools = resolve;
        }),
    );
    wrapper.findComponent('[input-id="district"]').vm.$emit('update:modelValue', 'd2');
    await flushPromises();
    expect(wrapper.text()).toContain('Loading organizations...');
    expect(displayedNames()).toEqual([]);
    api.schools.listClasses.mockResolvedValue(result([{ id: 'c2', name: 'Second class' }]));
    finishSchools(result([{ id: 's2', name: 'Second school' }]));
    await vi.waitFor(() => expect(displayedNames()).toEqual(['Second class']));
    expect(api.schools.listClasses).toHaveBeenLastCalledWith(expect.objectContaining({ params: { schoolId: 's2' } }));
  });
});
