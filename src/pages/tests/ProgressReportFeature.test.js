import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import ProgressReportFeature from '../ProgressReportFeature.vue';

const {
  mockExportCsv,
  mockFetchAdministrationById,
  mockFetchOrgBySingularRouteType,
  mockGetAdministrationOrgProgress,
  mockRouterPush,
  mockRouterReplace,
} = vi.hoisted(() => ({
  mockExportCsv: vi.fn(),
  mockFetchAdministrationById: vi.fn(),
  mockFetchOrgBySingularRouteType: vi.fn(),
  mockGetAdministrationOrgProgress: vi.fn(),
  mockRouterPush: vi.fn(),
  mockRouterReplace: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: { tab: 'progress' },
  }),
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
  }),
}));

vi.mock('@bdelab/roar-utils', () => ({
  default: {
    //
  },
}));

vi.mock('primevue/chart', () => ({
  default: {
    name: 'PvChart',
    props: ['data', 'options', 'type'],
    template: '<div class="pv-chart" />',
  },
}));

vi.mock('primevue/floatlabel', () => ({
  default: {
    name: 'PvFloatLabel',
    template: '<div><slot /></div>',
  },
}));

vi.mock('primevue/inputtext', () => ({
  default: {
    name: 'PvInputText',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
}));

vi.mock('primevue/multiselect', () => ({
  default: {
    name: 'PvMultiSelect',
    template: '<div class="pv-multiselect" />',
  },
}));

vi.mock('primevue/selectbutton', () => ({
  default: {
    name: 'PvSelectButton',
    template: '<div class="pv-select-button" />',
  },
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn(() => ({
    $subscribe: vi.fn(),
    roarfirekit: ref({
      restConfig: true,
    }),
  })),
}));

vi.mock('@/composables/queries/useTasksDictionaryQuery', () => ({
  default: () => ({
    data: ref({
      math: {
        name: 'Math',
        publicName: 'Math Public',
      },
      vocab: {
        name: 'Vocabulary',
        publicName: 'Vocabulary Public',
      },
    }),
    isLoading: ref(false),
  }),
}));

vi.mock('@/composables/useAdministrationSyncStatus', () => ({
  useAdministrationSyncStatus: () => ({
    displayedSyncStatus: ref(undefined),
  }),
}));

vi.mock('@/firebase/repositories/AdministrationsRepository', () => ({
  administrationsRepository: {
    fetchAdministrationById: mockFetchAdministrationById,
    fetchOrgBySingularRouteType: mockFetchOrgBySingularRouteType,
  },
}));

vi.mock('@/firebase/repositories/UsersRepository', () => ({
  usersRepository: {
    getAdministrationOrgProgress: mockGetAdministrationOrgProgress,
  },
}));

vi.mock('@/helpers', () => ({
  getTooltip: () => ({}),
  isLevante: false,
  normalizeToLowercase: (value) => String(value ?? '').toLowerCase(),
}));

vi.mock('@/helpers/getDynamicRouterPath', () => ({
  getDynamicRouterPath: (route, params) => `${route.path}/${params.administrationId}/${params.orgType}/${params.orgId}`,
}));

vi.mock('@/constants/routes', () => ({
  APP_ROUTES: {
    SCORE_REPORT: {
      path: '/score-report/:administrationId/:orgType/:orgId',
    },
  },
}));

vi.mock('@/helpers/query/utils', () => ({
  exportCsv: mockExportCsv,
}));

vi.mock('@/helpers/userType', () => ({
  normalizeUserTypeForDisplay: (userType) => userType,
}));

vi.mock('@/components/RoarDataTable.vue', () => ({
  default: defineComponent({
    name: 'RoarDataTable',
    props: {
      allowExport: Boolean,
      allowFiltering: Boolean,
      columns: {
        type: Array,
        default: () => [],
      },
      data: {
        type: Array,
        default: () => [],
      },
      lazyPreSorting: {
        type: Array,
        default: () => [],
      },
      totalRecords: Number,
    },
    emits: ['export-all', 'export-selected'],
    setup(props, { emit, slots }) {
      return () =>
        h('div', { 'data-cy': 'roar-data-table' }, [
          h('button', { 'data-testid': 'export-all', onClick: () => emit('export-all') }, 'Export All'),
          h(
            'button',
            {
              'data-testid': 'export-selected',
              onClick: () => emit('export-selected', props.data.slice(0, 1)),
            },
            'Export Selected',
          ),
          slots.filterbar?.(),
        ]);
    },
  }),
}));

const administration = {
  assessments: [{ taskId: 'vocab' }, { taskId: 'math' }],
  creatorName: 'Dr. Ada Lovelace',
  name: 'Winter Progress Assignment',
};

const orgDoc = {
  name: 'North District',
};

const progressPayload = {
  taskProgress: [
    {
      counts: {
        completed: 1,
        notStarted: 1,
        started: 1,
      },
      taskId: 'vocab',
      userIds: {
        completed: ['student-1'],
        started: ['student-2'],
      },
      variantName: 'Vocabulary Variant',
    },
    {
      counts: {
        completed: 1,
        notStarted: 1,
        started: 1,
      },
      taskId: 'math',
      userIds: {
        completed: ['teacher-1'],
        started: ['student-1'],
      },
      variantName: 'Math Variant',
    },
  ],
  users: [
    {
      email: 'alice@example.com',
      status: 'completed',
      userId: 'student-1',
      userType: 'student',
    },
    {
      email: 'bob@example.com',
      status: 'started',
      userId: 'student-2',
      userType: 'student',
    },
    {
      email: 'teacher@example.com',
      status: 'notStarted',
      userId: 'teacher-1',
      userType: 'teacher',
    },
  ],
};

const defaultProps = {
  administrationId: 'admin-123',
  orgId: 'district-123',
  orgType: 'district',
};

function mountProgressReport(props = {}) {
  return mount(ProgressReportFeature, {
    global: {
      directives: {
        tooltip: {},
      },
      stubs: {
        LevanteSpinner: true,
      },
    },
    props: {
      ...defaultProps,
      ...props,
    },
  });
}

async function mountLoadedProgressReport(props = {}) {
  const wrapper = mountProgressReport(props);

  await flushPromises();
  await nextTick();

  return wrapper;
}

beforeEach(() => {
  setActivePinia(createPinia());

  mockExportCsv.mockClear();
  mockFetchAdministrationById.mockResolvedValue(administration);
  mockFetchOrgBySingularRouteType.mockResolvedValue(orgDoc);
  mockGetAdministrationOrgProgress.mockResolvedValue(progressPayload);
  mockRouterPush.mockClear();
  mockRouterReplace.mockClear();
});

describe('ProgressReportFeature.vue', () => {
  it('fetches progress data and renders the loaded report', async () => {
    const wrapper = await mountLoadedProgressReport();
    const table = wrapper.findComponent({ name: 'RoarDataTable' });

    expect(mockFetchAdministrationById).toHaveBeenCalledWith('admin-123');
    expect(mockFetchOrgBySingularRouteType).toHaveBeenCalledWith('district', 'district-123');
    expect(mockGetAdministrationOrgProgress).toHaveBeenCalledWith({
      administrationId: 'admin-123',
      orgId: 'district-123',
      orgType: 'districts',
    });
    expect(wrapper.text()).toContain('Site Progress Report');
    expect(wrapper.text()).toContain('North District');
    expect(wrapper.text()).toContain('Winter Progress Assignment');
    expect(wrapper.text()).toContain('Dr. Ada Lovelace');
    expect(wrapper.text()).toContain('Total');
    expect(wrapper.text()).toContain('Assigned to 3 users');
    expect(table.exists()).toBe(true);
    expect(table.props('allowFiltering')).toBe(true);
    expect(table.props('totalRecords')).toBe(3);
    expect(table.props('lazyPreSorting')).toEqual([
      { order: '1', field: 'user.schoolName' },
      { order: '1', field: 'user.grade' },
      { order: '1', field: 'user.lastName' },
    ]);
  });

  it('builds table rows and task columns from the progress payload', async () => {
    const wrapper = await mountLoadedProgressReport();
    const table = wrapper.findComponent({ name: 'RoarDataTable' });
    const columnHeaders = table.props('columns').map((column) => column.header);

    expect(columnHeaders).toEqual(['UID', 'User Login', 'User Type', 'Math', 'Vocabulary']);
    expect(table.props('data')).toEqual([
      {
        progress: {
          math: {
            icon: 'pi pi-clock',
            severity: 'warn',
            tags: ' Started ',
            value: 'Started',
          },
          vocab: {
            icon: 'pi pi-check-circle',
            severity: 'success',
            tags: ' Completed ',
            value: 'Completed',
          },
        },
        user: {
          assessmentPid: undefined,
          grade: undefined,
          userId: 'student-1',
          userType: 'student',
          username: 'alice@example.com',
        },
      },
      {
        progress: {
          math: {
            icon: 'pi pi-minus-circle',
            severity: 'warning',
            tags: ' Not Started ',
            value: 'Not Started',
          },
          vocab: {
            icon: 'pi pi-clock',
            severity: 'warn',
            tags: ' Started ',
            value: 'Started',
          },
        },
        user: {
          assessmentPid: undefined,
          grade: undefined,
          userId: 'student-2',
          userType: 'student',
          username: 'bob@example.com',
        },
      },
      {
        progress: {
          math: {
            icon: 'pi pi-check-circle',
            severity: 'success',
            tags: ' Completed ',
            value: 'Completed',
          },
          vocab: {
            icon: 'pi pi-minus-circle',
            severity: 'warning',
            tags: ' Not Started ',
            value: 'Not Started',
          },
        },
        user: {
          assessmentPid: undefined,
          grade: undefined,
          userId: 'teacher-1',
          userType: 'teacher',
          username: 'teacher@example.com',
        },
      },
    ]);
  });

  it('filters table rows by login search input', async () => {
    const wrapper = await mountLoadedProgressReport();

    wrapper.vm.searchInput = 'bob';
    await nextTick();

    const table = wrapper.findComponent({ name: 'RoarDataTable' });

    expect(table.props('data')).toHaveLength(1);
    expect(table.props('data')[0].user.username).toBe('bob@example.com');
  });

  it('exports all and selected progress rows as CSV data', async () => {
    const wrapper = await mountLoadedProgressReport();

    await wrapper.find('[data-testid="export-all"]').trigger('click');
    await wrapper.find('[data-testid="export-selected"]').trigger('click');

    expect(mockExportCsv).toHaveBeenNthCalledWith(
      1,
      [
        {
          'Math Public': 'Started',
          School: '',
          'User Login': 'alice@example.com',
          'User Type': 'Student',
          'Vocabulary Public': 'Completed',
        },
        {
          'Math Public': 'Not Started',
          School: '',
          'User Login': 'bob@example.com',
          'User Type': 'Student',
          'Vocabulary Public': 'Started',
        },
        {
          'Math Public': 'Completed',
          School: '',
          'User Login': 'teacher@example.com',
          'User Type': 'Teacher',
          'Vocabulary Public': 'Not Started',
        },
      ],
      'progress-report-winter-progress-assignment-north-district.csv',
    );
    expect(mockExportCsv).toHaveBeenNthCalledWith(
      2,
      [
        {
          'Math Public': 'Started',
          School: '',
          'User Login': 'alice@example.com',
          'User Type': 'Student',
          'Vocabulary Public': 'Completed',
        },
      ],
      'progress-selected.csv',
    );
  });

  it('navigates to the score report with the current route query', async () => {
    const wrapper = await mountLoadedProgressReport();

    wrapper.vm.handleViewChange();

    expect(mockRouterPush).toHaveBeenCalledWith({
      path: '/score-report/:administrationId/:orgType/:orgId/admin-123/district/district-123',
      query: { tab: 'progress' },
    });
  });

  it('renders the fetch error state when progress data cannot be loaded', async () => {
    mockGetAdministrationOrgProgress.mockRejectedValue(new Error('Progress fetch failed'));

    const wrapper = await mountLoadedProgressReport();

    expect(wrapper.text()).toContain('There was a problem fetching the assignment details.');
    expect(wrapper.text()).toContain('Please refresh the page or try again later.');
    expect(wrapper.findComponent({ name: 'RoarDataTable' }).exists()).toBe(false);
  });
});
