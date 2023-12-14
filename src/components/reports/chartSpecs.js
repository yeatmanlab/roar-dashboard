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
      if (score?.scores?.support_level === 'Needs Extra Support' && gradeCounter) {
        gradeCounter.support_levels[0]++;
        gradeCounter.totalStudents++;
      } else if (score?.scores?.support_level === 'Needs Some Support' && gradeCounter) {
        gradeCounter.support_levels[1]++;
        gradeCounter.totalStudents++;
      } else if (score?.scores?.support_level === 'At or Above Average' && gradeCounter) {
        gradeCounter.support_levels[2]++;
        gradeCounter.totalStudents++;
      } else {
        // score not counted (support level null)
      }
    }
  }

  return gradeCount;
}

function returnValueByIndex(index, grade, mode) {
  if (index >= 0 && index <= 2) {
    // 0 => needs extra support
    // 1 => needs some support
    // 2 => at or above average
    let valsByIndex = [
      { group: 'Needs Extra Support' },
      { group: 'Needs Some Support' },
      { group: 'At or Above Average' },
    ];
    let value;
    if (mode === 'percentage') {
      value = {
        category: grade.grade,
        group: valsByIndex[index].group,
        color: valsByIndex[index].color,
        value: (grade?.support_levels[index] / grade.totalStudents) * 100,
      };
    }
    if (mode === 'count') {
      value = {
        category: grade.grade,
        group: valsByIndex[index].group,
        color: valsByIndex[index].color,
        value: grade?.support_levels[index],
      };
    }
    return value;
  } else {
    throw new Error('Index out of range');
  }
}

function returnSupportLevelValues(scores, mode) {
  let gradeCounts = returnGradeCount(scores);
  let values = [];
  // generates values for bar chart
  for (let grade of gradeCounts) {
    if (grade?.totalStudents > 0) {
      for (let i = 0; i < grade?.support_levels.length; i++) {
        let value = returnValueByIndex(i, grade, mode);
        values.push(value);
      }
    }
  }
  return values;
}

export const distBySupport = (taskId, scores, mode = 'percentage') => {
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
      values: returnSupportLevelValues(scores, mode),
    },
    encoding: {
      y: {
        field: 'value',
        title: `${mode}`,
        type: 'quantitative',
        spacing: 1,
      },
      x: {
        field: 'category',
        type: 'ordinal',
        title: 'By Grade',
        spacing: 1,
        sort: ['Kindergarten', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      },
      xOffset: {
        field: 'group',
        sort: ['Needs Extra Support', 'Needs Some Support', 'At or Above Average'],
      },
      color: {
        field: 'group',
        title: 'Support Level',
        sort: ['Needs Extra Support', 'Needs Some Support', 'At or Above Average'],
        scale: { range: ['rgb(201, 61, 130)', 'rgb(237, 192, 55)', 'green'] },
      },
      tooltip: { field: 'value', type: 'quantitative' },
    },
  };
};

function returnDistByGrade(scores, scoreFieldBelowSixth, scoreFieldAboveSixth) {
  for (let score of scores) {
    let stdPercentile;
    if (score.user.grade >= 6) {
      stdPercentile = score.scores[scoreFieldAboveSixth];
    } else {
      stdPercentile = score.scores[scoreFieldBelowSixth];
    }
    score.scores.stdPercentile = stdPercentile;
  }
  return scores;
}

export const distByGrade = (taskId, scores, scoreFieldBelowSixth, scoreFieldAboveSixth) => {
  return {
    description: 'ROAR Score Distribution by Grade Level',
    title: { text: `${taskId.toUpperCase()} Score Distribution`, anchor: 'middle', fontSize: 18 },
    config: { view: { stroke: graphColorType.black, strokeWidth: 1 } },

    data: { values: returnDistByGrade(scores.value, scoreFieldBelowSixth.value, scoreFieldAboveSixth.value) },

    mark: 'bar',
    height: 50,
    width: 400,

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
        // sort: 'ascending',
        // sort: ['Kindergarten', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        sort: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, ['Kindergarten']],
      },

      color: {
        field: 'scores.stdPercentile',
        type: 'quantitative',
        sort: ['Kindergarten', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        legend: null,
      },

      x: {
        field: `scores.stdPercentile`,
        title: `Percentile`,
        bin: { step: 10, extent: [0, 100] },
        sort: 'ascending',
      },

      y: {
        aggregate: 'count',
        title: 'count',
        axis: { orient: 'right' },
      },
    },
  };
};
