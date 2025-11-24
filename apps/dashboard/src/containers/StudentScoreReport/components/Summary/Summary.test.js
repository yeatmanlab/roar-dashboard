import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import Summary from './Summary.vue';

describe('Summary.vue', () => {
  let i18n;

  beforeEach(() => {
    i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          scoreReports: {
            roarSummary: 'This is a summary of assessment results.',
            completedTasks: 'This report includes scores for the following assessments:',
            summary: 'Based on these results, {firstName} shows strong performance.',
          },
        },
      },
    });
  });

  describe('snapshots', () => {
    it('renders with single task', () => {
      const wrapper = mount(Summary, {
        props: {
          studentFirstName: 'John',
          tasks: 'Single Word Reading',
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders with multiple tasks', () => {
      const wrapper = mount(Summary, {
        props: {
          studentFirstName: 'Sarah',
          tasks: 'Single Word Reading, Sentence Reading, Phonological Awareness',
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders with different student name', () => {
      const wrapper = mount(Summary, {
        props: {
          studentFirstName: 'Michael',
          tasks: 'Single Word Reading, Phonics',
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });
  });

  describe('component behavior', () => {
    it('displays student first name', () => {
      const wrapper = mount(Summary, {
        props: {
          studentFirstName: 'John',
          tasks: 'Single Word Reading',
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.text()).toContain('John');
    });

    it('displays tasks list', () => {
      const wrapper = mount(Summary, {
        props: {
          studentFirstName: 'John',
          tasks: 'Single Word Reading',
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.text()).toContain('Single Word Reading');
    });

    it('renders list with proper structure', () => {
      const wrapper = mount(Summary, {
        props: {
          studentFirstName: 'John',
          tasks: 'Single Word Reading',
        },
        global: {
          plugins: [i18n],
        },
      });

      const list = wrapper.find('ul');
      expect(list.exists()).toBe(true);
      expect(list.classes()).toContain('list-none');
    });

    it('renders summary paragraph', () => {
      const wrapper = mount(Summary, {
        props: {
          studentFirstName: 'John',
          tasks: 'Single Word Reading',
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.text()).toContain('Based on these results, John shows strong performance');
    });
  });
});
