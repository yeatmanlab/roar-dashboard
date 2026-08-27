export const UnitSize = {
  PERCENT_WIDTH: '%width',
  PERCENT_HEIGHT: '%height',
  DEG: 'deg',
  PX: 'px',
};

export const UnitLocation = {
  PERCENT: '%',
  PX: 'px',
};

export const UnitSpeed = {
  PX: 'px', // per frame
  PERCENT_HEIGHT_PER_SEC: '%height/sec',
  DEG_PER_SEC: 'deg/sec',
};

export const UnitTime = {
  FRAMES: 'frames',
  MS: 'ms',
};

export const degToPxFromWidth = (deg, vdCm, widthScreenCm, widthScreenPx) => {
  const lenCm = 2 * vdCm * Math.tan((deg * Math.PI) / 180 / 2);
  const lenPx = (lenCm * widthScreenPx) / widthScreenCm;
  return lenPx;
};

export const degToPxFromDiag = (deg, vdCm, diagScreenCm, widthScreenPx, heightScreenPx) => {
  const lenCm = 2 * vdCm * Math.tan((deg * Math.PI) / 180 / 2);
  const diagScreenPx = Math.sqrt(widthScreenPx * widthScreenPx + heightScreenPx * heightScreenPx);
  const lenPx = (lenCm * diagScreenPx) / diagScreenCm;
  return lenPx;
};
