import { PROGRESS_COLORS } from '@/constants/completionStatus';
import { SCORE_SUPPORT_LEVEL_COLORS } from '@/constants/scores';

export const chart = {};

/**
 * Compute corner radii for a stacked horizontal single-bar chart with up to three segments.
 *
 * Segments are ordered visually from left to right as: left -> middle -> right.
 * Each input represents the NET value to render for that segment:
 * - left:   typically the "completed" count (students who completed)
 * - middle: typically the "started" count (students who started but not completed)
 * - right:  typically the "assigned" count (students who are assigned but not started)
 *
 * Rounding rules:
 * - The first non-zero segment (from the left) gets its left corners rounded.
 * - The last non-zero segment (from the right) gets its right corners rounded.
 *
 * This ensures the visually leftmost and rightmost segments always have rounded ends,
 * regardless of which datasets are zero.
 *
 * @param {number} left   Net value of the left segment (e.g., completed)
 * @param {number} middle Net value of the middle segment (e.g., started)
 * @param {number} right  Net value of the right segment (e.g., assigned)
 * @returns {{left: {topLeft:number,topRight:number,bottomLeft:number,bottomRight:number},
 *            middle: {topLeft:number,topRight:number,bottomLeft:number,bottomRight:number},
 *            right: {topLeft:number,topRight:number,bottomLeft:number,bottomRight:number}}}
 */
const getBorderRadii = (left, middle, right) => {
  const RADIUS = 8;
  const defaultRadius = { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 };
  const borderRadii = { left: { ...defaultRadius }, middle: { ...defaultRadius }, right: { ...defaultRadius } };
  if (left > 0) {
    borderRadii.left.topLeft = RADIUS;
    borderRadii.left.bottomLeft = RADIUS;
  } else if (middle > 0) {
    borderRadii.middle.topLeft = RADIUS;
    borderRadii.middle.bottomLeft = RADIUS;
  } else {
    borderRadii.right.topLeft = RADIUS;
    borderRadii.right.bottomLeft = RADIUS;
  }

  if (right > 0) {
    borderRadii.right.topRight = RADIUS;
    borderRadii.right.bottomRight = RADIUS;
  } else if (middle > 0) {
    borderRadii.middle.topRight = RADIUS;
    borderRadii.middle.bottomRight = RADIUS;
  } else {
    borderRadii.left.topRight = RADIUS;
    borderRadii.left.bottomRight = RADIUS;
  }

  return borderRadii;
};

/**
 * Generate Chart.js data configuration for a stacked horizontal progress bar.
 *
 * Creates a single-bar chart with three stacked segments representing assignment progress:
 * - Completed (green): students who completed the assignment
 * - Started (yellow): students who started but haven't completed
 * - Assigned (gray): students who are assigned but haven't started
 *
 * The backend provides net values (discrete counts), not cumulative totals.
 * Border radii are computed dynamically so the visually leftmost and rightmost
 * segments have rounded corners.
 *
 * @param {Object} orgStats - Progress statistics from the backend
 * @param {number} [orgStats.completed=0] - Count of students who completed
 * @param {number} [orgStats.started=0] - Count of students who started but not completed
 * @param {number} [orgStats.assigned=0] - Count of students assigned but not started
 * @returns {Object} Chart.js data configuration with labels and datasets
 */
export const setProgressChartData = (orgStats) => {
  let { assigned = 0, started = 0, completed = 0 } = orgStats || {};

  // Backend provides net values: assigned (not started), started (not completed), completed
  const borderRadii = getBorderRadii(completed, started, assigned);
  const borderWidth = 0;

  const chartData = {
    labels: [''],
    datasets: [
      {
        type: 'bar',
        label: 'Completed',
        backgroundColor: PROGRESS_COLORS.COMPLETED,
        data: [completed],
        borderWidth: borderWidth,
        borderSkipped: false,
        borderRadius: borderRadii.left,
      },
      {
        type: 'bar',
        label: 'Started',
        backgroundColor: PROGRESS_COLORS.STARTED,
        data: [started],
        borderWidth: borderWidth,
        borderSkipped: false,
        borderRadius: borderRadii.middle,
      },
      {
        type: 'bar',
        label: 'Assigned',
        backgroundColor: PROGRESS_COLORS.ASSIGNED,
        data: [assigned],
        borderWidth: borderWidth,
        borderSkipped: false,
        borderRadius: borderRadii.right,
      },
    ],
  };

  return chartData;
};

