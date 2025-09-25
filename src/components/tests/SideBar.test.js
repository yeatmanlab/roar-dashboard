import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import SideBar from '../SideBar.vue';

const i18nMock = vi.fn((key) => {
  const translations = {
    'participant-sidebar.assignments': 'Assignments',
    'participant-sidebar.statusCurrent': 'Current',
    'participant-sidebar.statusUpcoming': 'Upcoming',
    'participant-sidebar.statusPast': 'Past',
    'participant-sidebar.noCurrentAssignments': 'No current assignments were found',
    'participant-sidebar.noUpcomingAssignments': 'No upcoming assignments were found',
    'participant-sidebar.noPastAssignments': 'No past assignments were found',
  };
  return translations[key] || key;
});

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: i18nMock,
  }),
}));

const selectedStatusRef = ref('current');
const selectedAssignmentRef = ref(null);
const userAssignmentsRef = ref([]);

const mockAssignmentsStore = {
  selectedStatus: selectedStatusRef,
  selectedAssignment: selectedAssignmentRef,
  userAssignments: userAssignmentsRef,
  setSelectedStatus: vi.fn((status) => {
    selectedStatusRef.value = status;
  }),
  setSelectedAssignment: vi.fn(),
};

vi.mock('@/constants', () => ({
  ASSIGNMENT_STATUSES: {
    CURRENT: 'current',
    UPCOMING: 'upcoming',
    PAST: 'past',
  },
}));

vi.mock('@/store/assignments', () => ({
  useAssignmentsStore: vi.fn(() => mockAssignmentsStore),
}));

const getDynamicDates = () => {
  const today = new Date();
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(today.getDate() - 7);

  const oneWeekFromNow = new Date(today);
  oneWeekFromNow.setDate(today.getDate() + 7);

  return { oneWeekAgo, oneWeekFromNow };
};

const getTestAssignments = () => {
  const { oneWeekAgo, oneWeekFromNow } = getDynamicDates();

  return [
    {
      id: '1',
      name: 'Test Assignment 1',
      publicName: 'Public Test 1',
      completed: false,
      dateOpened: oneWeekAgo,
      dateClosed: oneWeekFromNow,
    },
    {
      id: '2',
      name: 'Test Assignment 2',
      publicName: 'Public Test 2',
      completed: false,
      dateOpened: oneWeekFromNow,
      dateClosed: new Date(oneWeekFromNow.getTime() + 7 * 24 * 60 * 60 * 1000), // 2 weeks from now
    },
    {
      id: '3',
      name: 'Test Assignment 3',
      publicName: 'Public Test 3',
      completed: false,
      dateOpened: new Date(oneWeekAgo.getTime() - 7 * 24 * 60 * 60 * 1000), // 2 weeks ago
      dateClosed: oneWeekAgo,
    },
  ];
};

const mountOptions = {
  global: {
    plugins: [PrimeVue],
    directives: {
      tooltip: {
        mounted: () => {},
        unmounted: () => {},
      },
    },
    mocks: {
      $t: i18nMock,
    },
  },
};

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  // Reset store state
  selectedStatusRef.value = 'current';
  selectedAssignmentRef.value = null;
  userAssignmentsRef.value = getTestAssignments();
});

