import AssignmentCard from '@/components/assignments/AssignmentCard.vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockOnClick = vi.fn();

const mockIncompleteAssessments = [
  { taskId: 'task1', variantName: 'Variant A', completedOn: new Date('2024-01-10 00:00:00') },
  { taskId: 'task2', variantName: 'Variant B', completedOn: null },
];

const mockAssignmentData = {
  id: '1',
  name: 'Test Assignment',
  publicName: 'Public Test Assignment',
  dateOpened: new Date('2024-01-01 00:00:00'),
  dateClosed: new Date('2024-01-31 00:00:00'),
  assessments: mockIncompleteAssessments,
};

vi.mock('@/constants', () => ({
  ASSIGNMENT_STATUSES: {
    CURRENT: 'current',
    UPCOMING: 'upcoming',
    PAST: 'past',
  },
}));

vi.mock('date-fns', () => ({
  format: vi.fn((date) => {
    if (date instanceof Date) {
      return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    }
    return 'Invalid Date';
  }),
}));

const mountOptions = (props = {}) => ({
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
    data: mockAssignmentData,
    isActive: false,
    status: 'current',
    onClick: mockOnClick,
    ...props,
  },
});

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

describe('AssignmentCard.vue', () => {
  describe('Component Rendering', () => {
    it('should render the assignment card component', () => {
      const wrapper = mount(AssignmentCard, mountOptions());
      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('.assignment-card').exists()).toBe(true);
    });

    it('should display the assignment name correctly', () => {
      const wrapper = mount(AssignmentCard, mountOptions());
      const nameElement = wrapper.find('.assignment-card__name');

      expect(nameElement.exists()).toBe(true);
      expect(nameElement.text()).toContain('Public Test Assignment');
    });

    it('should fallback to name when publicName is not available', () => {
      const dataWithoutPublicName = { ...mockAssignmentData, publicName: undefined };
      const wrapper = mount(AssignmentCard, mountOptions({ data: dataWithoutPublicName }));

      expect(wrapper.find('.assignment-card__name').text()).toContain('Test Assignment');
    });

    it('should display assignment dates when available', () => {
      const wrapper = mount(AssignmentCard, mountOptions());
      const datesElement = wrapper.find('.assignment-card__dates');

      expect(datesElement.exists()).toBe(true);
      expect(datesElement.find('.pi.pi-calendar').exists()).toBe(true);
      expect(datesElement.text()).toContain('Jan 01, 2024 — Jan 31, 2024');
    });

    it('should not display dates section when dates are missing', () => {
      const dataWithoutDates = { ...mockAssignmentData, dateOpened: undefined, dateClosed: undefined };
      const wrapper = mount(AssignmentCard, mountOptions({ data: dataWithoutDates }));

      expect(wrapper.find('.assignment-card__dates').exists()).toBe(false);
    });
  });

  describe('Status-based Rendering', () => {
    it('should display lock icon for upcoming assignments', () => {
      const wrapper = mount(AssignmentCard, mountOptions({ status: 'upcoming' }));
      const lockIcon = wrapper.find('.pi.pi-lock.--upcoming');

      expect(lockIcon.exists()).toBe(true);
    });

    it('should display check-circle icon for past assignments if completed', () => {
      const dataWithCompletedAssessments = { ...mockAssignmentData, completed: true };
      const wrapper = mount(AssignmentCard, mountOptions({ data: dataWithCompletedAssessments, status: 'past' }));
      const checkIcon = wrapper.find('.pi.pi-check-circle.--past');

      expect(checkIcon.exists()).toBe(true);
    });

    it('should not display status icons for current assignments', () => {
      const wrapper = mount(AssignmentCard, mountOptions({ status: 'current' }));

      expect(wrapper.find('.pi.pi-lock').exists()).toBe(false);
      expect(wrapper.find('.pi.pi-check-circle').exists()).toBe(false);
    });
  });

  describe('Active State Styling', () => {
    it('should apply active styling when isActive is true', () => {
      const wrapper = mount(AssignmentCard, mountOptions({ isActive: true }));
      const card = wrapper.find('.assignment-card');

      expect(card.classes()).toContain('--active');
    });

    it('should display selected icon when active', () => {
      const wrapper = mount(AssignmentCard, mountOptions({ isActive: true }));
      const selectedIcon = wrapper.find('.assignment-card__selected-icon');

      expect(selectedIcon.exists()).toBe(true);
      expect(selectedIcon.find('.pi.pi-angle-right').exists()).toBe(true);
    });

    it('should not display selected icon when not active', () => {
      const wrapper = mount(AssignmentCard, mountOptions({ isActive: false }));

      expect(wrapper.find('.assignment-card__selected-icon').exists()).toBe(false);
    });

    it('should apply active background and border colors', () => {
      const wrapper = mount(AssignmentCard, mountOptions({ isActive: true }));
      const card = wrapper.find('.assignment-card');

      expect(card.classes()).toContain('--active');
    });
  });

  describe('Click Functionality', () => {
    it('should call onClick when card is clicked and onClick is provided', async () => {
      const wrapper = mount(AssignmentCard, mountOptions());

      await wrapper.find('.assignment-card').trigger('click');

      expect(mockOnClick).toHaveBeenCalledWith(mockAssignmentData, 'current');
    });

    it('should not call onClick when onClick is not provided', async () => {
      const wrapper = mount(AssignmentCard, mountOptions({ onClick: undefined }));

      await wrapper.find('.assignment-card').trigger('click');

      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('should call onClick with correct parameters', async () => {
      const wrapper = mount(AssignmentCard, mountOptions({ status: 'upcoming' }));

      await wrapper.find('.assignment-card').trigger('click');

      expect(mockOnClick).toHaveBeenCalledWith(mockAssignmentData, 'upcoming');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined onClick gracefully', () => {
      const wrapper = mount(AssignmentCard, mountOptions({ onClick: undefined }));

      expect(wrapper.exists()).toBe(true);
      expect(() => wrapper.find('.assignment-card').trigger('click')).not.toThrow();
    });
  });

  describe('CSS Classes and Styling', () => {
    it('should apply base assignment-card class', () => {
      const wrapper = mount(AssignmentCard, mountOptions());
      const card = wrapper.find('.assignment-card');

      expect(card.classes()).toContain('assignment-card');
    });

    it('should apply active class when isActive is true', () => {
      const wrapper = mount(AssignmentCard, mountOptions({ isActive: true }));
      const card = wrapper.find('.assignment-card');

      expect(card.classes()).toContain('--active');
    });
  });

  describe('Data Display Accuracy', () => {
    it('should display the correct assignment name', () => {
      const customData = { ...mockAssignmentData, publicName: 'Custom Public Name' };
      const wrapper = mount(AssignmentCard, mountOptions({ data: customData }));

      expect(wrapper.find('.assignment-card__name').text()).toContain('Custom Public Name');
    });

    it('should format dates correctly using date-fns', () => {
      const customData = {
        ...mockAssignmentData,
        dateOpened: new Date('2024-12-25'),
        dateClosed: new Date('2024-12-31'),
      };
      const wrapper = mount(AssignmentCard, mountOptions({ data: customData }));

      const datesElement = wrapper.find('.assignment-card__dates');
      expect(datesElement.exists()).toBe(true);
    });
  });
});
