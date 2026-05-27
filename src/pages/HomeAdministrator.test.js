import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import PrimeVue from 'primevue/config';
import useAdministrationsListQuery from '@/composables/queries/useAdministrationsListQuery';
import { useGetSiteOverviewQuery } from '@/composables/queries/useGetSiteOverviewQuery';
import HomeAdministrator from '@/pages/HomeAdministrator.vue';
import ViewAssignments from '@/pages/ViewAssignments.vue';
import { useAuthStore } from '@/store/auth';

vi.mock('@/composables/queries/useGetSiteOverviewQuery', () => ({
  useGetSiteOverviewQuery: vi.fn(),
}));

vi.mock('@/composables/queries/useAdministrationsListQuery', () => ({
  default: vi.fn(),
}));

// `@bdelab/roar-utils` has a broken transitive import path; stub it so tests can load.
vi.mock('@bdelab/roar-utils', () => ({ default: {} }));

vi.mock('@/components/DocsButton.vue', () => ({
  default: {
    name: 'DocsButton',
    props: ['href', 'label'],
    template: '<a :href="href" data-cy="docs-button">{{ label }}</a>',
  },
}));

vi.mock('@/components/LevanteSpinner.vue', () => ({
  default: {
    name: 'LevanteSpinner',
    props: ['size', 'fullscreen'],
    template: '<div class="levante-spinner" data-cy="levante-spinner">Loading...</div>',
  },
}));

const buildOverview = (overrides = {}) => ({
  counts: {
    users: { teachers: 4, caregivers: 5, children: 12 },
    assignments: { open: 2, upcoming: 1, closed: 3 },
  },
  schools: [
    { id: 'school-b', name: 'Beta School' },
    { id: 'school-a', name: 'Alpha School' },
  ],
  classes: [
    { id: 'class-2', name: 'Class Two', schoolId: 'school-a' },
    { id: 'class-1', name: 'Class One', schoolId: 'school-b' },
  ],
  cohorts: [
    { id: 'cohort-z', name: 'Zebra Cohort' },
    { id: 'cohort-a', name: 'Apple Cohort' },
  ],
  ...overrides,
});

const mockOverviewQuery = ({ data = undefined, isLoading = false } = {}) => {
  vi.mocked(useGetSiteOverviewQuery).mockReturnValue({
    data: ref(data),
    isLoading: ref(isLoading),
    isError: ref(false),
    error: ref(null),
    isSuccess: ref(!isLoading && data !== undefined),
  });
};

const mountPage = () => {
  const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn });

  const authStore = useAuthStore(pinia);
  authStore.currentSite = 'site-1';
  authStore.userData = { displayName: 'Ada Lovelace' };
  authStore.roarfirekit = { initialized: true };

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const wrapper = mount(HomeAdministrator, {
    global: {
      plugins: [pinia, PrimeVue, [VueQueryPlugin, { queryClient }]],
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a :data-test-to="JSON.stringify(to)" data-cy="router-link"><slot /></a>',
        },
      },
    },
  });

  return { wrapper, authStore };
};