/**
 * Generate Chart.js options configuration for a stacked horizontal progress bar.
 *
 * Configures the chart to:
 * - Display as a horizontal bar (indexAxis: 'y')
 * - Stack segments end-to-end
 * - Hide axes, ticks, and gridlines for a clean progress bar appearance
 * - Set the scale from 0 to the total number of assignments
 * - Disable the legend (shown separately in ProgressLegend component)
 *
 * @param {Object} orgStats - Progress statistics from the backend
 * @param {number} [orgStats.completed=0] - Count of students who completed
 * @param {number} [orgStats.started=0] - Count of students who started but not completed
 * @param {number} [orgStats.assigned=0] - Count of students assigned but not started
 * @returns {Object} Chart.js options configuration
 */
export const setProgressChartOptions = (orgStats) => {
  let { assigned = 0, started = 0, completed = 0 } = orgStats || {};

  const min = 0;
  const max = assigned + started + completed;

  return {
    indexAxis: 'y',
    maintainAspectRatio: false,
    aspectRatio: 9,
    plugins: {
      tooltips: {
        mode: 'index',
        intersect: false,
      },
      legend: false,
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          display: false,
        },
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
        min,
        max,
      },
      y: {
        stacked: true,
        ticks: {
          display: false,
        },
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
        min,
        max,
      },
    },
  };
};

/**
 * Generate Chart.js data configuration for a stacked horizontal score distribution bar.
 *
 * Creates a single-bar chart with three stacked segments representing support levels:
 * - Needs Extra Support (pink): students below benchmark
 * - Developing Skill (yellow): students approaching benchmark
 * - Achieved Skill (green): students at or above benchmark
 *
 * @param {Object} supportLevelCounts - Counts per support level
 * @param {number} [supportLevelCounts.below=0] - Count of students needing extra support
 * @param {number} [supportLevelCounts.some=0] - Count of students developing skill
 * @param {number} [supportLevelCounts.above=0] - Count of students who achieved skill
 * @returns {Object} Chart.js data configuration with labels and datasets
 */
export const setDistributionChartData = (supportLevelCounts) => {
  const { below = 0, some = 0, above = 0 } = supportLevelCounts || {};
  const borderRadii = getBorderRadii(below, some, above);
  const borderWidth = 0;

  return {
    labels: [''],
    datasets: [
      {
        type: 'bar',
        label: 'Needs Extra Support',
        backgroundColor: SCORE_SUPPORT_LEVEL_COLORS.BELOW,
        data: [below],
        borderWidth,
        borderSkipped: false,
        borderRadius: borderRadii.left,
      },
      {
        type: 'bar',
        label: 'Developing Skill',
        backgroundColor: SCORE_SUPPORT_LEVEL_COLORS.SOME,
        data: [some],
        borderWidth,
        borderSkipped: false,
        borderRadius: borderRadii.middle,
      },
      {
        type: 'bar',
        label: 'Achieved Skill',
        backgroundColor: SCORE_SUPPORT_LEVEL_COLORS.ABOVE,
        data: [above],
        borderWidth,
        borderSkipped: false,
        borderRadius: borderRadii.right,
      },
    ],
  };
};

/**
 * Generate Chart.js options configuration for a stacked horizontal score distribution bar.
 *
 * @param {Object} supportLevelCounts - Counts per support level
 * @param {number} [supportLevelCounts.below=0] - Count of students needing extra support
 * @param {number} [supportLevelCounts.some=0] - Count of students developing skill
 * @param {number} [supportLevelCounts.above=0] - Count of students who achieved skill
 * @returns {Object} Chart.js options configuration
 */
export const setDistributionChartOptions = (supportLevelCounts) => {
  const { below = 0, some = 0, above = 0 } = supportLevelCounts || {};
  const min = 0;
  const max = below + some + above;

  return {
    indexAxis: 'y',
    maintainAspectRatio: false,
    aspectRatio: 9,
    plugins: {
      tooltips: {
        mode: 'index',
        intersect: false,
      },
      legend: false,
    },
    scales: {
      x: {
        stacked: true,
        ticks: { display: false },
        grid: { display: false },
        border: { display: false },
        min,
        max,
      },
      y: {
        stacked: true,
        ticks: { display: false },
        grid: { display: false },
        border: { display: false },
        min,
        max,
      },
    },
  };
};
