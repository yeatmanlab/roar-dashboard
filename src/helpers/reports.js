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
