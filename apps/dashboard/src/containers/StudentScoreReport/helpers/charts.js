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
 * range - min
 */
export const setIndividualScoreReportProgressChartData = (score, min, max, supportLevelColor, scoreType) => {
  // Backend provides net values: assigned (not started), started (not completed), completed
  // const borderRadii = getBorderRadii(score, score - min, max - score);
  const borderWidth = 0;

  const chartData = {
    labels: [scoreType],
    datasets: [
      {
        type: 'bar',
        backgroundColor: supportLevelColor,
        data: [score],
        borderWidth: borderWidth,
        borderSkipped: false,
        // borderRadius: borderRadii.left,
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
export const setIndividualScoreReportProgressChartOptions = (min, max) => {
  return {
    indexAxis: 'y',
    maintainAspectRatio: false,
    aspectRatio: 9,
    plugins: {
      legend: false,
    },
    scales: {
      x: {
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
        grid: {
          display: false,
        },
      },
    },
  };
};

/**
 * Generate Chart.js data configuration for print view progress bar.
 * Creates a stacked horizontal bar with the score portion in color and remaining portion in gray.
 *
 * @param {number} scoreValue - The actual score value
 * @param {number} min - Minimum score value
 * @param {number} max - Maximum score value
 * @param {string} supportColor - Color for the score bar
 * @param {string} scoreLabel - Label for the score
 * @returns {Object} Chart.js data configuration
 */
export const setIndividualScoreReportPrintChartData = (score, scoreLabel) => {
  const { value, max, min, supportColor } = score;
  const RADIUS = 8;
  const normalizedScore = value - min;
  const remainingValue = max - value;

  return {
    labels: [scoreLabel],
    datasets: [
      {
        type: 'bar',
        label: 'Score',
        backgroundColor: supportColor,
        data: [normalizedScore],
        borderWidth: 0,
        borderSkipped: false,
        borderRadius: {
          topLeft: RADIUS,
          topRight: remainingValue === 0 ? RADIUS : 0,
          bottomLeft: RADIUS,
          bottomRight: remainingValue === 0 ? RADIUS : 0,
        },
      },
      {
        type: 'bar',
        label: 'Remaining',
        backgroundColor: '#e5e7eb', // gray-200
        data: [remainingValue],
        borderWidth: 0,
        borderSkipped: false,
        borderRadius: {
          topLeft: normalizedScore === 0 ? RADIUS : 0,
          topRight: RADIUS,
          bottomLeft: normalizedScore === 0 ? RADIUS : 0,
          bottomRight: RADIUS,
        },
      },
    ],
  };
};

/**
 * Generate Chart.js options configuration for print view progress bar.
 *
 * @param {number} min - Minimum score value
 * @param {number} max - Maximum score value
 * @returns {Object} Chart.js options configuration
 */
export const setIndividualScoreReportPrintChartOptions = (min, max) => {
  return {
    indexAxis: 'y',
    maintainAspectRatio: false,
    animation: false,
    events: [],
    devicePixelRatio: 3,
    plugins: {
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
        min: 0,
        max: max - min,
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
      },
    },
  };
};
