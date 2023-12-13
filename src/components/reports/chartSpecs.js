import _camelCase from 'lodash/camelCase';

const graphColorType = {
  mediumPink: '#cc79a7',
  mediumYellow: '#f0e442',
  mediumBlue: '#0072b2',
  lightBlueGreen: '#44aa99',
  darkPurple: '#342288',
  black: '#000000',
};

function returnGradeCount(scores) {
  // gradecount should be an obj of {{grade:{} count}}
  let gradeCount = [
    { grade: 'Pre-K', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: 'T-K', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: 'Kindergarten', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '1', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '2', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '3', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '4', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '5', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '6', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '7', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '8', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '9', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '10', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '11', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '12', support_levels: [0, 0, 0], totalStudents: 0 },
  ];
  for (let score of scores.value) {
    let gradeCounter = gradeCount.find((grade) => grade.grade === score?.user?.grade?.toString());
    if (gradeCounter) {
      gradeCounter.totalStudents++;
      if (score?.scores?.support_level === 'Needs Extra Support' && gradeCounter) {
        gradeCounter.support_levels[0]++;
      } else if (score?.scores?.support_level === 'Needs Some Support' && gradeCounter) {
        gradeCounter.support_levels[1]++;
      } else if (score?.scores?.support_level === 'At or Above Average' && gradeCounter) {
        gradeCounter.support_levels[2]++;
      } else {
        // score not counted (support level null)
      }
    }
  }

  return gradeCount;
}

function returnValueByIndex(index, grade) {
  if (index >= 0 && index <= 2) {
    // 0 => needs extra support
    // 1 => needs some support
    // 2 => at or above average
    let valsByIndex = [
      { group: 'Needs Extra Support', color: 'rgb(201, 61, 130)' },
      { group: 'Needs Some Support', color: 'rgb(237, 192, 55)' },
      { group: 'At or Above Average', color: 'green' },
    ];
    let value = {
      category: grade.grade,
      group: valsByIndex[index].group,
      color: valsByIndex[index].color,
      value: (grade?.support_levels[index] / grade.totalStudents) * 100,
    };
    return value;
  } else {
    throw new Error('Index out of range');
  }
}

function returnSupportLevelValues(scores) {
  let gradeCounts = returnGradeCount(scores);
  let values = [];

  // generates values for bar chart
  for (let grade of gradeCounts) {
    if (grade?.totalStudents > 0) {
      for (let i = 0; i < grade?.support_levels.length; i++) {
        let value = returnValueByIndex(i, grade);
        values.push(value);
      }
    }
  }

  return values;
}

export const distBySupport = (taskId, scores) => {
  return {
    mark: 'bar',
    height: 300,
    width: 300,
    title: {
      text: `Distribution of Support Level for ROAR-${taskId.toUpperCase()}`,
      anchor: 'middle',
      fontSize: 18,
    },
    data: {
      values: returnSupportLevelValues(scores),
    },
    encoding: {
      y: {
        field: 'value',
        title: 'Percentage (%)',
        type: 'quantitative',
        spacing: 1,
      },
      x: {
        field: 'category',
        type: 'ordinal',
        title: 'By Grade',
        spacing: 1,
      },
      xOffset: {
        field: 'group',
        sort: ['Needs Extra Support', 'Needs Some Support', 'At or Above Average'],
      },
      color: {
        field: 'group',
        title: 'Support Level',
        sort: ['Needs Extra Support', 'Needs Some Support', 'At or Above Average'],
        scale: { range: [ 'rgb(201, 61, 130)','rgb(237, 192, 55)', 'green'] },
      },
      tooltip: {field: "value", type: "quantitative" }
    },
  };
};

export const distByGrade = (taskId, scores, scoreField) => {
  return {
    description: 'ROAR Score Distribution by Grade Level',
    title: { text: `${taskId.toUpperCase()} Score Distribution`, anchor: 'middle', fontSize: 18 },
    config: { view: { stroke: graphColorType.black, strokeWidth: 1 } },

    data: { values: scores.value },

    mark: 'bar',
    height: 50,
    width: 500,

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
