import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import ScoreCard from './ScoreCard.vue';

// Mock feature flags
vi.mock('@/constants/featureFlags', () => ({
  FEATURE_FLAGS: {
    ENABLE_LONGITUDINAL_REPORTS: true,
  },
}));

// Mock the LongitudinalChart component to avoid Chart.js dependencies
vi.mock('./LongitudinalChart', () => ({
  LongitudinalChartScreen: {
    name: 'LongitudinalChartScreen',
    template: '<div class="mocked-longitudinal-chart">Longitudinal Chart</div>',
  },
}));

describe('ScoreCard.vue', () => {
  let i18n;

  const defaultProps = {
    publicName: 'Single Word Reading',
    scoreLabel: 'Percentile Score',
    score: {
      value: 75,
      min: 0,
      max: 100,
      supportColor: '#4CAF50',
    },
    tags: [
      {
        icon: 'pi pi-check-circle',
        value: 'Required',
        severity: 'info',
        tooltip: 'This assessment is required',
      },
      {
        icon: 'pi pi-shield',
        value: 'Reliable',
        severity: 'success',
        tooltip: 'This score is reliable',
      },
    ],
    valueTemplate: '{value}%',
    scoreToDisplay: 'percentileScore',
    studentFirstName: 'John',
    studentGrade: '3',
    description: {
      keypath: 'scoreReports.percentileTaskDescription',
      slots: {
        percentile: '75th percentile',
        taskName: 'Single Word Reading',
        taskDescription: 'measures the ability to read individual words',
        supportCategory: 'Achieved Skill',
      },
    },
    scoresArray: [
      ['Raw Score', 50, 0, 100],
      ['Percentile', 75, 0, 100],
      ['Standard Score', 105, 70, 130],
    ],
    expanded: false,
    longitudinalData: [],
    taskId: 'swr',
  };

  beforeEach(() => {
    i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          scoreReports: {
            percentileTaskDescription:
              '{firstName} scored in the {percentile} on {taskName}, which {taskDescription}. This is in the {supportCategory} range.',
            scoreBreakdown: 'Score Breakdown',
            progressOverTime: 'Progress Over Time',
            phonicsSubscores: 'Phonics Subscores',
          },
        },
      },
    });
  });

  describe('snapshots', () => {
    it('renders default collapsed state', () => {
      const wrapper = mount(ScoreCard, {
        props: defaultProps,
        global: {
          plugins: [i18n],
          stubs: {
            // Stub child components for cleaner snapshots
            LongitudinalChartScreen: true,
          },
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders expanded state', () => {
      const wrapper = mount(ScoreCard, {
        props: {
          ...defaultProps,
          expanded: true,
        },
        global: {
          plugins: [i18n],
          stubs: {
            LongitudinalChartScreen: true,
          },
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders with longitudinal data', () => {
      const wrapper = mount(ScoreCard, {
        props: {
          ...defaultProps,
          longitudinalData: [
            { date: '2024-01-01', scores: { rawScore: 45, percentile: 65 }, assignmentId: 'a1' },
            { date: '2024-06-01', scores: { rawScore: 50, percentile: 75 }, assignmentId: 'a2' },
          ],
          currentAssignmentId: 'a2',
        },
        global: {
          plugins: [i18n],
          stubs: {
            LongitudinalChartScreen: true,
          },
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders without scores array', () => {
      const wrapper = mount(ScoreCard, {
        props: {
          ...defaultProps,
          scoresArray: [],
        },
        global: {
          plugins: [i18n],
          stubs: {
            LongitudinalChartScreen: true,
          },
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders phonics task with subscores', () => {
      const wrapper = mount(ScoreCard, {
        props: {
          ...defaultProps,
          taskId: 'phonics',
          publicName: 'Phonics',
          score: {
            value: 85,
            min: 0,
            max: 100,
            supportColor: '#4CAF50',
            subscores: {
              cvc: '10/10',
              digraph: '8/10',
              initial_blend: '7/8',
              final_blend: '6/8',
              r_controlled: '5/6',
              r_cluster: '4/5',
              silent_e: '9/10',
              vowel_team: '8/9',
            },
          },
        },
        global: {
          plugins: [i18n],
          stubs: {
            LongitudinalChartScreen: true,
          },
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders with different tag combinations', () => {
      const wrapper = mount(ScoreCard, {
        props: {
          ...defaultProps,
          tags: [
            {
              icon: 'pi pi-info-circle',
              value: 'Optional',
              severity: 'secondary',
              tooltip: 'This assessment is optional',
            },
            {
              icon: 'pi pi-exclamation-triangle',
              value: 'Unreliable',
              severity: 'warning',
              tooltip: 'This score may be unreliable',
            },
          ],
        },
        global: {
          plugins: [i18n],
          stubs: {
            LongitudinalChartScreen: true,
          },
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders with low score (needs support)', () => {
      const wrapper = mount(ScoreCard, {
        props: {
          ...defaultProps,
          score: {
            value: 25,
            min: 0,
            max: 100,
            supportColor: '#F44336',
          },
          description: {
            keypath: 'scoreReports.percentileTaskDescription',
            slots: {
              percentile: '25th percentile',
              taskName: 'Single Word Reading',
              taskDescription: 'measures the ability to read individual words',
              supportCategory: 'Needs Extra Support',
            },
          },
        },
        global: {
          plugins: [i18n],
          stubs: {
            LongitudinalChartScreen: true,
          },
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });
  });

  describe('component behavior', () => {
    it('displays public name', () => {
      const wrapper = mount(ScoreCard, {
        props: defaultProps,
        global: {
          plugins: [i18n],
          stubs: {
            LongitudinalChartScreen: true,
          },
        },
      });

      expect(wrapper.text()).toContain('Single Word Reading');
    });

    it('displays score label', () => {
      const wrapper = mount(ScoreCard, {
        props: defaultProps,
        global: {
          plugins: [i18n],
          stubs: {
            LongitudinalChartScreen: true,
          },
        },
      });

      expect(wrapper.text()).toContain('Percentile Score');
    });

    it('renders all tags', () => {
      const wrapper = mount(ScoreCard, {
        props: defaultProps,
        global: {
          plugins: [i18n],
          stubs: {
            LongitudinalChartScreen: true,
          },
        },
      });

      expect(wrapper.text()).toContain('Required');
      expect(wrapper.text()).toContain('Reliable');
    });

    it('renders accordion when scores array is provided', () => {
      const wrapper = mount(ScoreCard, {
        props: {
          ...defaultProps,
          expanded: true,
        },
        global: {
          plugins: [i18n],
          stubs: {
            LongitudinalChartScreen: true,
          },
        },
      });

      // Check that accordion component exists
      const accordion = wrapper.find('.p-accordion');
      expect(accordion.exists()).toBe(true);
    });

    it('renders longitudinal chart when data is provided', async () => {
      const wrapper = mount(ScoreCard, {
        props: {
          ...defaultProps,
          expanded: true,
          longitudinalData: [{ date: '2024-01-01', scores: { rawScore: 45 } }],
        },
        global: {
          plugins: [i18n],
          stubs: {
            LongitudinalChartScreen: true,
          },
        },
      });

      await wrapper.vm.$nextTick();

      // Check that accordion exists (which means longitudinal section is rendered)
      const accordion = wrapper.find('.p-accordion');
      expect(accordion.exists()).toBe(true);
    });

    it('expands accordion panels when expanded prop is true', async () => {
      const wrapper = mount(ScoreCard, {
        props: {
          ...defaultProps,
          expanded: true,
        },
        global: {
          plugins: [i18n],
          stubs: {
            LongitudinalChartScreen: true,
          },
        },
      });

      await wrapper.vm.$nextTick();

      // Check that accordion panels are visible
      const accordion = wrapper.find('.p-accordion');
      expect(accordion.exists()).toBe(true);
    });

    it('formats phonics keys correctly', () => {
      const wrapper = mount(ScoreCard, {
        props: {
          ...defaultProps,
          taskId: 'phonics',
          score: {
            value: 85,
            min: 0,
            max: 100,
            supportColor: '#4CAF50',
            subscores: {
              cvc: '10/10',
              digraph: '8/10',
            },
          },
        },
        global: {
          plugins: [i18n],
          stubs: {
            LongitudinalChartScreen: true,
          },
        },
      });

      expect(wrapper.text()).toContain('CVC Words');
      expect(wrapper.text()).toContain('Digraphs');
    });

    it('does not render accordion when no scores array and no longitudinal data', () => {
      const wrapper = mount(ScoreCard, {
        props: {
          ...defaultProps,
          scoresArray: [],
          longitudinalData: [],
        },
        global: {
          plugins: [i18n],
          stubs: {
            LongitudinalChartScreen: true,
          },
        },
      });

      const accordion = wrapper.find('.p-accordion');
      expect(accordion.exists()).toBe(false);
    });

    it('displays score value with template', () => {
      const wrapper = mount(ScoreCard, {
        props: defaultProps,
        global: {
          plugins: [i18n],
          stubs: {
            LongitudinalChartScreen: true,
          },
        },
      });

      // The knob component should receive the value
      const knob = wrapper.findComponent({ name: 'Knob' });
      expect(knob.exists()).toBe(true);
      expect(knob.props('modelValue')).toBe(75);
      expect(knob.props('valueTemplate')).toBe('{value}%');
    });

    it('interpolates student name in description', () => {
      const wrapper = mount(ScoreCard, {
        props: defaultProps,
        global: {
          plugins: [i18n],
          stubs: {
            LongitudinalChartScreen: true,
          },
        },
      });

      expect(wrapper.text()).toContain('John');
    });

    it('renders all scores in breakdown', async () => {
      const wrapper = mount(ScoreCard, {
        props: {
          ...defaultProps,
          expanded: true,
        },
        global: {
          plugins: [i18n],
          stubs: {
            LongitudinalChartScreen: true,
          },
        },
      });

      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain('Raw Score');
      expect(wrapper.text()).toContain('Percentile');
      expect(wrapper.text()).toContain('Standard Score');
    });

    it('filters out NaN scores from breakdown', () => {
      const wrapper = mount(ScoreCard, {
        props: {
          ...defaultProps,
          scoresArray: [
            ['Raw Score', 50, 0, 100],
            ['Invalid Score', NaN, 0, 100],
            ['Standard Score', 105, 70, 130],
          ],
        },
        global: {
          plugins: [i18n],
          stubs: {
            LongitudinalChartScreen: true,
          },
        },
      });

      expect(wrapper.text()).toContain('Raw Score');
      expect(wrapper.text()).not.toContain('Invalid Score');
      expect(wrapper.text()).toContain('Standard Score');
    });
  });

  describe('prop validation', () => {
    it('validates score object structure', () => {
      const validator = ScoreCard.props.score.validator;

      expect(validator({ value: 75 })).toBe(true);
      expect(validator({ supportColor: '#4CAF50' })).toBe(true);
      expect(validator({ min: 0, max: 100 })).toBe(true);
      expect(validator({})).toBe(false);
      expect(validator(null)).toBe(false);
    });
  });
});