describe('SideBar.vue', () => {
  describe('Component Rendering', () => {
    it('should render the sidebar component', () => {
      const wrapper = mount(SideBar, mountOptions);
      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('.sidebar').exists()).toBe(true);
    });

    it('should display the sidebar rail with correct structure', () => {
      const wrapper = mount(SideBar, mountOptions);
      const rail = wrapper.find('.sidebar__rail');

      expect(rail.exists()).toBe(true);
      expect(rail.find('.sidebar__toggle-btn').exists()).toBe(true);
      expect(rail.find('.sidebar__divider').exists()).toBe(true);
      expect(rail.find('.sidebar__nav').exists()).toBe(true);
    });
  });

  describe('Icon Display', () => {
    it('should display all 4 icons correctly', () => {
      const wrapper = mount(SideBar, mountOptions);

      expect(wrapper.find('.sidebar__toggle-btn .pi.pi-list').exists()).toBe(true);

      expect(wrapper.find('.sidebar__nav-link.--current .pi.pi-play').exists()).toBe(true);
      expect(wrapper.find('.sidebar__nav-link.--upcoming .pi.pi-clock').exists()).toBe(true);
      expect(wrapper.find('.sidebar__nav-link.--past .pi.pi-briefcase').exists()).toBe(true);
    });
  });

  describe('Toggle Button Functionality', () => {
    it('should show the panel when toggle button is clicked', async () => {
      const wrapper = mount(SideBar, mountOptions);

      expect(wrapper.find('.sidebar__panel').exists()).toBe(false);

      await wrapper.find('.sidebar__toggle-btn').trigger('click');

      expect(wrapper.find('.sidebar__panel').exists()).toBe(true);
    });

    it('should hide the panel when toggle button is clicked again', async () => {
      const wrapper = mount(SideBar, mountOptions);

      await wrapper.find('.sidebar__toggle-btn').trigger('click');

      expect(wrapper.find('.sidebar__panel').exists()).toBe(true);

      await wrapper.find('.sidebar__toggle-btn').trigger('click');

      expect(wrapper.find('.sidebar__panel').exists()).toBe(false);
    });

    it('should change toggle button icon when panel is open', async () => {
      const wrapper = mount(SideBar, mountOptions);

      expect(wrapper.find('.sidebar__toggle-btn .pi.pi-list').exists()).toBe(true);
      expect(wrapper.find('.sidebar__toggle-btn .pi.pi-times').exists()).toBe(false);

      await wrapper.find('.sidebar__toggle-btn').trigger('click');

      expect(wrapper.find('.sidebar__toggle-btn .pi.pi-list').exists()).toBe(false);
      expect(wrapper.find('.sidebar__toggle-btn .pi.pi-times').exists()).toBe(true);
    });

    it('should show backdrop when panel is open', async () => {
      const wrapper = mount(SideBar, mountOptions);

      expect(wrapper.find('.sidebar__panel__backdrop.is-active').exists()).toBe(false);

      await wrapper.find('.sidebar__toggle-btn').trigger('click');

      expect(wrapper.find('.sidebar__panel__backdrop.is-active').exists()).toBe(true);
    });
  });

  describe('Panel Content', () => {
    it('should display panel header with "Assignments" title', async () => {
      const wrapper = mount(SideBar, mountOptions);

      await wrapper.find('.sidebar__toggle-btn').trigger('click');

      const header = wrapper.find('.sidebar__panel__header');
      expect(header.exists()).toBe(true);
      expect(header.find('.sidebar__panel__title').text()).toBe('Assignments');
    });

    it('should display current assignments in the panel', async () => {
      const wrapper = mount(SideBar, mountOptions);

      await wrapper.find('.sidebar__toggle-btn').trigger('click');

      const currentGroup = wrapper.find('.assignment-group--current');
      expect(currentGroup.exists()).toBe(true);
      expect(currentGroup.find('.assignment-group__title').text()).toBe('Current 1');

      const assignment = currentGroup.find('.assignment-card');
      const assignmentName = assignment.find('.assignment-card__name');
      expect(assignmentName.html()).toContain('Public Test 1');
    });

    it('should display upcoming assignments in the panel', async () => {
      const wrapper = mount(SideBar, mountOptions);

      await wrapper.find('.sidebar__nav-link.--upcoming').trigger('click');

      await wrapper.vm.$nextTick();

      expect(wrapper.find('.sidebar__nav-link.--upcoming').classes()).toContain('--active');
      expect(wrapper.find('.assignment-group--upcoming').exists()).toBe(true);
    });

    it('should display past assignments in the panel', async () => {
      const wrapper = mount(SideBar, mountOptions);

      await wrapper.find('.sidebar__nav-link.--past').trigger('click');

      await wrapper.vm.$nextTick();

      expect(wrapper.find('.sidebar__nav-link.--past').classes()).toContain('--active');
      expect(wrapper.find('.assignment-group--past').exists()).toBe(true);
    });
  });

  describe('Navigation Link Functionality', () => {
    it('should open panel when navigation link is clicked', async () => {
      const wrapper = mount(SideBar, mountOptions);

      expect(wrapper.find('.sidebar__panel').exists()).toBe(false);

      await wrapper.find('.sidebar__nav-link.--current').trigger('click');

      expect(wrapper.find('.sidebar__panel').exists()).toBe(true);
    });

    it('should change selected status when navigation link is clicked', async () => {
      const wrapper = mount(SideBar, mountOptions);

      await wrapper.find('.sidebar__nav-link.--upcoming').trigger('click');

      expect(wrapper.find('.sidebar__nav-link.--upcoming.--active').exists()).toBe(true);
      expect(wrapper.find('.sidebar__nav-link.--current.--active').exists()).toBe(false);
    });
  });

  describe('Backdrop Functionality', () => {
    it('should close panel when backdrop is clicked', async () => {
      const wrapper = mount(SideBar, mountOptions);

      await wrapper.find('.sidebar__toggle-btn').trigger('click');

      expect(wrapper.find('.sidebar__panel').exists()).toBe(true);

      await wrapper.find('.sidebar__panel__backdrop').trigger('click');

      expect(wrapper.find('.sidebar__panel').exists()).toBe(false);
    });
  });

  describe('Assignment Selection', () => {
    it('should close panel when assignment is clicked', async () => {
      const wrapper = mount(SideBar, mountOptions);

      await wrapper.find('.sidebar__toggle-btn').trigger('click');

      expect(wrapper.find('.sidebar__panel').exists()).toBe(true);

      await wrapper.find('.assignment-card').trigger('click');

      expect(wrapper.find('.sidebar__panel').exists()).toBe(false);
    });
  });

  describe('Empty States', () => {
    it('should show empty message when no assignments exist', async () => {
      // Set empty assignments in store
      userAssignmentsRef.value = [];

      const wrapper = mount(SideBar, mountOptions);

      await wrapper.find('.sidebar__toggle-btn').trigger('click');

      expect(wrapper.find('.assignment-group__empty').exists()).toBe(true);
      expect(wrapper.text()).toContain('No current assignments were found');
    });
  });
});
