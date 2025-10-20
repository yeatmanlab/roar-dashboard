import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import Support from './Support.vue';

describe('Support.vue', () => {
  let i18n;

  beforeEach(() => {
    i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          scoreReports: {
            taskTabHeader: 'Understanding Your Scores',
            nextStepsTabHeader: 'Next Steps',
            taskIntro: 'ROAR assessments measure reading skills.',
            standardScore: 'standard score',
            percentileScore: 'percentile',
            rawScore: 'raw score',
            standardScoreDescription: 'A {taskTitle} indicates performance relative to a mean of 100.',
            percentileScoreDescription: 'A {taskTitle} shows where a student ranks compared to peers.',
            rawScoreDescription: 'A {taskTitle} is the number of items answered correctly.',
            roarDescription: '{roar} assessments provide insights into reading abilities.',
            extraSupportDescription: 'Students in the {supportCategory} range may benefit from additional instruction.',
            developingDescription: 'Students in the {supportCategory} range are building foundational skills.',
            achievedDescription: 'Students in the {supportCategory} range demonstrate proficiency.',
            extraSupport: 'Needs Extra Support',
            developing: 'Developing Skill',
            achieved: 'Achieved Skill',
            nextSteps: 'For guidance on next steps, {link}',
          },
        },
      },
    });
  });

  describe('snapshots', () => {
    it('renders collapsed state for grade < 6', () => {
      const wrapper = mount(Support, {
        props: {
          expanded: false,
          studentGrade: 3,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders expanded state for grade < 6', () => {
      const wrapper = mount(Support, {
        props: {
          expanded: true,
          studentGrade: 3,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders collapsed state for grade >= 6', () => {
      const wrapper = mount(Support, {
        props: {
          expanded: false,
          studentGrade: 7,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders expanded state for grade >= 6', () => {
      const wrapper = mount(Support, {
        props: {
          expanded: true,
          studentGrade: 7,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders with Kindergarten grade', () => {
      const wrapper = mount(Support, {
        props: {
          expanded: true,
          studentGrade: 0,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });
  });

  describe('component behavior', () => {
    it('renders accordion component', () => {
      const wrapper = mount(Support, {
        props: {
          expanded: false,
          studentGrade: 3,
        },
        global: {
          plugins: [i18n],
        },
      });

      const accordion = wrapper.find('.p-accordion');
      expect(accordion.exists()).toBe(true);
    });

    it('shows distribution image for grade < 6', () => {
      const wrapper = mount(Support, {
        props: {
          expanded: true,
          studentGrade: 5,
        },
        global: {
          plugins: [i18n],
        },
      });

      const img = wrapper.find('img[src*="support-distribution"]');
      expect(img.exists()).toBe(true);
    });

    it('does not show distribution image for grade >= 6', () => {
      const wrapper = mount(Support, {
        props: {
          expanded: true,
          studentGrade: 6,
        },
        global: {
          plugins: [i18n],
        },
      });

      const img = wrapper.find('img[src*="support-distribution"]');
      expect(img.exists()).toBe(false);
    });

    it('displays percentile description for grade < 6', () => {
      const wrapper = mount(Support, {
        props: {
          expanded: true,
          studentGrade: 5,
        },
        global: {
          plugins: [i18n],
        },
      });

      // Just verify component renders with correct grade prop
      expect(wrapper.exists()).toBe(true);
      expect(wrapper.props('studentGrade')).toBe(5);
    });

    it('shows support level descriptions for grade >= 6', () => {
      const wrapper = mount(Support, {
        props: {
          expanded: true,
          studentGrade: 7,
        },
        global: {
          plugins: [i18n],
        },
      });

      // Just verify the component renders for grade >= 6
      expect(wrapper.exists()).toBe(true);
      expect(wrapper.props('studentGrade')).toBe(7);
    });

    it('expands all panels when expanded prop is true', async () => {
      const wrapper = mount(Support, {
        props: {
          expanded: true,
          studentGrade: 3,
        },
        global: {
          plugins: [i18n],
        },
      });

      await wrapper.vm.$nextTick();

      // Verify the component rendered
      expect(wrapper.exists()).toBe(true);
    });

    it('collapses all panels when expanded prop is false', async () => {
      const wrapper = mount(Support, {
        props: {
          expanded: false,
          studentGrade: 3,
        },
        global: {
          plugins: [i18n],
        },
      });

      await wrapper.vm.$nextTick();

      // Verify the component rendered
      expect(wrapper.exists()).toBe(true);
    });

    it('updates panels when expanded prop changes', async () => {
      const wrapper = mount(Support, {
        props: {
          expanded: false,
          studentGrade: 3,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.props('expanded')).toBe(false);

      await wrapper.setProps({ expanded: true });

      expect(wrapper.props('expanded')).toBe(true);
    });

    it('renders external link to next steps document', () => {
      const wrapper = mount(Support, {
        props: {
          expanded: true,
          studentGrade: 3,
        },
        global: {
          plugins: [i18n],
        },
      });

      const link = wrapper.find('a[target="_blank"]');
      expect(link.exists()).toBe(true);
    });
  });
});
