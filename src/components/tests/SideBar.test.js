import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SideBar from '../SideBar.vue';

const mockAssignmentsStore = {
  selectedStatus: 'current',
  selectedAssignment: null,
  setSelectedStatus: vi.fn((status) => {
    mockAssignmentsStore.selectedStatus = status;
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

vi.mock('date-fns', () => ({
  format: vi.fn(() => 'Jan 01, 2024'),
}));

const getDynamicDates = () => {
  const today = new Date();
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(today.getDate() - 7);

  const oneWeekFromNow = new Date(today);
  oneWeekFromNow.setDate(today.getDate() + 7);

  return { oneWeekAgo, oneWeekFromNow };
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
  },
  props: {
    currentAssignments: [
      {
        id: '1',
        name: 'Test Assignment 1',
        publicName: 'Public Test 1',
        dateOpened: getDynamicDates().oneWeekAgo,
        dateClosed: getDynamicDates().oneWeekFromNow,
      },
    ],
    upcomingAssignments: [
      {
        id: '2',
        name: 'Test Assignment 2',
        publicName: 'Public Test 2',
        dateOpened: getDynamicDates().oneWeekFromNow,
        dateClosed: new Date(getDynamicDates().oneWeekFromNow.getTime() + 7 * 24 * 60 * 60 * 1000), // 2 weeks from now
      },
    ],
    pastAssignments: [
      {
        id: '3',
        name: 'Test Assignment 3',
        publicName: 'Public Test 3',
        dateOpened: new Date(getDynamicDates().oneWeekAgo.getTime() - 7 * 24 * 60 * 60 * 1000), // 2 weeks ago
        dateClosed: getDynamicDates().oneWeekAgo,
      },
    ],
  },
};

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  // Reset store state
  mockAssignmentsStore.selectedStatus = 'current';
  mockAssignmentsStore.selectedAssignment = null;
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
    it('should display the toggle button icon (first icon)', () => {
      const wrapper = mount(SideBar, mountOptions);
      const toggleBtn = wrapper.find('.sidebar__toggle-btn');

      expect(toggleBtn.exists()).toBe(true);
      expect(toggleBtn.find('.pi.pi-list').exists()).toBe(true);
    });

    it('should display the current assignments icon (second icon)', () => {
      const wrapper = mount(SideBar, mountOptions);
      const currentIcon = wrapper.find('.sidebar__nav-link.--current');

      expect(currentIcon.exists()).toBe(true);
      expect(currentIcon.find('.pi.pi-play').exists()).toBe(true);
    });

    it('should display the upcoming assignments icon (third icon)', () => {
      const wrapper = mount(SideBar, mountOptions);
      const upcomingIcon = wrapper.find('.sidebar__nav-link.--upcoming');

      expect(upcomingIcon.exists()).toBe(true);
      expect(upcomingIcon.find('.pi.pi-clock').exists()).toBe(true);
    });

    it('should display the past assignments icon (fourth icon)', () => {
      const wrapper = mount(SideBar, mountOptions);
      const pastIcon = wrapper.find('.sidebar__nav-link.--past');

      expect(pastIcon.exists()).toBe(true);
      expect(pastIcon.find('.pi.pi-briefcase').exists()).toBe(true);
    });

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
      expect(currentGroup.find('.assignment-group__title').text()).toBe('Current');

      const assignment = currentGroup.find('.assignment-group__item');
      expect(assignment.exists()).toBe(true);
      expect(assignment.find('.assignment__name').text()).toBe('Public Test 1');
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

      await wrapper.find('.assignment-group__item').trigger('click');

      expect(wrapper.find('.sidebar__panel').exists()).toBe(false);
    });
  });

  describe('Empty States', () => {
    it('should show empty message when no assignments exist', async () => {
      const wrapper = mount(SideBar, {
        ...mountOptions,
        props: {
          currentAssignments: [],
          upcomingAssignments: [],
          pastAssignments: [],
        },
      });

      await wrapper.find('.sidebar__toggle-btn').trigger('click');

      expect(wrapper.find('.assignment-group__empty').exists()).toBe(true);
      expect(wrapper.text()).toContain('No current assignments were found');
    });
  });
});
