export const chart = {};

const getBorderRadii = (left, middle, right) => {
  const defaultRadius = { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 };
  const borderRadii = { left: { ...defaultRadius }, middle: { ...defaultRadius }, right: { ...defaultRadius } };
  if (left > 0) {
    borderRadii.left.topLeft = Number.MAX_VALUE;
    borderRadii.left.bottomLeft = Number.MAX_VALUE;
  } else if (middle > 0) {
    borderRadii.middle.topLeft = Number.MAX_VALUE;
    borderRadii.middle.bottomLeft = Number.MAX_VALUE;
  } else {
    borderRadii.right.topLeft = Number.MAX_VALUE;
    borderRadii.right.bottomLeft = Number.MAX_VALUE;
  }

  if (right > 0) {
    borderRadii.right.topRight = Number.MAX_VALUE;
    borderRadii.right.bottomRight = Number.MAX_VALUE;
  } else if (middle > 0) {
    borderRadii.middle.topRight = Number.MAX_VALUE;
    borderRadii.middle.bottomRight = Number.MAX_VALUE;
  } else {
    borderRadii.left.topRight = Number.MAX_VALUE;
    borderRadii.left.bottomRight = Number.MAX_VALUE;
  }

  return borderRadii;
};

export const setBarChartData = (orgStats) => {
  let { assigned = 0, started = 0, completed = 0 } = orgStats || {};
  const documentStyle = getComputedStyle(document.documentElement);

  started -= completed;
  assigned -= started + completed;

  const borderRadii = getBorderRadii(completed, started, assigned);
  const borderWidth = 0;

  const chartData = {
    labels: [''],
    datasets: [
      {
        type: 'bar',
        label: 'Completed',
        backgroundColor: documentStyle.getPropertyValue('--bright-green'),
        data: [completed],
        borderWidth: borderWidth,
        borderSkipped: false,
        borderRadius: borderRadii.left,
      },
      {
        type: 'bar',
        label: 'Started',
        backgroundColor: documentStyle.getPropertyValue('--yellow-100'),
        data: [started],
        borderWidth: borderWidth,
        borderSkipped: false,
        borderRadius: borderRadii.middle,
      },
      {
        type: 'bar',
        label: 'Not Started',
        backgroundColor: documentStyle.getPropertyValue('--surface-d'),
        data: [assigned],
        borderWidth: borderWidth,
        borderSkipped: false,
        borderRadius: borderRadii.right,
      },
    ],
  };

  return chartData;
};

export const setBarChartOptions = (orgStats) => {
  let { assigned = 0 } = orgStats || {};

  const min = 0;
  const max = assigned;

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
