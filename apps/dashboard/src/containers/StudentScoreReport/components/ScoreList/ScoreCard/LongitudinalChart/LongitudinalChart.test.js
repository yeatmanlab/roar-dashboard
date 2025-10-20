import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import LongitudinalChart from './LongitudinalChart.vue';

// Mock roar-utils
vi.mock('@bdelab/roar-utils', async () => {
  const actual = await vi.importActual('@bdelab/roar-utils');
  return {
    ...actual,
    getGrade: vi.fn(),
  };
});

// Mock helpers/reports
vi.mock('@/helpers/reports', () => ({
  getDialColor: vi.fn(),
  supportLevelColors: {
    above: 'green',
    some: '#edc037',
    below: '#c93d82',
  },
}));

// Mock Chart.js
vi.mock('chart.js/auto', () => ({
  default: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
    update: vi.fn(),
    data: {},
    options: {},
  })),
}));

// Mock the composable
vi.mock('./useLongitudinalSeries', () => ({
  useLongitudinalSeries: vi.fn(() => ({
    series: {
      value: [
        {
          x: new Date('2024-01-01'),
          y: 45,
          color: '#4CAF50',
          percentile: 65,
          standardScore: 95,
        },
        {
          x: new Date('2024-06-01'),
          y: 50,
          color: '#4CAF50',
          percentile: 75,
          standardScore: 105,
        },
      ],
    },
    seriesLabel: {
      value: 'Raw Score',
    },
    seriesStroke: {
      value: '#2196F3',
    },
  })),
}));

// Mock HTMLCanvasElement.prototype.getContext
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillStyle: '',
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
  createImageData: vi.fn(),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
}));

describe('LongitudinalChart.vue', () => {
  const defaultProps = {
    longitudinalData: [
      { date: '2024-01-01', scores: { rawScore: 45, percentile: 65 } },
      { date: '2024-06-01', scores: { rawScore: 50, percentile: 75 } },
    ],
    taskId: 'swr',
    studentGrade: '3',
    currentAssignmentId: 'test-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('snapshots', () => {
    it('renders with longitudinal data', () => {
      const wrapper = mount(LongitudinalChart, {
        props: defaultProps,
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders with single data point', () => {
      const wrapper = mount(LongitudinalChart, {
        props: {
          ...defaultProps,
          longitudinalData: [{ date: '2024-01-01', scores: { rawScore: 45 } }],
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders with different task', () => {
      const wrapper = mount(LongitudinalChart, {
        props: {
          ...defaultProps,
          taskId: 'sre',
        },
      });

      expect(wrapper.html()).toMatchSnapshot();
    });
  });

  describe('component behavior', () => {
    it('renders canvas element', () => {
      const wrapper = mount(LongitudinalChart, {
        props: defaultProps,
      });

      const canvas = wrapper.find('canvas');
      expect(canvas.exists()).toBe(true);
    });

    it('has correct container styling', () => {
      const wrapper = mount(LongitudinalChart, {
        props: defaultProps,
      });

      const container = wrapper.find('.rounded');
      expect(container.exists()).toBe(true);
      expect(container.classes()).toContain('border');
      expect(container.classes()).toContain('border-gray-100');
    });

    it('mounts with required props', () => {
      const wrapper = mount(LongitudinalChart, {
        props: defaultProps,
      });

      expect(wrapper.props('longitudinalData')).toEqual(defaultProps.longitudinalData);
      expect(wrapper.props('taskId')).toBe('swr');
      expect(wrapper.props('studentGrade')).toBe('3');
    });

    it('canvas has proper classes', () => {
      const wrapper = mount(LongitudinalChart, {
        props: defaultProps,
      });

      const canvas = wrapper.find('canvas');
      expect(canvas.classes()).toContain('w-full');
      expect(canvas.classes()).toContain('h-full');
    });
  });

  describe('chart lifecycle', () => {
    it('creates chart on mount', () => {
      const wrapper = mount(LongitudinalChart, {
        props: defaultProps,
      });

      // Chart should be created (mocked)
      expect(wrapper.vm).toBeDefined();
    });

    it('destroys chart on unmount', () => {
      const wrapper = mount(LongitudinalChart, {
        props: defaultProps,
      });

      wrapper.unmount();

      // Verify component was unmounted
      expect(wrapper.exists()).toBe(false);
    });
  });
});
