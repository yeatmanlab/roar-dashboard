export const taskDisplayNames = {
  swr: { name: 'Word', order: 3 },
  'swr-es': { name: 'Palabra', order: 4 },
  pa: { name: 'Phoneme', order: 2 },
  sre: { name: 'Sentence', order: 5 },
  letter: { name: 'Letter', order: 1 },
  multichoice: { name: 'Multichoice', order: 6 },
  mep: { name: 'MEP', order: 7 },
  ExternalTask: { name: 'External Task', order: 8 },
  ExternalTest: { name: 'External Test', order: 9 },
};

export const supportLevelColors = {
  above: 'green',
  some: '#edc037',
  below: '#c93d82',
};

export const getSupportLevel = (percentile) => {
  let support_level = null;
  let tag_color = null;
  if (percentile !== undefined) {
    if (percentile >= 50) {
      support_level = 'At or Above Average';
      tag_color = supportLevelColors.above;
    } else if (percentile > 25 && percentile < 50) {
      support_level = 'Needs Some Support';
      tag_color = supportLevelColors.some;
    } else {
      support_level = 'Needs Extra Support';
      tag_color = supportLevelColors.below;
    }
  }
  return {
    support_level,
    tag_color,
  };
};
