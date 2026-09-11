// Add responsive design CSS to dynamically inserted SurveyJS elements for question pages
export const insertResponsiveClasses = (_, options) => {
  const parent = options.htmlElement.querySelector('div.sd-row.sd-row--multiple');
  if (parent) {
    parent.classList.add('adaptive-question-wrapper');
    parent.children[0].classList.add('adaptive-question-content');
    parent.children[1].classList.add('adaptive-question-content');
  }
};

// Hide required indicator since every question is required
export const hideRequiredIndicator = (_, options) => {
  const asterik = options.htmlElement.querySelector('span.sd-question__required-text');
  if (asterik) {
    asterik.remove();
  }
};

// Expand to full screen after clicking continue on page1 for the first time
let firstFullscreen = true;
export function openFullscreen(_, options) {
  if (options.page.name !== 'page2' || !firstFullscreen) return;

  firstFullscreen = false;
  const desktop = document.documentElement;
  if (desktop.requestFullscreen) {
    desktop.requestFullscreen().catch((err) => {
      console.log('Fullscreen request failed:', err.message);
      // Optionally, continue with any fallback logic here if needed
    });
  } else if (desktop.webkitRequestFullscreen) {
    /* Safari */
    desktop.webkitRequestFullscreen();
  } else if (desktop.msRequestFullscreen) {
    /* IE11 */
    desktop.msRequestFullscreen();
  }
}
