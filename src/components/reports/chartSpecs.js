import _camelCase from 'lodash/camelCase';

const graphColorType = {
  mediumPink: '#cc79a7',
  mediumYellow: '#f0e442',
  mediumBlue: '#0072b2',
  lightBlueGreen: '#44aa99',
  darkPurple: '#342288',
  black: '#000000',
};

export const distByGrade = (taskId, scores, scoreField) => {
  return {
    description: 'ROAR Score Distribution by Grade Level',
    title: { text: `${taskId.toUpperCase()} Score Distribution`, anchor: 'middle', fontSize: 18 },
    config: { view: { stroke: graphColorType.black, strokeWidth: 1 } },

    data: { values: scores.value },

    mark: 'bar',
    height: 50,
    width: 600,

    encoding: {
      facet: {
        field: 'user.grade',
        type: 'nominal',
        columns: 1,
        title: 'By Grade',
        header: {
          titleColor: 'navy',
          titleFontSize: 12,
          titleAlign: 'top',
          titleAnchor: 'middle',
          labelColor: 'navy',
          labelFontSize: 10,
          labelFontStyle: 'bold',
          labelAnchor: 'middle',
          labelAngle: 0,
          labelAlign: 'left',
          labelOrient: 'left',
          labelExpr: "join(['Grade ',if(datum.value == 'Kindergarten', 'K', datum.value ), ], '')",
        },
        spacing: 7,
      },

      color: {
        field: 'user.grade',
        type: 'ordinal',
        sort: ['Kindergarten', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        legend: null,
      },

      x: {
        field: `scores.${scoreField.value}`,
        title: _camelCase(scoreField.value),
        bin: { step: 5, extent: [0, 100] },
      },

      y: {
        aggregate: 'count',
        title: 'count',
        axis: { orient: 'right' },
      },
    },
  };
};