describe('HomeAdministrator', () => {
  beforeEach(() => {
    mockOverviewQuery({ data: buildOverview() });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the full-screen spinner while the overview is loading', async () => {
    mockOverviewQuery({ isLoading: true });

    const { wrapper } = mountPage();
    await flushPromises();

    expect(wrapper.find('[data-cy="levante-spinner"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Welcome');
  });

  it('greets the admin by their displayName', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('Welcome,');
    expect(wrapper.text()).toContain('Ada Lovelace');
  });

  it('falls back to first/middle/last when displayName is missing', async () => {
    const { wrapper, authStore } = mountPage();
    authStore.userData = { name: { first: 'Grace', middle: 'B.', last: 'Hopper' } };
    await flushPromises();

    expect(wrapper.text()).toContain('Grace B. Hopper');
  });

  it('shows the "select a site" banner and dashes when currentSite is "any"', async () => {
    const { wrapper, authStore } = mountPage();
    authStore.currentSite = 'any';
    await flushPromises();

    expect(wrapper.text()).toContain('Select a site to see stats');
    const dashCount = wrapper.findAll('small').filter((el) => el.text() === '-').length;
    expect(dashCount).toBeGreaterThanOrEqual(3);
  });

  it('renders user counts and total when data is loaded', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('Teachers');
    expect(text).toContain('Caregivers');
    expect(text).toContain('Children');
    // Total = 4 + 5 + 12 = 21
    expect(text).toContain('21');
  });

  it('renders assignment counts and total', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('Open Assignments');
    expect(text).toContain('Upcoming Assignments');
    expect(text).toContain('Past Assignments');
    // Total = 2 + 1 + 3 = 6
    expect(text).toContain('6');
  });

  it('passes the assignment status through router-link state for non-zero buckets', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const links = wrapper.findAll('[data-cy="router-link"]').map((el) => JSON.parse(el.attributes('data-test-to')));

    const openLink = links.find((to) => to?.state?.status === 'open');
    const upcomingLink = links.find((to) => to?.state?.status === 'upcoming');
    const closedLink = links.find((to) => to?.state?.status === 'closed');

    expect(openLink?.name).toBe('ViewAssignments');
    expect(upcomingLink?.name).toBe('ViewAssignments');
    expect(closedLink?.name).toBe('ViewAssignments');
  });

  it('disables the "View {status}" link when the bucket is empty', async () => {
    mockOverviewQuery({
      data: buildOverview({
        counts: {
          users: { teachers: 0, caregivers: 0, children: 0 },
          assignments: { open: 0, upcoming: 2, closed: 1 },
        },
      }),
    });

    const { wrapper } = mountPage();
    await flushPromises();

    // The open card has numOf=0, so its "View open" should be rendered as a disabled div, not a router-link
    const links = wrapper.findAll('[data-cy="router-link"]').map((el) => JSON.parse(el.attributes('data-test-to')));
    expect(links.some((to) => to?.state?.status === 'open')).toBe(false);

    // Disabled state is shown via opacity-50 wrapper
    expect(wrapper.html()).toContain('opacity-50');
  });

  it('sorts schools, classes, and cohorts alphabetically by name', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const html = wrapper.html();
    expect(html.indexOf('Alpha School')).toBeLessThan(html.indexOf('Beta School'));
    expect(html.indexOf('Class One')).toBeLessThan(html.indexOf('Class Two'));
    expect(html.indexOf('Apple Cohort')).toBeLessThan(html.indexOf('Zebra Cohort'));
  });

  it('renders the parent school name above each class', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const classCardHtml = wrapper.html();
    // Class One has schoolId 'school-b' which is 'Beta School'
    expect(classCardHtml).toContain('Beta School');
    // Class Two has schoolId 'school-a' which is 'Alpha School'
    expect(classCardHtml).toContain('Alpha School');
  });

  it('shows empty-state copy when a group bucket is empty', async () => {
    mockOverviewQuery({
      data: buildOverview({ schools: [], classes: [], cohorts: [] }),
    });

    const { wrapper } = mountPage();
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('There are no schools yet');
    expect(text).toContain('There are no classes yet');
    expect(text).toContain('There are no cohorts yet');
  });

  it('replaces the "View X" CTA with "Create" when a bucket is empty', async () => {
    mockOverviewQuery({
      data: buildOverview({ schools: [], classes: [], cohorts: [] }),
    });

    const { wrapper } = mountPage();
    await flushPromises();

    const createLinks = wrapper.findAll('[data-cy="router-link"]').filter((el) => el.text().includes('Create'));
    expect(createLinks.length).toBe(3);
  });
});

describe('Welcome page → ViewAssignments handoff', () => {
  // happy-dom does not actually persist state from history.pushState/replaceState (the `state`
  // getter always returns null), so we stub the getter directly to simulate router navigation
  // state and spy on replaceState to verify the on-mount cleanup.
  const stubHistoryState = (state) => {
    vi.spyOn(history, 'state', 'get').mockReturnValue(state);
  };

  const mockAdministrationsListQuery = (administrations = []) => {
    vi.mocked(useAdministrationsListQuery).mockReturnValue({
      data: ref(administrations),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
      error: ref(null),
      isSuccess: ref(true),
    });
  };

  const mountViewAssignments = () => {
    const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn });

    const authStore = useAuthStore(pinia);
    authStore.currentSite = 'site-1';
    authStore.roarfirekit = { restConfig: true };

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return mount(ViewAssignments, {
      global: {
        plugins: [pinia, PrimeVue, [VueQueryPlugin, { queryClient }]],
        stubs: {
          CardAdministration: true,
          RouterLink: true,
        },
      },
    });
  };

  const getFilterValue = (wrapper) =>
    wrapper.findComponent('[data-cy="dropdown-filter-administrations"]').props('modelValue');

  beforeEach(() => {
    mockAdministrationsListQuery();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes the status filter from history.state when arriving from a "View open" card', async () => {
    stubHistoryState({ status: 'open' });

    const wrapper = mountViewAssignments();
    await flushPromises();

    expect(getFilterValue(wrapper)).toEqual({ label: 'Open', value: 'open' });
  });

  it.each([
    ['upcoming', { label: 'Upcoming', value: 'upcoming' }],
    ['closed', { label: 'Closed', value: 'closed' }],
  ])('also honors the %s status from history.state', async (status, expectedOption) => {
    stubHistoryState({ status });

    const wrapper = mountViewAssignments();
    await flushPromises();

    expect(getFilterValue(wrapper)).toEqual(expectedOption);
  });

  it('clears the one-shot router state on mount so a refresh does not re-apply the filter', async () => {
    stubHistoryState({ status: 'open' });
    const replaceStateSpy = vi.spyOn(history, 'replaceState');

    mountViewAssignments();
    await flushPromises();

    expect(replaceStateSpy).toHaveBeenCalledWith({}, '');
  });

  it('falls back to the default "All" filter when history.state has no status', async () => {
    stubHistoryState(null);

    const wrapper = mountViewAssignments();
    await flushPromises();

    expect(getFilterValue(wrapper)).toEqual({ label: 'All', value: null });
  });

  it('ignores an unrecognized status value and uses the default filter', async () => {
    stubHistoryState({ status: 'not-a-real-status' });

    const wrapper = mountViewAssignments();
    await flushPromises();

    expect(getFilterValue(wrapper)).toEqual({ label: 'All', value: null });
  });
});
