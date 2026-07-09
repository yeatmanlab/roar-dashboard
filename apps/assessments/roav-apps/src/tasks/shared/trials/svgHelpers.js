export const svgStrToSrc = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export const htmlImgSvgPositioned = (
  show,
  src,
  width,
  height,
  xOffestFromCenter,
  yOffsetFromCenter = 0,
  degRot = 0,
  nameClass = undefined,
) => {
  if (!show) {
    return '';
  }
  const htmlClass = nameClass ? `class="${nameClass}"` : '';
  return `
    <img
      src="${src}"
      width="${width}"
      height="${height}"
      ${htmlClass}
      style="
        position:absolute;
        left: calc(50% + ${xOffestFromCenter}px);
        top: calc(50% + ${yOffsetFromCenter}px);
        display:block;
        transform: translate(-50%, -50%) rotate(${degRot}deg);
        transform-origin: 50% 50%;
        visibility: ${show ? 'visible' : 'hidden'}
      "
    />
  `;
};

export const createSvgLineHor = (
  widthCanvas = 100,
  heightCanvas = 100,
  widthStroke = 20,
  length = 70,
  color = '#000000',
) => {
  const x1 = (widthCanvas - length) / 2;
  const x2 = x1 + length;
  const y = heightCanvas / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthCanvas} ${heightCanvas}">
    <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="${widthStroke}" stroke-linecap="round"/>
  </svg>`;
};

export const createSvgT = (
  widthCanvas = 100,
  heightCanvas = 100,
  height = 70,
  width = 70,
  widthStroke = 20,
  color = '#000000',
) => {
  const xHorUL = (widthCanvas - width) / 2;
  const xVertUL = (widthCanvas - widthStroke) / 2;
  const yHorUL = (heightCanvas - height) / 2;
  const yVertUL = (heightCanvas - height) / 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthCanvas} ${heightCanvas}">
    <rect x="${xHorUL}" y="${yHorUL}" width="${width}" height="${widthStroke}" fill="${color}"/>
    <rect x="${xVertUL}" y="${yVertUL}" width="${widthStroke}" height="${height}" fill="${color}"/>
  </svg>`;
  return svg;
};

export const createSvgCircle = (
  widthCanvas = 100,
  heightCanvas = 100,
  widthStroke = 20,
  diameter = 70,
  color = '#000000',
) => {
  const cx = widthCanvas / 2;
  const cy = heightCanvas / 2;
  const r = (diameter - widthStroke) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthCanvas} ${heightCanvas}">
    <circle cx="${cx}" cy="${cy}" r="${r}" stroke="${color}" stroke-width="${widthStroke}" fill="none"/>
  </svg>`;
};

export const createSvgCircleOpen = (
  widthCanvas = 100,
  heightCanvas = 100,
  widthStroke = 20,
  diameter = 70,
  degOpen = 75,
  color = '#000000',
) => {
  const cx = widthCanvas / 2;
  const cy = heightCanvas / 2;
  const r = (diameter - widthStroke) / 2;

  // Opening is centered on top (270 deg). Arc runs from startDeg to endDeg clockwise.
  const startDeg = 270 + degOpen / 2;
  const endDeg = 270 - degOpen / 2 + 360;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));

  const sweepDeg = 360 - degOpen;
  const largeArc = sweepDeg > 180 ? 1 : 0;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthCanvas} ${heightCanvas}">
    <path d="M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}" stroke="${color}" stroke-width="${widthStroke}" fill="none" stroke-linecap="round"/>
  </svg>`;
};

export const createSvgCross = (
  widthCanvas = 100,
  heightCanvas = 100,
  widthStroke = 20,
  height = 70,
  width = 70,
  color = '#000000',
) => {
  const xHorUL = (widthCanvas - width) / 2;
  const yHorUL = (heightCanvas - widthStroke) / 2;

  const xVertUL = (widthCanvas - widthStroke) / 2;
  const yVertUL = (heightCanvas - height) / 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthCanvas} ${heightCanvas}">
    <rect x="${xHorUL}" y="${yHorUL}" width="${width}" height="${widthStroke}" fill="${color}"/>
    <rect x="${xVertUL}" y="${yVertUL}" width="${widthStroke}" height="${height}" fill="${color}"/>
  </svg>`;

  return svg;
};

export const createSvgBox = (
  widthCanvas = 100,
  heightCanvas = 100,
  widthStroke = 20,
  height = 70,
  width = 70,
  color = '#000000',
) => {
  const xLeft = (widthCanvas - width) / 2;
  const yTop = (heightCanvas - height) / 2;

  const xRight = xLeft + width - widthStroke;
  const yBottom = yTop + height - widthStroke;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthCanvas} ${heightCanvas}">
    <rect x="${xLeft}"  y="${yTop}"    width="${width}"       height="${widthStroke}" fill="${color}"/>
    <rect x="${xLeft}"  y="${yBottom}" width="${width}"       height="${widthStroke}" fill="${color}"/>
    <rect x="${xLeft}"  y="${yTop}"    width="${widthStroke}" height="${height}"      fill="${color}"/>
    <rect x="${xRight}" y="${yTop}"    width="${widthStroke}" height="${height}"      fill="${color}"/>
  </svg>`;

  return svg;
};

export const createSvgGrid = (
  widthCanvas = 100,
  heightCanvas = 100,
  widthStroke = 20,
  height = 70,
  width = 70,
  color = '#000000',
) => {
  const xLeft = (widthCanvas - width) / 2;
  const yTop = (heightCanvas - height) / 2;

  const xRight = xLeft + width - widthStroke;
  const yBottom = yTop + height - widthStroke;

  const xMid = xLeft + (width - widthStroke) / 2;
  const yMid = yTop + (height - widthStroke) / 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthCanvas} ${heightCanvas}">
    <!-- box -->
    <rect x="${xLeft}"  y="${yTop}"    width="${width}"       height="${widthStroke}" fill="${color}"/>
    <rect x="${xLeft}"  y="${yBottom}" width="${width}"       height="${widthStroke}" fill="${color}"/>
    <rect x="${xLeft}"  y="${yTop}"    width="${widthStroke}" height="${height}"      fill="${color}"/>
    <rect x="${xRight}" y="${yTop}"    width="${widthStroke}" height="${height}"      fill="${color}"/>

    <!-- cross -->
    <rect x="${xLeft}" y="${yMid}" width="${width}"       height="${widthStroke}" fill="${color}"/>
    <rect x="${xMid}"  y="${yTop}" width="${widthStroke}" height="${height}"      fill="${color}"/>
  </svg>`;

  return svg;
};

export const createSvgBoxOpen = (
  widthCanvas = 100,
  heightCanvas = 100,
  widthStroke = 15,
  height = 80,
  width = 80,
  color = '#000000',
) => {
  const xLeft = (widthCanvas - width) / 2;
  const yTop = (heightCanvas - height) / 2;

  const xRight = xLeft + width - widthStroke;
  const yBottom = yTop + height - widthStroke;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthCanvas} ${heightCanvas}">
    <!-- bottom -->
    <rect x="${xLeft}" y="${yBottom}" width="${width}" height="${widthStroke}" fill="${color}"/>
    <!-- left -->
    <rect x="${xLeft}" y="${yTop}" width="${widthStroke}" height="${height}" fill="${color}"/>
    <!-- right -->
    <rect x="${xRight}" y="${yTop}" width="${widthStroke}" height="${height}" fill="${color}"/>
  </svg>`;
};
