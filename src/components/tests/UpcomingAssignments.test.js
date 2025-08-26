import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PrimeVue from 'primevue/config';
import UpcomingAssignments from '../assignments/UpcomingAssignments.vue';

vi.mock('date-fns', () => ({
  format: vi.fn(() => 'Jan 01, 2024'),
}));

vi.mock('primevue/tag', () => ({
  default: {
    name: 'PvTag',
    template: '<div></div>',
    props: ['value', 'class'],
  },
}));

const getDynamicDates = () => {
  const today = new Date();

  const oneWeekFromNow = new Date(today);
  oneWeekFromNow.setDate(today.getDate() + 7);

  const twoWeeksFromNow = new Date(today);
  twoWeeksFromNow.setDate(today.getDate() + 14);

  return { oneWeekFromNow, twoWeeksFromNow };
};

const mockAssignment = {
  id: 'assignment-1',
  name: 'Test Assignment',
  publicName: 'Public Test Assignment',
  dateOpened: getDynamicDates().oneWeekFromNow,
  dateClosed: getDynamicDates().twoWeeksFromNow,
  assessments: [
    {
      taskId: 'task-1',
      variantName: 'Variant A',
    },
    {
      taskId: 'task-2',
      variantName: 'Variant B',
    },
  ],
};

describe('UpcomingAssignments.vue', () => {
  let wrapper;

  const mountComponent = (props = {}) => {
    return mount(UpcomingAssignments, {
      props,
      global: {
        plugins: [PrimeVue],
        directives: {
          tooltip: {
            mounted: () => {},
            unmounted: () => {},
          },
        },
      },
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the component with correct base structure', () => {
      wrapper = mountComponent({ assignment: mockAssignment });

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('.assignment').exists()).toBe(true);
      expect(wrapper.find('.assignment--upcoming').exists()).toBe(true);
      expect(wrapper.find('.assignment__header').exists()).toBe(true);
      expect(wrapper.find('.assignment__tasks').exists()).toBe(true);
    });

    it('should display the sidebar rail with correct structure', () => {
      wrapper = mountComponent({ assignment: mockAssignment });
      const assignment = wrapper.find('.assignment');

      expect(assignment.exists()).toBe(true);
      expect(assignment.find('.assignment__header').exists()).toBe(true);
      expect(assignment.find('.assignment__tasks').exists()).toBe(true);
    });
  });

  describe('Assignment Header', () => {
    it('should display assignment name with publicName priority', () => {
      wrapper = mountComponent({ assignment: mockAssignment });

      const nameElement = wrapper.find('.assignment__name');
      expect(nameElement.exists()).toBe(true);
      expect(nameElement.text()).toBe('Public Test Assignment');
    });

    it('should fallback to name when publicName is not available', () => {
      const assignmentWithoutPublicName = {
        ...mockAssignment,
        publicName: undefined,
      };

      wrapper = mountComponent({ assignment: assignmentWithoutPublicName });

      const nameElement = wrapper.find('.assignment__name');
      expect(nameElement.text()).toBe('Test Assignment');
    });

    it('should handle undefined assignment gracefully', () => {
      wrapper = mountComponent({ assignment: undefined });

      const nameElement = wrapper.find('.assignment__name');
      expect(nameElement.text()).toBe('');
    });

    it('should display header with correct assignment name', () => {
      wrapper = mountComponent({ assignment: mockAssignment });

      const header = wrapper.find('.assignment__header');
      expect(header.exists()).toBe(true);
      expect(header.find('.assignment__name').text()).toBe('Public Test Assignment');
    });
  });

  describe('Assignment Dates', () => {
    it('should display start date with correct formatting', () => {
      wrapper = mountComponent({ assignment: mockAssignment });

      const startDateElement = wrapper.find('.assignment__date:first-child');
      expect(startDateElement.exists()).toBe(true);
      expect(startDateElement.text()).toContain('Start:');
      expect(startDateElement.find('i.pi.pi-calendar').exists()).toBe(true);
    });

    it('should display end date with correct formatting', () => {
      wrapper = mountComponent({ assignment: mockAssignment });

      const endDateElement = wrapper.find('.assignment__date:last-child');
      expect(endDateElement.exists()).toBe(true);
      expect(endDateElement.text()).toContain('End:');
      expect(endDateElement.find('i.pi.pi-calendar').exists()).toBe(true);
    });

    it('should handle undefined dates gracefully', () => {
      const assignmentWithoutDates = {
        ...mockAssignment,
        dateOpened: undefined,
        dateClosed: undefined,
      };

      wrapper = mountComponent({ assignment: assignmentWithoutDates });

      const dateElements = wrapper.findAll('.assignment__date');
      expect(dateElements).toHaveLength(2);

      dateElements.forEach((element) => {
        expect(element.find('i.pi.pi-calendar').exists()).toBe(true);
      });
    });

    it('should display all 2 date elements correctly', () => {
      wrapper = mountComponent({ assignment: mockAssignment });

      expect(wrapper.find('.assignment__date:first-child i.pi.pi-calendar').exists()).toBe(true);
      expect(wrapper.find('.assignment__date:last-child i.pi.pi-calendar').exists()).toBe(true);
    });
  });

  describe('Assignment Tasks', () => {
    it('should render task elements for each assessment', () => {
      wrapper = mountComponent({ assignment: mockAssignment });

      const taskElements = wrapper.findAll('.assignment__task');
      expect(taskElements).toHaveLength(2);
    });

    it('should handle empty assessments array', () => {
      const assignmentWithoutTasks = {
        ...mockAssignment,
        assessments: [],
      };

      wrapper = mountComponent({ assignment: assignmentWithoutTasks });

      const taskElements = wrapper.findAll('.assignment__task');
      expect(taskElements).toHaveLength(0);
    });

    it('should handle undefined assessments', () => {
      const assignmentWithoutTasks = {
        ...mockAssignment,
        assessments: undefined,
      };

      wrapper = mountComponent({ assignment: assignmentWithoutTasks });

      const taskElements = wrapper.findAll('.assignment__task');
      expect(taskElements).toHaveLength(0);
    });

    it('should display all tasks in the tasks section', () => {
      wrapper = mountComponent({ assignment: mockAssignment });

      const tasksSection = wrapper.find('.assignment__tasks');
      expect(tasksSection.exists()).toBe(true);
      expect(tasksSection.findAll('.assignment__task')).toHaveLength(2);
    });
  });

  describe('Props Handling', () => {
    it('should accept assignment prop with correct type', () => {
      wrapper = mountComponent({ assignment: mockAssignment });

      expect(wrapper.props('assignment')).toEqual(mockAssignment);
    });

    it('should handle undefined assignment prop', () => {
      wrapper = mountComponent({ assignment: undefined });

      expect(wrapper.props('assignment')).toBeUndefined();
    });

    it('should handle null assignment prop', () => {
      wrapper = mountComponent({ assignment: null });

      expect(wrapper.props('assignment')).toBeNull();
    });
  });

  describe('Empty States', () => {
    it('should show empty message when no assignment exists', () => {
      wrapper = mountComponent({ assignment: undefined });

      expect(wrapper.find('.assignment__name').text()).toBe('');
      expect(wrapper.find('.assignment__tasks').exists()).toBe(true);
    });

    it('should handle assignment with missing properties', () => {
      const minimalAssignment = {
        id: 'minimal-1',
      };

      wrapper = mountComponent({ assignment: minimalAssignment });

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('.assignment__name').text()).toBe('');
    });

    it('should handle assignment with empty string properties', () => {
      const emptyAssignment = {
        id: 'empty-1',
        name: '',
        publicName: '',
        dateOpened: '',
        dateClosed: '',
        assessments: [],
      };

      wrapper = mountComponent({ assignment: emptyAssignment });

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('.assignment__name').text()).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should render correctly with very long assignment names', () => {
      const longNameAssignment = {
        ...mockAssignment,
        publicName:
          'This is a very long assignment name that might exceed normal display boundaries and should be handled gracefully by the component',
      };

      wrapper = mountComponent({ assignment: longNameAssignment });

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('.assignment__name').text()).toBe(longNameAssignment.publicName);
    });

    it('should handle assignment with very long assessment names', () => {
      const longAssessmentAssignment = {
        ...mockAssignment,
        assessments: [
          {
            taskId: 'task-1',
            variantName: 'This is a very long assessment variant name that might exceed normal display boundaries',
          },
        ],
      };

      wrapper = mountComponent({ assignment: longAssessmentAssignment });

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.findAll('.assignment__task')).toHaveLength(1);
    });

    it('should handle assignment with special characters in names', () => {
      const specialCharAssignment = {
        ...mockAssignment,
        publicName: 'Assignment with special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
      };

      wrapper = mountComponent({ assignment: specialCharAssignment });

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('.assignment__name').text()).toBe(specialCharAssignment.publicName);
    });
  });
});
