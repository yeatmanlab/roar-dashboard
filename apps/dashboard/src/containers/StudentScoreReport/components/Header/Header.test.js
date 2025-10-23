import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import Header from './Header.vue';

// Mock the getGradeWithSuffix helper
vi.mock('@/helpers/reports.js', () => ({
  getGradeWithSuffix: vi.fn((grade) => {
    const gradeNum = parseInt(grade);
    if (gradeNum === 0) return 'Kindergarten';
    const suffix = gradeNum === 1 ? 'st' : gradeNum === 2 ? 'nd' : gradeNum === 3 ? 'rd' : 'th';
    return `${gradeNum}${suffix} Grade`;
  }),
}));

describe('Header.vue - Snapshots', () => {
  let i18n;

  beforeEach(() => {
    i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          scoreReports: {
            pageTitle: 'Student Score Report',
            expandSections: 'Expand All',
            collapseSections: 'Collapse All',
            exportPDF: 'Export PDF',
            grade: 'Grade',
            class: 'Class',
            administration: 'Administration',
          },
        },
      },
    });
  });

  describe('snapshots', () => {
    it('renders minimal props (firstName only)', () => {
      const wrapper = mount(Header, {
        props: {
          studentFirstName: 'John',
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders with full props', () => {
      const wrapper = mount(Header, {
        props: {
          studentFirstName: 'John',
          studentLastName: 'Doe',
          studentGrade: 3,
          className: 'Ms. Smith',
          administrationName: 'Fall 2024',
          expanded: false,
          exportLoading: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders expanded state', () => {
      const wrapper = mount(Header, {
        props: {
          studentFirstName: 'John',
          studentLastName: 'Doe',
          expanded: true,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders loading state', () => {
      const wrapper = mount(Header, {
        props: {
          studentFirstName: 'John',
          exportLoading: true,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders with Kindergarten grade', () => {
      const wrapper = mount(Header, {
        props: {
          studentFirstName: 'Sarah',
          studentGrade: 0,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders without optional metadata', () => {
      const wrapper = mount(Header, {
        props: {
          studentFirstName: 'John',
          studentLastName: 'Doe',
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });
  });

  describe('component behavior', () => {
    it('displays student name correctly', () => {
      const wrapper = mount(Header, {
        props: {
          studentFirstName: 'John',
          studentLastName: 'Doe',
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.text()).toContain('John Doe');
    });

    it('emits toggleExpand event when expand button clicked', async () => {
      const wrapper = mount(Header, {
        props: {
          studentFirstName: 'John',
        },
        global: {
          plugins: [i18n],
        },
      });

      const expandBtn = wrapper.find('[data-cy="report__expand-btn"]');
      await expandBtn.trigger('click');

      expect(wrapper.emitted('toggleExpand')).toHaveLength(1);
    });

    it('emits exportPdf event when export button clicked', async () => {
      const wrapper = mount(Header, {
        props: {
          studentFirstName: 'John',
        },
        global: {
          plugins: [i18n],
        },
      });

      const exportBtn = wrapper.find('[data-cy="report__pdf-export-btn"]');
      await exportBtn.trigger('click');

      expect(wrapper.emitted('exportPdf')).toHaveLength(1);
    });

    it('disables export button when loading', () => {
      const wrapper = mount(Header, {
        props: {
          studentFirstName: 'John',
          exportLoading: true,
        },
        global: {
          plugins: [i18n],
        },
      });

      const exportBtn = wrapper.find('[data-cy="report__pdf-export-btn"]');
      expect(exportBtn.attributes('disabled')).toBeDefined();
    });

    it('shows loading spinner when exportLoading is true', () => {
      const wrapper = mount(Header, {
        props: {
          studentFirstName: 'John',
          exportLoading: true,
        },
        global: {
          plugins: [i18n],
        },
      });

      const exportBtn = wrapper.find('[data-cy="report__pdf-export-btn"]');
      expect(exportBtn.html()).toContain('pi-spinner');
    });

    it('renders with expanded prop', () => {
      const wrapper = mount(Header, {
        props: {
          studentFirstName: 'John',
          expanded: true,
        },
        global: {
          plugins: [i18n],
        },
      });

      // Just verify the component renders with the expanded prop
      expect(wrapper.exists()).toBe(true);
      expect(wrapper.props('expanded')).toBe(true);
    });

    it('displays grade metadata when provided', () => {
      const wrapper = mount(Header, {
        props: {
          studentFirstName: 'John',
          studentGrade: 5,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.text()).toContain('5th Grade');
    });

    it('displays class metadata when provided', () => {
      const wrapper = mount(Header, {
        props: {
          studentFirstName: 'John',
          className: 'Ms. Johnson',
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.text()).toContain('Ms. Johnson');
    });

    it('displays administration metadata when provided', () => {
      const wrapper = mount(Header, {
        props: {
          studentFirstName: 'John',
          administrationName: 'Spring 2024',
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.text()).toContain('Spring 2024');
    });

    it('does not render metadata section when no metadata provided', () => {
      const wrapper = mount(Header, {
        props: {
          studentFirstName: 'John',
        },
        global: {
          plugins: [i18n],
        },
      });

      // Check that the dl element (metadata container) doesn't exist
      expect(wrapper.find('dl').exists()).toBe(false);
    });
  });
});
