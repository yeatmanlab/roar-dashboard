import { jsPsych } from './taskSetup';

const DURATION_TIMEOUT_REFLOW = 250; // ms

export const fitTextVertElPx = (sizeFontMin, sizeFontMax, elText, elTextWrap, stepSizeFont = 1) => {
  if (!elText || !elTextWrap) return -1;

  let sizeFont = sizeFontMax;
  elText.style.setProperty('font-size', `${sizeFont}px`);

  // get usable height inside padding
  const csTextWrap = getComputedStyle(elTextWrap);
  const padY = parseFloat(csTextWrap.paddingTop) + parseFloat(csTextWrap.paddingBottom);
  elText.getBoundingClientRect();

  while (elText.scrollHeight > elTextWrap.clientHeight - padY && sizeFont > sizeFontMin) {
    sizeFont -= stepSizeFont;
    elText.style.setProperty('font-size', `${sizeFont}px`);
  }

  return sizeFont;
};

export const fitTextHorElPx = (sizeFontMin, sizeFontMax, elText, elTextWrap, stepSizeFont = 1) => {
  if (!elTextWrap || !elText) return -1;

  let sizeFont = sizeFontMax;
  elText.style.setProperty('font-size', `${sizeFont}px`);
  elText.getBoundingClientRect();

  const csLabelWrap = getComputedStyle(elTextWrap);
  const padX = parseFloat(csLabelWrap.paddingLeft) + parseFloat(csLabelWrap.paddingRight);

  const usableX = elTextWrap.clientWidth - padX;

  while (elText.scrollWidth > usableX && sizeFont > sizeFontMin) {
    sizeFont -= stepSizeFont;
    elText.style.setProperty('font-size', `${sizeFont}px`);
  }

  return sizeFont;
};

export const fitTextVertIdVh = (
  sizeFontMinVh,
  sizeFontMaxVh,
  idText = 'id-text',
  idTextWrap = 'id-text-wrap',
  stepSizeFont = 1,
) =>
  fitTextVertElPx(
    (sizeFontMinVh * window.innerHeight) / 100,
    (sizeFontMaxVh * window.innerHeight) / 100,
    document.getElementById(idText),
    document.getElementById(idTextWrap),
    stepSizeFont,
  );

export const fitTextHorIdVh = (sizeFontMinVh, sizeFontMaxVh, idText, idTextWrap, stepSizeFont = 1) =>
  fitTextHorElPx(
    (sizeFontMinVh * window.innerHeight) / 100,
    (sizeFontMaxVh * window.innerHeight) / 100,
    document.getElementById(idText),
    document.getElementById(idTextWrap),
    stepSizeFont,
  );

export const fitTextButtonDef = (sizeFontMinVh, sizeFontMaxVh, idLabel, idLabelWrap) =>
  fitTextHorIdVh(sizeFontMinVh, sizeFontMaxVh, idLabel, idLabelWrap);

export const fitTextCardDef = (sizeFontMinVh, sizeFontMaxVh, idText, idTextWrap) =>
  fitTextVertIdVh(sizeFontMinVh, sizeFontMaxVh, idText, idTextWrap);

export const fitTextInstructionDef = (
  sizeFontTextMinVh = 1,
  sizeFontTextMaxVh = 3,
  sizeFontButtonMinVh = 3,
  sizeFontButtonMaxVh = 8,
  idText = 'id-text',
  idTextWrap = 'id-text-wrap',
  idLabelButton = 'id-button-next-label',
  idLabelButtonWrap = 'id-button-next-label-wrap',
) => {
  fitTextCardDef(sizeFontTextMinVh, sizeFontTextMaxVh, idText, idTextWrap);
  fitTextButtonDef(sizeFontButtonMinVh, sizeFontButtonMaxVh, idLabelButton, idLabelButtonWrap);
};

export const reflowTextDef = (fnFitText) => {
  if (!fnFitText) {
    return;
  }
  fnFitText();
  requestAnimationFrame(() => requestAnimationFrame(fnFitText));
  setTimeout(fnFitText, DURATION_TIMEOUT_REFLOW);
};

export const toggleClass = (el) => {
  if (!el) {
    return;
  }
  const elRef = el;
  const nameClass = el.className;
  elRef.className = '';
  elRef.getBoundingClientRect();
  elRef.className = nameClass;
};

export const forceReflowDef = (els) => {
  if (!els) {
    return;
  }
  els.forEach((el) => toggleClass(el));
};

// reflow on iPad under fast rotation
export const reflowLayoutDef = (fnFitText, elsReflow = null) => {
  fnFitText?.();
  forceReflowDef(elsReflow);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      fnFitText?.();
      forceReflowDef(elsReflow);
    }),
  );
};

export const startReflowLayout = (fnFitText, forceReflow = true, elsForceReflow = null) => {
  let elsReflow = elsForceReflow;
  if (forceReflow && !elsReflow) {
    elsReflow = [jsPsych.getDisplayElement()];
  }
  reflowLayoutDef(fnFitText, elsReflow);
  const callbackReflowLayout = () => {
    reflowLayoutDef(fnFitText, elsReflow);
  };
  window.addEventListener('orientationchange', callbackReflowLayout);
  window.addEventListener('resize', callbackReflowLayout);
  window.visualViewport?.addEventListener('resize', callbackReflowLayout);
  window.visualViewport?.addEventListener('scroll', callbackReflowLayout);
  return callbackReflowLayout;
};

export const stopReflowLayout = (callbackReflowLayout) => {
  window.removeEventListener('orientationchange', callbackReflowLayout);
  window.removeEventListener('resize', callbackReflowLayout);
  window.visualViewport?.removeEventListener('resize', callbackReflowLayout);
  window.visualViewport?.removeEventListener('scroll', callbackReflowLayout);
};

export const scrollToTop = () => {
  document.body.scrollTop = 0; // For Safari
  document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
};
