import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import EmptyStateComponent from './EmptyState.vue';

// Mock router
const mockRouter = {
  go: vi.fn(),
};

describe('EmptyState.vue', () => {
  let i18n;

  beforeEach(() => {
    vi.clearAllMocks();

    i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          scoreReports: {
            stillWorking: '{firstName} is still working!',
            needOneComplete: '{firstName} needs to complete at least one assessment.',
          },
        },
      },
    });
  });

  describe('snapshots', () => {
    it('renders with student first name', () => {
      const wrapper = mount(EmptyStateComponent, {
        props: {
          studentFirstName: 'John',
        },
        global: {
          plugins: [i18n],
          mocks: {
            $router: mockRouter,
          },
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders with different student name', () => {
      const wrapper = mount(EmptyStateComponent, {
        props: {
          studentFirstName: 'Sarah',
        },
        global: {
          plugins: [i18n],
          mocks: {
            $router: mockRouter,
          },
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });
  });

  describe('component behavior', () => {
    it('displays student first name in title', () => {
      const wrapper = mount(EmptyStateComponent, {
        props: {
          studentFirstName: 'John',
        },
        global: {
          plugins: [i18n],
          mocks: {
            $router: mockRouter,
          },
        },
      });

      expect(wrapper.text()).toContain('John');
      expect(wrapper.text()).toContain('is still working!');
    });

    it('displays student first name in description', () => {
      const wrapper = mount(EmptyStateComponent, {
        props: {
          studentFirstName: 'Sarah',
        },
        global: {
          plugins: [i18n],
          mocks: {
            $router: mockRouter,
          },
        },
      });

      expect(wrapper.text()).toContain('Sarah');
      expect(wrapper.text()).toContain('needs to complete at least one assessment');
    });

    it('calls router.go(-1) when back button is clicked', async () => {
      const wrapper = mount(EmptyStateComponent, {
        props: {
          studentFirstName: 'John',
        },
        global: {
          plugins: [i18n],
          mocks: {
            $router: mockRouter,
          },
        },
      });

      const backButton = wrapper.find('button');
      await backButton.trigger('click');

      expect(mockRouter.go).toHaveBeenCalledWith(-1);
    });

    it('renders back button with correct text', () => {
      const wrapper = mount(EmptyStateComponent, {
        props: {
          studentFirstName: 'John',
        },
        global: {
          plugins: [i18n],
          mocks: {
            $router: mockRouter,
          },
        },
      });

      expect(wrapper.text()).toContain('Back to overview');
    });
  });
});
