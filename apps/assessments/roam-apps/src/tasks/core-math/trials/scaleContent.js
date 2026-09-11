import _round from 'lodash/round';

// Function to get real content height (including overflowing children)
const getOuterContentHeight = (wrapper) => {
  let children = wrapper.children; // direct children only
  let minTop = Infinity;
  let maxBottom = -Infinity;

  Array.from(children).forEach((el) => {
    let rect = el.getBoundingClientRect();
    minTop = Math.min(minTop, rect.top);
    maxBottom = Math.max(maxBottom, rect.bottom);
  });

  return maxBottom - minTop;
};

const ensureScaleInner = (host) => {
  if (!host) return null;
  let inner = host.querySelector(':scope > .jspsych-scale-inner');
  if (inner) return inner;

  inner = document.createElement('div');
  inner.className = 'jspsych-scale-inner';
  inner.style.display = 'inline-block';
  inner.style.transformOrigin = 'top center';

  while (host.firstChild) {
    inner.appendChild(host.firstChild);
  }
  host.appendChild(inner);
  return inner;
};

export const scaleJsPsychContentToFit = () => {
  const host = document.getElementById('jspsych-content');
  if (!host) return;

  // create an inner element for jspsych-content, it will wrap the prompt and btn-group
  const target = ensureScaleInner(host);
  if (!target) return;

  // Reset scaling before measurement
  target.style.transform = '';
  target.style.transformOrigin = '';
  let el = target.getBoundingClientRect();

  let contentHeight = el.bottom;
  let availableHeight = window.innerHeight;

  // Scale only if content is taller than available space
  if (contentHeight > availableHeight) {
    let scaleFactor = _round(availableHeight / contentHeight, 2);
    target.style.transform = `scale(${scaleFactor})`;
    target.style.transformOrigin = 'top center';

    let timer = document.getElementById('canvas-timer');
    if (timer) {
      let left = 2 * Math.round(window.innerWidth * 0.01);
      let top = 2 * Math.round(window.innerHeight * 0.01);
      let el1 = timer.getBoundingClientRect();
      let leftShift = Math.round(left - el1.left);
      let topShift = Math.round(top - el1.top);
      timer.style.left = `${leftShift}px`;
      timer.style.top = `${topShift}px`;
    }

    let replayBtn = document.getElementById('replay');
    if (replayBtn) {
      let right = 2 * Math.round(window.innerWidth * 0.48);
      let top = 2 * Math.round(window.innerHeight * 0.02);
      let el1 = replayBtn.getBoundingClientRect();
      let rightShift = Math.round(el1.right - right);
      let topShift = Math.round(top - el1.top);
      replayBtn.style.right = `${rightShift}px`;
      replayBtn.style.top = `${topShift}px`;
    }
  }
};

//scale content to fit above the keyboard
export const scaleContentToFitMobile = () => {
  let jspsychContent = document.getElementById('jspsych-content');
  let containerHeight = jspsychContent.offsetHeight;
  let reservedHeight = document.getElementById('simple-keyboard').offsetHeight;
  let availableHeight = containerHeight - reservedHeight;
  let content = document.getElementById('contentWrapper');

  content.style.transform = '';
  let contentHeight = getOuterContentHeight(content);

  if (contentHeight > availableHeight) {
    let scaleFactor = _round(availableHeight / contentHeight, 2);
    content.style.transform = `scale(${scaleFactor})`;
  }
};

/*export const scaleBtnGroupToFit = () => {
  let content = document.getElementById(
    "jspsych-audio-multi-response-btngroup",
  );

  // Reset scaling before measurement
  content.style.transform = "";
  content.style.transformOrigin = "";

  let el = content.getBoundingClientRect();
  let contentWidth = el.right;
  let availableWidth = window.innerWidth;

  // Scale only if content is wider than available space
  if (contentWidth > availableWidth) {
    let scaleFactor = Math.round((availableWidth / contentWidth) * 100) / 100;
    content.style.transform = `scale(${scaleFactor})`;
    content.style.transformOrigin = "center center";
    content.style.gap = `0.5rem`;
  }
};*/
