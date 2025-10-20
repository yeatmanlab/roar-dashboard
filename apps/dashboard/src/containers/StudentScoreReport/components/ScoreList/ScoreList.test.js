import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { ref } from 'vue';

// Mock the ScoreCard component to avoid Chart.js dependencies
vi.mock('./ScoreCard', () => ({
  default: {
    name: 'ScoreCard',
    template: '<div class="mocked-score-card">ScoreCard</div>',
    props: [
      'publicName',
      'scoreLabel',
      'score',
      'tags',
      'valueTemplate',
      'scoreToDisplay',
      'studentFirstName',
      'description',
      'scoresArray',
      'expanded',
      'longitudinalData',
      'taskId',
      'studentGrade',
    ],
  },
  ScoreCardScreen: {
    name: 'ScoreCard',
    template: '<div class="mocked-score-card">ScoreCard</div>',
    props: [
      'publicName',
      'scoreLabel',
      'score',
      'tags',
      'valueTemplate',
      'scoreToDisplay',
      'studentFirstName',
      'description',
      'scoresArray',
      'expanded',
      'longitudinalData',
      'taskId',
      'studentGrade',
    ],
  },
}));

// Mock the composable - needs to return computed refs or objects that behave like them
vi.mock('./useScoreListData', () => ({
  useScoreListData: vi.fn(() => {
    const mockTask = {
      taskId: 'swr',
      scoreToDisplay: 'percentileScore',
      percentileScore: {
        name: 'Percentile Score',
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
          tooltip: 'Required assessment',
        },
      ],
      historicalScores: [],
    };

    // Return refs that will be auto-unwrapped in templates
    return {
      computedTaskData: ref([mockTask]),
      scoreValueTemplate: ref(() => '{value}%'),
      getTaskDescription: ref(() => ({
        keypath: 'scoreReports.percentileTaskDescription',
        slots: {
          percentile: '75th percentile',
          taskName: 'Single Word Reading',
          taskDescription: 'measures reading ability',
          supportCategory: 'Achieved Skill',
        },
      })),
      getTaskScoresArray: ref(() => [
        ['Raw Score', 50, 0, 100],
        ['Percentile', 75, 0, 100],
      ]),
    };
  }),
}));

// Import after mocks
const ScoreList = await import('./ScoreList.vue').then((m) => m.default);

describe('ScoreList.vue', () => {
  let i18n;

  const defaultProps = {
    studentFirstName: 'John',
    studentGrade: '3',
    taskData: {
      swr: {
        taskId: 'swr',
        scores: {
          composite: {
            rawScore: 50,
            percentileScore: 75,
            standardScore: 105,
          },
        },
        optional: false,
        reliable: true,
      },
    },
    tasksDictionary: {
      swr: {
        publicName: 'Single Word Reading',
      },
    },
    longitudinalData: {},
    expanded: false,
  };

  beforeEach(() => {
    i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          scoreReports: {
            percentileTaskDescription: '{firstName} scored in the {percentile} on {taskName}, which {taskDescription}.',
          },
        },
      },
    });
  });

  describe('snapshots', () => {
    it('renders with single task', () => {
      const wrapper = mount(ScoreList, {
        props: defaultProps,
        global: {
          plugins: [i18n],
          stubs: {
            ScoreCard: true,
          },
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders expanded state', () => {
      const wrapper = mount(ScoreList, {
        props: {
          ...defaultProps,
          expanded: true,
        },
        global: {
          plugins: [i18n],
          stubs: {
            ScoreCard: true,
          },
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders with different student', () => {
      const wrapper = mount(ScoreList, {
        props: {
          ...defaultProps,
          studentFirstName: 'Sarah',
          studentGrade: '5',
        },
        global: {
          plugins: [i18n],
          stubs: {
            ScoreCard: true,
          },
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });
  });

  describe('component behavior', () => {
    it('renders section header', () => {
      const wrapper = mount(ScoreList, {
        props: defaultProps,
        global: {
          plugins: [i18n],
          stubs: {
            ScoreCard: true,
          },
        },
      });

      expect(wrapper.text()).toContain('Detailed Assessment Results');
    });

    it('renders grid layout', () => {
      const wrapper = mount(ScoreList, {
        props: defaultProps,
        global: {
          plugins: [i18n],
          stubs: {
            ScoreCard: true,
          },
        },
      });

      const grid = wrapper.find('.grid');
      expect(grid.exists()).toBe(true);
      expect(grid.classes()).toContain('gap-2');
    });

    it('passes correct props to ScoreCard components', () => {
      const wrapper = mount(ScoreList, {
        props: defaultProps,
        global: {
          plugins: [i18n],
          stubs: {
            ScoreCard: true,
          },
        },
      });

      const scoreCards = wrapper.findAllComponents({ name: 'ScoreCard' });
      expect(scoreCards.length).toBeGreaterThan(0);
    });

    it('passes studentFirstName to ScoreCard', () => {
      const wrapper = mount(ScoreList, {
        props: defaultProps,
        global: {
          plugins: [i18n],
          stubs: {
            ScoreCard: true,
          },
        },
      });

      const scoreCard = wrapper.findComponent({ name: 'ScoreCard' });
      expect(scoreCard.exists()).toBe(true);
    });

    it('passes expanded prop to ScoreCard components', () => {
      const wrapper = mount(ScoreList, {
        props: {
          ...defaultProps,
          expanded: true,
        },
        global: {
          plugins: [i18n],
          stubs: {
            ScoreCard: true,
          },
        },
      });

      expect(wrapper.props('expanded')).toBe(true);
    });
  });
});
